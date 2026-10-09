import type { Sensing } from "@jojixplay/game-sdk";
import {
  FilesetResolver,
  HandLandmarker,
  type MPMask,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";
import {
  type CameraFrame,
  type CameraRotation,
  isCameraFrame,
  rotateNormalizedPoint,
} from "../domain/camera";
import { type DetectedHand, MAX_HANDS } from "../domain/hands";
import type { DetectedPose } from "../domain/pose";
import type { PoseLimit } from "../domain/pose-limit";
import { SILHOUETTE_GRID_WIDTH, type SilhouetteGrid, uprightGrid } from "../domain/silhouette";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  postMessage(message: PoseWorkerResponse, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
}

const workerScope = self as unknown as WorkerScope;

/** What one camera image yielded, before the request's own timing and frame are attached. */
type Observed =
  | { poses: DetectedPose[] }
  | { hands: DetectedHand[] }
  | { poses: DetectedPose[]; silhouette: SilhouetteGrid };
type Sense = (frame: ImageBitmap, capturedAtMs: number, rotation: CameraRotation) => Observed;

/** Exactly one model exists, chosen when the worker starts. */
let sense: Sense | null = null;
/** Set only when that model is a pose landmarker, whose player limit can change in place. */
let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let poseLimit: PoseLimit = 1;
let reconfiguring = false;

function respond(message: PoseWorkerResponse, transfer?: Transferable[]): void {
  if (transfer) workerScope.postMessage(message, transfer);
  else workerScope.postMessage(message);
}

/**
 * Ends this worker's usefulness. The cause goes to the developer console only: it describes the
 * engine, never the camera image or anything sensed in it.
 */
function fail(message: string, cause: unknown): void {
  console.error(message, cause);
  respond({ type: "error", message });
}

function upright(
  landmarks: ReadonlyArray<{ x: number; y: number; z: number; visibility?: number }>,
  rotation: CameraRotation,
): DetectedPose {
  return {
    landmarks: landmarks.map((landmark) => {
      const point = rotateNormalizedPoint(landmark, rotation);
      return { x: point.x, y: point.y, z: landmark.z, visibility: landmark.visibility ?? 0 };
    }),
  };
}

/** One reusable pair of framebuffers per MediaPipe drawing context. */
const maskReaders = new WeakMap<
  WebGL2RenderingContext,
  { source: WebGLFramebuffer; target: WebGLFramebuffer; store: WebGLRenderbuffer; size: string }
>();

/**
 * Reads pose masks straight from the GPU. MediaPipe computes them correctly there, as 8-bit
 * textures with the mask in red, but its own conversion to an array returns zeros for them (every
 * release from 0.10.3 to 1.1.0). Each mask is shrunk on the GPU first, so little is read back.
 * Masks are assumed to be measured on the camera's own pixels, as landmarks are; that is
 * unverified for a rotated camera.
 */
function silhouetteGrid(masks: readonly MPMask[], rotation: CameraRotation): SilhouetteGrid {
  const first = masks[0];
  const gl = first?.canvas?.getContext("webgl2");
  if (first === undefined || !gl) {
    return { width: 1, height: 1, alpha: new Uint8Array(1) };
  }
  const step = Math.ceil(first.width / SILHOUETTE_GRID_WIDTH);
  const width = Math.ceil(first.width / step);
  const height = Math.ceil(first.height / step);
  let reader = maskReaders.get(gl);
  if (reader === undefined) {
    reader = {
      source: gl.createFramebuffer(),
      target: gl.createFramebuffer(),
      store: gl.createRenderbuffer(),
      size: "",
    };
    maskReaders.set(gl, reader);
  }
  // MediaPipe keeps drawing with this context: leave every binding as it was found.
  const readBound = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  const drawBound = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
  const storeBound = gl.getParameter(gl.RENDERBUFFER_BINDING);
  const alpha = new Uint8Array(width * height);
  try {
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, reader.target);
    if (reader.size !== `${width}x${height}`) {
      gl.bindRenderbuffer(gl.RENDERBUFFER, reader.store);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, width, height);
      gl.framebufferRenderbuffer(
        gl.DRAW_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.RENDERBUFFER,
        reader.store,
      );
      reader.size = `${width}x${height}`;
    }
    const pixels = new Uint8Array(width * height * 4);
    for (const mask of masks) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, reader.source);
      gl.framebufferTexture2D(
        gl.READ_FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        mask.getAsWebGLTexture(),
        0,
      );
      gl.blitFramebuffer(
        0,
        0,
        mask.width,
        mask.height,
        0,
        0,
        width,
        height,
        gl.COLOR_BUFFER_BIT,
        gl.LINEAR,
      );
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, reader.target);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      // Several people become one shape: each cell keeps its most confident person.
      for (let cell = 0; cell < alpha.length; cell += 1) {
        const value = pixels[cell * 4] ?? 0;
        if (value > (alpha[cell] ?? 0)) alpha[cell] = value;
      }
    }
  } finally {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, readBound);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, drawBound);
    gl.bindRenderbuffer(gl.RENDERBUFFER, storeBound);
  }
  return uprightGrid({ width, height, alpha }, rotation);
}

async function createPose(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelUrl: string,
  withSilhouette: boolean,
): Promise<Sense> {
  const landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { delegate: "GPU", modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    numPoses: poseLimit,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: withSilhouette,
  });
  poseLandmarker = landmarker;
  return (frame, capturedAtMs, rotation) => {
    let observed: Observed = { poses: [] };
    landmarker.detectForVideo(frame, capturedAtMs, { rotationDegrees: rotation }, (result) => {
      const poses = result.landmarks
        .slice(0, poseLimit)
        .map((landmarks) => upright(landmarks, rotation));
      observed = withSilhouette
        ? { poses, silhouette: silhouetteGrid(result.segmentationMasks ?? [], rotation) }
        : { poses };
    });
    return observed;
  };
}

async function createHands(
  fileset: Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>,
  modelUrl: string,
): Promise<Sense> {
  const landmarker = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { delegate: "GPU", modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    numHands: MAX_HANDS,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });
  handLandmarker = landmarker;
  return (frame, capturedAtMs, rotation) => {
    const result = landmarker.detectForVideo(frame, capturedAtMs, { rotationDegrees: rotation });
    return {
      hands: result.landmarks.slice(0, MAX_HANDS).flatMap((landmarks, index) => {
        const category = result.handedness[index]?.[0];
        if (category?.categoryName !== "Left" && category?.categoryName !== "Right") return [];
        return [
          {
            label: category.categoryName === "Left" ? ("left" as const) : ("right" as const),
            score: category.score,
            landmarks: landmarks.map((landmark) => ({
              ...rotateNormalizedPoint(landmark, rotation),
              z: landmark.z,
            })),
          },
        ];
      }),
    };
  };
}

async function initialize(
  wasmBaseUrl: string,
  sensing: Sensing,
  modelUrl: string,
  initialPoseLimit: PoseLimit,
): Promise<void> {
  poseLimit = initialPoseLimit;
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  sense =
    sensing === "hands"
      ? await createHands(fileset, modelUrl)
      : await createPose(fileset, modelUrl, sensing === "silhouette");
  respond({ type: "ready" });
}

/** Runs one graph change at a time; estimates are refused while it is in progress. */
async function reconfigure(change: () => Promise<void>): Promise<void> {
  if (sense === null) {
    throw new Error("Pose engine is not initialized.");
  }
  if (reconfiguring) {
    throw new Error("Pose engine is already being reconfigured.");
  }
  reconfiguring = true;
  try {
    await change();
  } finally {
    reconfiguring = false;
  }
}

async function setPoseLimit(nextPoseLimit: PoseLimit): Promise<void> {
  await reconfigure(async () => {
    if (nextPoseLimit !== poseLimit) await poseLandmarker?.setOptions({ numPoses: nextPoseLimit });
    poseLimit = nextPoseLimit;
  });
  respond({ type: "pose-limit-set", poseLimit });
}

async function resetTracking(): Promise<void> {
  await reconfigure(async () => {
    await poseLandmarker?.setOptions({ numPoses: poseLimit });
    await handLandmarker?.setOptions({ numHands: MAX_HANDS });
  });
  respond({ type: "tracking-reset" });
}

function isCameraRotation(value: unknown): value is CameraRotation {
  return value === 0 || value === 90 || value === 180 || value === 270;
}

function frameMatchesSource(
  frame: ImageBitmap,
  cameraFrame: CameraFrame,
  rotation: CameraRotation,
): boolean {
  const swapsDimensions = rotation === 90 || rotation === 270;
  return (
    cameraFrame.width === (swapsDimensions ? frame.height : frame.width) &&
    cameraFrame.height === (swapsDimensions ? frame.width : frame.height)
  );
}

function report(
  observed: Observed,
  capturedAtMs: number,
  sequence: number,
  cameraFrame: CameraFrame,
): void {
  const packet = { sequence, capturedAtMs, frame: { ...cameraFrame }, ...observed };
  respond(
    { type: "result", packet },
    "silhouette" in observed ? [observed.silhouette.alpha.buffer] : undefined,
  );
}

function estimate(
  frame: ImageBitmap,
  capturedAtMs: number,
  sequence: number,
  cameraFrame: CameraFrame,
  rotation: CameraRotation,
): void {
  try {
    if (reconfiguring) {
      throw new Error("Pose engine is being reconfigured.");
    }
    if (
      !Number.isSafeInteger(sequence) ||
      sequence < 0 ||
      !Number.isFinite(capturedAtMs) ||
      capturedAtMs < 0 ||
      !isCameraFrame(cameraFrame) ||
      !isCameraRotation(rotation) ||
      !frameMatchesSource(frame, cameraFrame, rotation)
    ) {
      throw new Error("Pose estimate request is invalid.");
    }
    if (sense === null) {
      throw new Error("Pose engine is not initialized.");
    }
    report(sense(frame, capturedAtMs, rotation), capturedAtMs, sequence, cameraFrame);
  } finally {
    frame.close();
  }
}

workerScope.onmessage = (event: MessageEvent<PoseWorkerRequest>) => {
  const message = event.data;
  if (message.type === "initialize") {
    void initialize(
      message.wasmBaseUrl,
      message.sensing,
      message.modelUrl,
      message.poseLimit,
    ).catch((cause) => fail("The pose engine could not start.", cause));
    return;
  }
  if (message.type === "set-pose-limit") {
    void setPoseLimit(message.poseLimit).catch((cause) =>
      fail("Player mode could not be changed.", cause),
    );
    return;
  }
  if (message.type === "reset-tracking") {
    void resetTracking().catch((cause) => fail("Pose tracking could not be reset.", cause));
    return;
  }

  try {
    estimate(
      message.frame,
      message.capturedAtMs,
      message.sequence,
      message.cameraFrame,
      message.rotation,
    );
  } catch (cause) {
    fail("The pose frame could not be processed.", cause);
  }
};

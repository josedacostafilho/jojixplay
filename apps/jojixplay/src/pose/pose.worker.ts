import { FilesetResolver, HandLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";
import {
  type CameraFrame,
  type CameraRotation,
  isCameraFrame,
  rotateNormalizedPoint,
} from "../domain/camera";
import type { PosePacket } from "../domain/pose";
import type { PoseLimit } from "../domain/pose-limit";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  postMessage(message: PoseWorkerResponse): void;
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
}

const workerScope = self as unknown as WorkerScope;

let landmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let poseLimit: PoseLimit = 1;
let reconfiguring = false;

function respond(message: PoseWorkerResponse): void {
  workerScope.postMessage(message);
}

async function initialize(
  wasmBaseUrl: string,
  modelUrl: string,
  initialPoseLimit: PoseLimit,
  mode: "pose" | "hands",
): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  if (mode === "hands") {
    handLandmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { delegate: "GPU", modelAssetPath: modelUrl },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    respond({ type: "ready" });
    return;
  }
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      delegate: "GPU",
      modelAssetPath: modelUrl,
    },
    runningMode: "VIDEO",
    numPoses: initialPoseLimit,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  poseLimit = initialPoseLimit;
  respond({ type: "ready" });
}

async function setPoseLimit(nextPoseLimit: PoseLimit): Promise<void> {
  if (landmarker === null) {
    throw new Error("Pose engine is not initialized.");
  }
  if (reconfiguring) {
    throw new Error("Pose engine is already changing player mode.");
  }
  if (nextPoseLimit === poseLimit) {
    respond({ type: "pose-limit-set", poseLimit });
    return;
  }

  reconfiguring = true;
  try {
    await landmarker.setOptions({ numPoses: nextPoseLimit });
    poseLimit = nextPoseLimit;
    respond({ type: "pose-limit-set", poseLimit });
  } finally {
    reconfiguring = false;
  }
}

async function resetTracking(): Promise<void> {
  if (handLandmarker) {
    await handLandmarker.setOptions({ numHands: 2 });
    respond({ type: "tracking-reset" });
    return;
  }
  if (landmarker === null) {
    throw new Error("Pose engine is not initialized.");
  }
  if (reconfiguring) {
    throw new Error("Pose engine is already being reconfigured.");
  }

  reconfiguring = true;
  try {
    await landmarker.setOptions({ numPoses: poseLimit });
    respond({ type: "tracking-reset" });
  } finally {
    reconfiguring = false;
  }
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

function estimate(
  frame: ImageBitmap,
  capturedAtMs: number,
  sequence: number,
  cameraFrame: CameraFrame,
  rotation: CameraRotation,
): void {
  try {
    if (landmarker === null && handLandmarker === null) {
      throw new Error("Pose engine is not initialized.");
    }
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
    if (handLandmarker) {
      const result = handLandmarker.detectForVideo(frame, capturedAtMs, {
        rotationDegrees: rotation,
      });
      const hands = result.landmarks.flatMap((points, i) => {
        const label = result.handedness[i]?.[0];
        const world = result.worldLandmarks[i];
        if (!label || !world || (label.categoryName !== "Left" && label.categoryName !== "Right"))
          return [];
        const landmarks = points.map((p) => ({ ...rotateNormalizedPoint(p, rotation), z: p.z }));
        const radians = (rotation * Math.PI) / 180;
        return [
          {
            handedness: label.categoryName === "Left" ? ("left" as const) : ("right" as const),
            handednessScore: label.score,
            landmarks,
            worldLandmarks: world.map((p) => ({
              x: p.x * Math.cos(radians) - p.y * Math.sin(radians),
              y: p.x * Math.sin(radians) + p.y * Math.cos(radians),
              z: p.z,
            })),
          },
        ];
      });
      respond({
        type: "result",
        packet: { sequence, capturedAtMs, frame: { ...cameraFrame }, poses: [], hands },
      });
      return;
    }
    if (!landmarker) throw new Error("Pose engine is not initialized.");
    landmarker.detectForVideo(frame, capturedAtMs, { rotationDegrees: rotation }, (result) => {
      const packet: PosePacket = {
        sequence,
        capturedAtMs,
        frame: { ...cameraFrame },
        poses: result.landmarks.slice(0, poseLimit).map((landmarks) => ({
          landmarks: landmarks.map((landmark) => {
            const point = rotateNormalizedPoint(landmark, rotation);
            return {
              x: point.x,
              y: point.y,
              z: landmark.z,
              visibility: landmark.visibility ?? 0,
            };
          }),
        })),
      };
      respond({ type: "result", packet });
    });
  } finally {
    frame.close();
  }
}

workerScope.onmessage = (event: MessageEvent<PoseWorkerRequest>) => {
  const message = event.data;
  if (message.type === "initialize") {
    void initialize(message.wasmBaseUrl, message.modelUrl, message.poseLimit, message.mode).catch(
      () => {
        respond({ type: "error", message: "The pose engine could not start." });
      },
    );
    return;
  }
  if (message.type === "set-pose-limit") {
    void setPoseLimit(message.poseLimit).catch(() => {
      respond({ type: "error", message: "Player mode could not be changed." });
    });
    return;
  }
  if (message.type === "reset-tracking") {
    void resetTracking().catch(() => {
      respond({ type: "error", message: "Pose tracking could not be reset." });
    });
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
  } catch {
    respond({ type: "error", message: "The pose frame could not be processed." });
  }
};

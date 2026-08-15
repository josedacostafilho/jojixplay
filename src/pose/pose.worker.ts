import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
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
let poseLimit: PoseLimit = 1;
let reconfiguring = false;

function respond(message: PoseWorkerResponse): void {
  workerScope.postMessage(message);
}

async function initialize(
  wasmBaseUrl: string,
  modelUrl: string,
  initialPoseLimit: PoseLimit,
): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl },
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
    if (landmarker === null) {
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
    void initialize(message.wasmBaseUrl, message.modelUrl, message.poseLimit).catch(() => {
      respond({ type: "error", message: "The pose engine could not start." });
    });
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

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
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
let changingPoseLimit = false;

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
  if (changingPoseLimit) {
    throw new Error("Pose engine is already changing player mode.");
  }
  if (nextPoseLimit === poseLimit) {
    respond({ type: "pose-limit-set", poseLimit });
    return;
  }

  changingPoseLimit = true;
  try {
    await landmarker.setOptions({ numPoses: nextPoseLimit });
    poseLimit = nextPoseLimit;
    respond({ type: "pose-limit-set", poseLimit });
  } finally {
    changingPoseLimit = false;
  }
}

function estimate(frame: ImageBitmap, capturedAtMs: number, sequence: number): void {
  try {
    if (landmarker === null) {
      throw new Error("Pose engine is not initialized.");
    }
    if (changingPoseLimit) {
      throw new Error("Pose engine is changing player mode.");
    }
    const width = frame.width;
    const height = frame.height;
    landmarker.detectForVideo(frame, capturedAtMs, (result) => {
      const packet: PosePacket = {
        sequence,
        capturedAtMs,
        frame: { width, height },
        poses: result.landmarks.slice(0, poseLimit).map((landmarks) => ({
          landmarks: landmarks.map((landmark) => ({
            x: landmark.x,
            y: landmark.y,
            z: landmark.z,
            visibility: landmark.visibility ?? 0,
          })),
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

  try {
    estimate(message.frame, message.capturedAtMs, message.sequence);
  } catch {
    respond({ type: "error", message: "The pose frame could not be processed." });
  }
};

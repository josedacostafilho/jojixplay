import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PosePacket } from "../domain/pose";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface WorkerScope {
  postMessage(message: PoseWorkerResponse): void;
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
}

const workerScope = self as unknown as WorkerScope;

let landmarker: PoseLandmarker | null = null;

function respond(message: PoseWorkerResponse): void {
  workerScope.postMessage(message);
}

async function initialize(wasmBaseUrl: string, modelUrl: string): Promise<void> {
  const fileset = await FilesetResolver.forVisionTasks(wasmBaseUrl, true);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: modelUrl },
    runningMode: "VIDEO",
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputSegmentationMasks: false,
  });
  respond({ type: "ready" });
}

function estimate(frame: ImageBitmap, capturedAtMs: number, sequence: number): void {
  try {
    if (landmarker === null) {
      throw new Error("Pose engine is not initialized.");
    }
    const width = frame.width;
    const height = frame.height;
    landmarker.detectForVideo(frame, capturedAtMs, (result) => {
      const packet: PosePacket = {
        sequence,
        capturedAtMs,
        frame: { width, height },
        poses: result.landmarks.slice(0, 2).map((landmarks) => ({
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
    void initialize(message.wasmBaseUrl, message.modelUrl).catch(() => {
      respond({ type: "error", message: "The pose engine could not start." });
    });
    return;
  }

  try {
    estimate(message.frame, message.capturedAtMs, message.sequence);
  } catch {
    respond({ type: "error", message: "The pose frame could not be processed." });
  }
};

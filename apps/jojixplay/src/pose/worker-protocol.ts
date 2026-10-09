import type { CameraFrame, CameraRotation } from "../domain/camera";
import type { PosePacket } from "../domain/pose";
import type { PoseLimit } from "../domain/pose-limit";

export type PoseWorkerRequest =
  | {
      type: "initialize";
      wasmBaseUrl: string;
      modelUrl: string;
      poseLimit: PoseLimit;
    }
  | {
      type: "estimate";
      frame: ImageBitmap;
      capturedAtMs: number;
      sequence: number;
      cameraFrame: CameraFrame;
      rotation: CameraRotation;
    }
  | {
      type: "set-pose-limit";
      poseLimit: PoseLimit;
    }
  | { type: "reset-tracking" };

export type PoseWorkerResponse =
  | { type: "ready" }
  | { type: "result"; packet: PosePacket }
  | { type: "pose-limit-set"; poseLimit: PoseLimit }
  | { type: "tracking-reset" }
  | { type: "error"; message: string };

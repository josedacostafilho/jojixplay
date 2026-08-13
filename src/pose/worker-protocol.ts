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
    }
  | {
      type: "set-pose-limit";
      poseLimit: PoseLimit;
    };

export type PoseWorkerResponse =
  | { type: "ready" }
  | { type: "result"; packet: PosePacket }
  | { type: "pose-limit-set"; poseLimit: PoseLimit }
  | { type: "error"; message: string };

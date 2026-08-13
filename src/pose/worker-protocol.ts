import type { PosePacket } from "../domain/pose";

export type PoseWorkerRequest =
  | {
      type: "initialize";
      wasmBaseUrl: string;
      modelUrl: string;
    }
  | {
      type: "estimate";
      frame: ImageBitmap;
      capturedAtMs: number;
      sequence: number;
    };

export type PoseWorkerResponse =
  | { type: "ready" }
  | { type: "result"; packet: PosePacket }
  | { type: "error"; message: string };

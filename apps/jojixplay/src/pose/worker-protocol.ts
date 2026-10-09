import type { Sensing } from "@jojixplay/game-sdk";
import type { CameraFrame, CameraRotation } from "../domain/camera";
import type { SensedPacket } from "../domain/sensed-packet";
import type { PoseLimit } from "../domain/pose-limit";

export type PoseWorkerRequest =
  | {
      type: "initialize";
      wasmBaseUrl: string;
      /** A worker senses one kind for its whole life; sensing another kind takes a new worker. */
      sensing: Sensing;
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
  | { type: "result"; packet: SensedPacket }
  | { type: "pose-limit-set"; poseLimit: PoseLimit }
  | { type: "tracking-reset" }
  | { type: "error"; message: string };

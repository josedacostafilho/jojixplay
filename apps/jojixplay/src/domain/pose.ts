import { type CameraFrame, isCameraFrame } from "./camera";

export const MAX_POSES = 2;
export const LANDMARKS_PER_POSE = 33;

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

/** Metres from the midpoint of the hips, on the upright camera image's axes. */
export interface WorldPoint {
  x: number;
  y: number;
  z: number;
}

export interface DetectedPose {
  landmarks: PoseLandmark[];
  /** The same landmarks, in the same order, in the person's own space. */
  world: WorldPoint[];
}

export interface PosePacket {
  sequence: number;
  capturedAtMs: number;
  frame: CameraFrame;
  poses: DetectedPose[];
}

export type PosePacketParseResult = { ok: true; value: PosePacket } | { ok: false; error: string };

const POSE_PACKET_KEYS = ["sequence", "capturedAtMs", "frame", "poses"];
const POSE_KEYS = ["landmarks", "world"];
const WORLD_KEYS = ["x", "y", "z"];
const LANDMARK_KEYS = ["x", "y", "z", "visibility"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length && expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parsePosePacket(value: unknown): PosePacketParseResult {
  if (!isRecord(value) || !hasExactKeys(value, POSE_PACKET_KEYS)) {
    return { ok: false, error: "Pose packet has an invalid shape." };
  }

  if (
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 0 ||
    !isFiniteNumber(value.capturedAtMs) ||
    value.capturedAtMs < 0
  ) {
    return { ok: false, error: "Pose packet metadata is invalid." };
  }

  if (!isCameraFrame(value.frame)) {
    return { ok: false, error: "Pose packet frame dimensions are invalid." };
  }

  if (!Array.isArray(value.poses) || value.poses.length > MAX_POSES) {
    return { ok: false, error: "Pose packet pose count is invalid." };
  }

  const poses: DetectedPose[] = [];
  for (const pose of value.poses) {
    if (
      !isRecord(pose) ||
      !hasExactKeys(pose, POSE_KEYS) ||
      !Array.isArray(pose.landmarks) ||
      pose.landmarks.length !== LANDMARKS_PER_POSE ||
      !Array.isArray(pose.world) ||
      pose.world.length !== LANDMARKS_PER_POSE
    ) {
      return { ok: false, error: "Pose packet landmarks are invalid." };
    }

    const landmarks: PoseLandmark[] = [];
    for (const landmark of pose.landmarks) {
      if (
        !isRecord(landmark) ||
        !hasExactKeys(landmark, LANDMARK_KEYS) ||
        !isFiniteNumber(landmark.x) ||
        !isFiniteNumber(landmark.y) ||
        !isFiniteNumber(landmark.z) ||
        !isFiniteNumber(landmark.visibility) ||
        landmark.visibility < 0 ||
        landmark.visibility > 1
      ) {
        return { ok: false, error: "Pose packet contains an invalid landmark." };
      }

      landmarks.push({
        x: landmark.x,
        y: landmark.y,
        z: landmark.z,
        visibility: landmark.visibility,
      });
    }

    const world: WorldPoint[] = [];
    for (const point of pose.world) {
      if (
        !isRecord(point) ||
        !hasExactKeys(point, WORLD_KEYS) ||
        !isFiniteNumber(point.x) ||
        !isFiniteNumber(point.y) ||
        !isFiniteNumber(point.z)
      ) {
        return { ok: false, error: "Pose packet contains an invalid world landmark." };
      }
      world.push({ x: point.x, y: point.y, z: point.z });
    }

    poses.push({ landmarks, world });
  }

  return {
    ok: true,
    value: {
      sequence: Number(value.sequence),
      capturedAtMs: value.capturedAtMs,
      frame: {
        width: Number(value.frame.width),
        height: Number(value.frame.height),
        layout: value.frame.layout,
        epoch: Number(value.frame.epoch),
      },
      poses,
    },
  };
}

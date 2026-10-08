import type { TrackedHand } from "@jojixplay/game-sdk";
import { type CameraFrame, isCameraFrame } from "./camera";

export const MAX_POSES = 2;
export const LANDMARKS_PER_POSE = 33;

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface DetectedPose {
  landmarks: PoseLandmark[];
}

export interface PosePacket {
  sequence: number;
  capturedAtMs: number;
  frame: CameraFrame;
  poses: DetectedPose[];
  hands?: readonly TrackedHand[];
}

export type PosePacketParseResult = { ok: true; value: PosePacket } | { ok: false; error: string };

const POSE_PACKET_KEYS = ["sequence", "capturedAtMs", "frame", "poses"];
const POSE_KEYS = ["landmarks"];
const LANDMARK_KEYS = ["x", "y", "z", "visibility"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length && expectedKeys.every((key) => Object.hasOwn(value, key))
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parsePosePacket(value: unknown): PosePacketParseResult {
  if (
    !isRecord(value) ||
    !hasExactKeys(
      value,
      Object.hasOwn(value, "hands") ? [...POSE_PACKET_KEYS, "hands"] : POSE_PACKET_KEYS,
    )
  ) {
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

  let hands: TrackedHand[] | undefined;
  if (Object.hasOwn(value, "hands")) {
    if (!Array.isArray(value.hands) || value.hands.length > 2 || value.poses.length !== 0)
      return { ok: false, error: "Hand packet count is invalid." };
    hands = [];
    for (const hand of value.hands) {
      if (
        !isRecord(hand) ||
        !hasExactKeys(hand, ["handedness", "handednessScore", "landmarks", "worldLandmarks"]) ||
        (hand.handedness !== "left" && hand.handedness !== "right") ||
        !isFiniteNumber(hand.handednessScore) ||
        hand.handednessScore < 0 ||
        hand.handednessScore > 1
      )
        return { ok: false, error: "Hand metadata is invalid." };
      const lists: Array<Array<{ x: number; y: number; z: number }>> = [];
      for (const key of ["landmarks", "worldLandmarks"] as const) {
        const points = hand[key];
        if (!Array.isArray(points) || points.length !== 21)
          return { ok: false, error: "Hand must contain 21 landmarks." };
        const parsed = [];
        for (const point of points) {
          if (
            !isRecord(point) ||
            !hasExactKeys(point, ["x", "y", "z"]) ||
            !isFiniteNumber(point.x) ||
            !isFiniteNumber(point.y) ||
            !isFiniteNumber(point.z) ||
            Math.abs(point.z) > 2 ||
            (key === "landmarks"
              ? point.x < -1 || point.x > 2 || point.y < -1 || point.y > 2
              : Math.abs(point.x) > 2 || Math.abs(point.y) > 2)
          )
            return { ok: false, error: "Hand coordinates are invalid." };
          parsed.push({ x: point.x, y: point.y, z: point.z });
        }
        lists.push(parsed);
      }
      const [landmarks, worldLandmarks] = lists;
      if (!landmarks || !worldLandmarks) return { ok: false, error: "Missing hand geometry." };
      hands.push({
        handedness: hand.handedness,
        handednessScore: hand.handednessScore,
        landmarks,
        worldLandmarks,
      });
    }
  }

  const poses: DetectedPose[] = [];
  for (const pose of value.poses) {
    if (
      !isRecord(pose) ||
      !hasExactKeys(pose, POSE_KEYS) ||
      !Array.isArray(pose.landmarks) ||
      pose.landmarks.length !== LANDMARKS_PER_POSE
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

    poses.push({ landmarks });
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
      ...(hands ? { hands } : {}),
    },
  };
}

import { type CameraFrame, isCameraFrame } from "./camera";
import { hasExactKeys, isFiniteNumber, isRecord } from "./pose";

export const MAX_HANDS = 2;
export const LANDMARKS_PER_HAND = 21;

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  /** The model's own label: the person's own side when the image is unmirrored, as ours is. */
  label: "left" | "right";
  score: number;
  landmarks: HandLandmark[];
}

export interface HandPacket {
  sequence: number;
  capturedAtMs: number;
  frame: CameraFrame;
  hands: DetectedHand[];
}

export type HandPacketParseResult = { ok: true; value: HandPacket } | { ok: false; error: string };

const HAND_PACKET_KEYS = ["sequence", "capturedAtMs", "frame", "hands"];
const HAND_KEYS = ["label", "score", "landmarks"];
const LANDMARK_KEYS = ["x", "y", "z"];
/** A hand at the edge of the image has points outside it, but never this far. */
const COORDINATE_LIMIT = 2;

export function parseHandPacket(value: unknown): HandPacketParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: "Hand packet has an invalid shape." };
  }
  if (!hasExactKeys(value, HAND_PACKET_KEYS)) {
    return { ok: false, error: "Hand packet has an invalid shape." };
  }
  if (
    !Number.isSafeInteger(value.sequence) ||
    Number(value.sequence) < 0 ||
    !isFiniteNumber(value.capturedAtMs) ||
    value.capturedAtMs < 0
  ) {
    return { ok: false, error: "Hand packet metadata is invalid." };
  }
  if (!isCameraFrame(value.frame)) {
    return { ok: false, error: "Hand packet frame dimensions are invalid." };
  }
  if (!Array.isArray(value.hands) || value.hands.length > MAX_HANDS) {
    return { ok: false, error: "Hand packet hand count is invalid." };
  }

  const hands: DetectedHand[] = [];
  for (const hand of value.hands) {
    if (
      !isRecord(hand) ||
      !hasExactKeys(hand, HAND_KEYS) ||
      (hand.label !== "left" && hand.label !== "right") ||
      !isFiniteNumber(hand.score) ||
      hand.score < 0 ||
      hand.score > 1 ||
      !Array.isArray(hand.landmarks) ||
      hand.landmarks.length !== LANDMARKS_PER_HAND
    ) {
      return { ok: false, error: "Hand packet contains an invalid hand." };
    }
    const landmarks: HandLandmark[] = [];
    for (const landmark of hand.landmarks) {
      if (
        !isRecord(landmark) ||
        !hasExactKeys(landmark, LANDMARK_KEYS) ||
        !isFiniteNumber(landmark.x) ||
        !isFiniteNumber(landmark.y) ||
        !isFiniteNumber(landmark.z) ||
        Math.abs(landmark.x) > COORDINATE_LIMIT ||
        Math.abs(landmark.y) > COORDINATE_LIMIT ||
        Math.abs(landmark.z) > COORDINATE_LIMIT
      ) {
        return { ok: false, error: "Hand packet contains an invalid landmark." };
      }
      landmarks.push({ x: landmark.x, y: landmark.y, z: landmark.z });
    }
    hands.push({ label: hand.label, score: hand.score, landmarks });
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
      hands,
    },
  };
}

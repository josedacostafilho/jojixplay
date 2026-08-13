export const MAX_POSES = 2;
export const LANDMARKS_PER_POSE = 33;
export const USABLE_LANDMARK_VISIBILITY = 0.35;

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
  frame: {
    width: number;
    height: number;
  };
  poses: DetectedPose[];
}

export type PosePacketParseResult = { ok: true; value: PosePacket } | { ok: false; error: string };

export function acceptIncreasingSequence(
  currentSequence: number,
  incomingSequence: number,
): number | null {
  return incomingSequence > currentSequence ? incomingSequence : null;
}

const POSE_PACKET_KEYS = ["sequence", "capturedAtMs", "frame", "poses"];
const FRAME_KEYS = ["width", "height"];
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

function isFrameDimension(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= 16_384;
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

  if (
    !isRecord(value.frame) ||
    !hasExactKeys(value.frame, FRAME_KEYS) ||
    !isFrameDimension(value.frame.width) ||
    !isFrameDimension(value.frame.height)
  ) {
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
      },
      poses,
    },
  };
}

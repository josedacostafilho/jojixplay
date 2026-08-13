export const DEFAULT_POSE_LIMIT = 1;
export const MAX_POSE_LIMIT = 2;

export type PoseLimit = 1 | 2;

export interface PoseLimitMessage {
  poseLimit: PoseLimit;
}

export type PoseLimitParseResult =
  | { ok: true; value: PoseLimitMessage }
  | { ok: false; error: string };

export function isPoseLimit(value: unknown): value is PoseLimit {
  return value === DEFAULT_POSE_LIMIT || value === MAX_POSE_LIMIT;
}

export function parsePoseLimitMessage(value: unknown): PoseLimitParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: "Player-limit message has an invalid shape." };
  }

  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    !Object.hasOwn(record, "poseLimit") ||
    !isPoseLimit(record.poseLimit)
  ) {
    return { ok: false, error: "Player-limit message is invalid." };
  }

  return { ok: true, value: { poseLimit: record.poseLimit } };
}

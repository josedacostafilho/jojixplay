export const DEFAULT_POSE_LIMIT = 1;
export const MAX_POSE_LIMIT = 2;

export type PoseLimit = 1 | 2;

export function isPoseLimit(value: unknown): value is PoseLimit {
  return value === DEFAULT_POSE_LIMIT || value === MAX_POSE_LIMIT;
}

import { type DetectedPose, type PoseLandmark, USABLE_LANDMARK_VISIBILITY } from "./pose";

export type PoseHand = "left" | "right";
export type CoarseHandLandmarkName = "wrist" | "pinky" | "index" | "thumb";

export interface PosePoint {
  x: number;
  y: number;
}

export interface CoarseHand {
  center: PosePoint;
  landmarks: Readonly<Record<CoarseHandLandmarkName, PoseLandmark>>;
}

export const COARSE_HAND_LANDMARK_NAMES = ["wrist", "pinky", "index", "thumb"] as const;

const COARSE_HAND_INDICES = {
  left: { wrist: 15, pinky: 17, index: 19, thumb: 21 },
  right: { wrist: 16, pinky: 18, index: 20, thumb: 22 },
} as const satisfies Record<PoseHand, Record<CoarseHandLandmarkName, number>>;

export function usablePoseLandmark(pose: DetectedPose, index: number): PoseLandmark | null {
  const landmark = pose.landmarks[index];
  return landmark !== undefined && landmark.visibility >= USABLE_LANDMARK_VISIBILITY
    ? landmark
    : null;
}

export function coarseHand(pose: DetectedPose, hand: PoseHand): CoarseHand | null {
  const indices = COARSE_HAND_INDICES[hand];
  const wrist = usablePoseLandmark(pose, indices.wrist);
  const pinky = usablePoseLandmark(pose, indices.pinky);
  const index = usablePoseLandmark(pose, indices.index);
  const thumb = usablePoseLandmark(pose, indices.thumb);
  if (wrist === null || pinky === null || index === null || thumb === null) {
    return null;
  }

  const landmarks = { wrist, pinky, index, thumb };
  return {
    center: {
      x: (wrist.x + pinky.x + index.x + thumb.x) / COARSE_HAND_LANDMARK_NAMES.length,
      y: (wrist.y + pinky.y + index.y + thumb.y) / COARSE_HAND_LANDMARK_NAMES.length,
    },
    landmarks,
  };
}

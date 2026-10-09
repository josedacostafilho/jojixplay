import type { Sensing } from "@jojixplay/game-sdk";

const POSE = "mediapipe/pose-landmarker-full-float16-1/pose_landmarker_full.task";

/** Vendored models at their immutable published paths. A model is fetched when first sensed with. */
export const SENSING_MODELS: Readonly<Record<Sensing, string>> = {
  body: POSE,
  hands: "mediapipe/hand-landmarker-float16-1/hand_landmarker.task",
  // Silhouettes are the pose model's own mask.
  silhouette: POSE,
};

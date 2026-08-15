import type { CameraLayout } from "../domain/camera";
import type { PoseLimit } from "../domain/pose-limit";

export type GameId = "draw" | "bubbles" | "racing";

const BOTH_LAYOUTS = ["portrait", "landscape"] as const satisfies readonly CameraLayout[];
const LANDSCAPE_ONLY = ["landscape"] as const satisfies readonly CameraLayout[];

export function supportedCameraLayouts(
  game: GameId,
  poseLimit: PoseLimit,
): readonly CameraLayout[] {
  if ((game === "bubbles" || game === "racing") && poseLimit === 2) {
    return LANDSCAPE_ONLY;
  }
  return BOTH_LAYOUTS;
}

export function gameSupportsCameraLayout(
  game: GameId,
  poseLimit: PoseLimit,
  layout: CameraLayout,
): boolean {
  return supportedCameraLayouts(game, poseLimit).includes(layout);
}

export function requiredCameraLayout(game: GameId, poseLimit: PoseLimit): CameraLayout | null {
  const layouts = supportedCameraLayouts(game, poseLimit);
  return layouts.length === 1 ? (layouts[0] ?? null) : null;
}

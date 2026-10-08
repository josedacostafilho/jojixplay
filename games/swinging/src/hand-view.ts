import { projectHandLandmarks, type HandPoint, type TrackedHand } from "@jojixplay/game-sdk";

/** Player-facing depth; menu pointers and game hands share their image projection. */
export function projectHand(hand: TrackedHand): HandPoint[] {
  const baseZ = hand.worldLandmarks[0]?.z ?? 0;
  return projectHandLandmarks(hand.landmarks).map((p, i) => ({
    x: p.x,
    y: p.y,
    // Reverse the camera-facing depth: the player sees their own hands from behind.
    z: Math.max(-1.6, Math.min(-0.3, -0.95 + ((hand.worldLandmarks[i]?.z ?? baseZ) - baseZ) * 3)),
  }));
}

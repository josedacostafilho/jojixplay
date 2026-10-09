/**
 * Expand the central hand workspace so a player standing across the room reaches every control.
 * The camera is hidden during the race, so the cursor need not sit on the hand's image; display
 * and hit testing must both use this point. Input is unmirrored camera space; output is mirrored.
 */
export function reachableHand(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0.02, Math.min(0.98, 0.5 + (0.5 - x) * 2)),
    y: Math.max(0.02, Math.min(0.98, 0.5 + (y - 0.45) / 0.6)),
  };
}

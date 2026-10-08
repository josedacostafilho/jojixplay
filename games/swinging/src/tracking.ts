import type { TrackedHand } from "@jojixplay/game-sdk";
import type { Side } from "./physics";

export const sides = ["left", "right"] as const;
export type TrackedHands = Readonly<Record<Side, TrackedHand | null>>;

/** Observation ownership and availability have no dependency on gesture recognition. */
export class SwingTracking {
  readonly hands: Record<Side, TrackedHand | null> = { left: null, right: null };
  get detected() {
    return sides.some((side) => this.hands[side] !== null);
  }
  reset() {
    for (const side of sides) this.hands[side] = null;
  }
  sample(observations: readonly TrackedHand[]) {
    const hands = observations.filter((hand) => hand.landmarks[0]);
    const cost = (side: Side, hand: TrackedHand) => {
      const wrist = hand.landmarks[0];
      if (!wrist) return Infinity;
      const previous = this.hands[side]?.landmarks[0];
      return previous
        ? Math.hypot(wrist.x - previous.x, wrist.y - previous.y)
        : Math.hypot(wrist.x - (side === "left" ? 0.7 : 0.3), wrist.y - 0.5);
    };
    const first = hands[0],
      second = hands[1];
    const assigned: Partial<Record<Side, TrackedHand>> = {};
    if (first && second) {
      if (
        cost("left", first) + cost("right", second) <=
        cost("right", first) + cost("left", second)
      ) {
        assigned.left = first;
        assigned.right = second;
      } else {
        assigned.left = second;
        assigned.right = first;
      }
    } else if (first)
      assigned[cost("left", first) <= cost("right", first) ? "left" : "right"] = first;
    for (const side of sides) this.hands[side] = assigned[side] ?? null;
  }
}

import { expect, it } from "vitest";
import { projectHand } from "../src/hand-view";
import { studioHand } from "../src/studio-hand";
import { HandControl } from "../src/gestures";

it("places open-hand aim on the mirrored index fingertip without calibration or half-screen limits", () => {
  const hand = studioHand(0.3, 0.5, false);
  const control = new HandControl("left");
  control.sample(hand, 0);
  expect(control.aim.x).toBeCloseTo(1 - (hand.landmarks[8]?.x ?? 0));
  expect(control.aim.y).toBeCloseTo(hand.landmarks[8]?.y ?? 0);
});
it("keeps a detected hand at the viewport edge without flattening its fingers", () => {
  const hand = studioHand(0.99, 0.02, false);
  const points = projectHand(hand);
  for (const p of points) {
    expect(p.x).toBeGreaterThanOrEqual(0.04 - 1e-8);
    expect(p.x).toBeLessThanOrEqual(0.96 + 1e-8);
    expect(p.y).toBeGreaterThanOrEqual(0.04 - 1e-8);
    expect(p.y).toBeLessThanOrEqual(0.96 + 1e-8);
  }
  expect((points[8]?.y ?? 0) - (points[5]?.y ?? 0)).toBeCloseTo(-0.06);
});
it("reverses hand depth for the player's first-person view", () => {
  const points = projectHand(studioHand(0.7, 0.5, true));
  expect(points[8]?.z).toBeLessThan(points[5]?.z ?? 0);
});

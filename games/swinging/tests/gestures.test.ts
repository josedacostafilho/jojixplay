import type { TrackedHand } from "@jojixplay/game-sdk";
import { SwingTracking } from "../src/tracking";
import { describe, expect, it } from "vitest";
import { HandControl, handShape, SwingGestures } from "../src/gestures";
import { studioHand } from "../src/studio-hand";

describe("hand controls", () => {
  it.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])(
    "recognizes curl after rotation by %s, including depth rotations",
    (angle) => {
      for (const closed of [false, true]) {
        const hand = studioHand(0.7, 0.5, closed);
        for (const axis of ["z", "x"] as const) {
          const rotated = hand.worldLandmarks.map((p) =>
            axis === "z"
              ? {
                  x: p.x * Math.cos(angle) - p.y * Math.sin(angle),
                  y: p.x * Math.sin(angle) + p.y * Math.cos(angle),
                  z: p.z,
                }
              : {
                  x: p.x,
                  y: p.y * Math.cos(angle) - p.z * Math.sin(angle),
                  z: p.y * Math.sin(angle) + p.z * Math.cos(angle),
                },
          );
          expect(handShape({ ...hand, worldLandmarks: rotated })).toBe(closed ? "closed" : "open");
        }
      }
    },
  );
  it("requires an open hand, freezes aim during closure, fires once and releases on opening", () => {
    const control = new HandControl("left");
    control.sample(studioHand(0.7, 0.5, true), 0);
    control.sample(studioHand(0.7, 0.5, true), 100);
    expect(control.fired).toBe(false);
    control.sample(studioHand(0.65, 0.4, false), 150);
    control.sample(studioHand(0.65, 0.4, false), 250);
    expect(control.aim.x).toBeGreaterThan(0.27);
    expect(control.aim.y).toBeLessThan(0.4);
    const aim = { ...control.aim };
    control.sample(studioHand(0.8, 0.6, true), 300);
    control.sample(studioHand(0.8, 0.6, true), 400);
    expect(control.fired).toBe(true);
    expect(control.aim).toEqual(aim);
    control.sample(studioHand(0.8, 0.6, true), 420);
    expect(control.fired).toBe(false);
    control.sample(studioHand(0.8, 0.6, false), 450);
    control.sample(studioHand(0.8, 0.6, false), 550);
    expect(control.closed).toBe(false);
  });
  it("ignores a one-frame fist but accepts a sustained closure", () => {
    const control = new HandControl("left");
    control.sample(studioHand(0.7, 0.5, false), 0);
    control.sample(studioHand(0.7, 0.5, false), 100);
    control.sample(studioHand(0.7, 0.5, true), 130);
    control.sample(studioHand(0.7, 0.5, false), 160);
    expect(control.fired).toBe(false);
    control.sample(studioHand(0.7, 0.5, true), 200);
    control.sample(studioHand(0.7, 0.5, true), 300);
    expect(control.closed).toBe(true);
  });
  it("preserves hand ownership across array reordering and crossing, including close wrists", () => {
    const gestures = new SwingGestures();
    const tracking = new SwingTracking();
    const sample = (hands: TrackedHand[], time: number) => {
      tracking.sample(hands);
      gestures.sample(tracking.hands, time);
    };
    sample([studioHand(0.7, 0.5, false), studioHand(0.3, 0.5, false)], 0);
    sample([studioHand(0.3, 0.5, false), studioHand(0.7, 0.5, false)], 100);
    sample([studioHand(0.55, 0.4, true), studioHand(0.45, 0.6, false)], 150);
    sample([studioHand(0.4, 0.4, true), studioHand(0.6, 0.6, false)], 250);
    expect(gestures.hands.left.closed).toBe(true);
    expect(gestures.hands.right.closed).toBe(false);
    sample([studioHand(0.5, 0.5, true), studioHand(0.51, 0.5, false)], 300);
    expect(gestures.hands.left.closed).toBe(true);
    expect(tracking.hands.right).not.toBeNull();
  });
  it("allows a gradual closure through the uncertain curl band", () => {
    const control = new HandControl("left");
    const open = studioHand(0.7, 0.5, false);
    control.sample(open, 0);
    control.sample(open, 100);
    const half = {
      ...open,
      worldLandmarks: open.worldLandmarks.map((p, i) => {
        if ([7, 11, 15, 19].includes(i))
          return { ...p, y: -0.06 - Math.cos(0.7) * 0.02, z: -Math.sin(0.7) * 0.02 };
        return p;
      }),
    };
    expect(handShape(half)).toBeNull();
    control.sample(half, 150);
    control.sample(half, 250);
    control.sample(half, 350);
    control.sample(studioHand(0.7, 0.5, true), 400);
    control.sample(studioHand(0.7, 0.5, true), 500);
    expect(control.fired).toBe(true);
    control.sample(half, 600);
    control.sample(half, 900);
    expect(control.closed).toBe(true);
    control.sample(open, 1000);
    control.sample(open, 1100);
    expect(control.closed).toBe(false);
  });
});
it("keeps two detected hands when their wrists are close", () => {
  const tracking = new SwingTracking();
  tracking.sample([studioHand(0.5, 0.5, false), studioHand(0.51, 0.5, false)]);
  expect(tracking.hands.left).not.toBeNull();
  expect(tracking.hands.right).not.toBeNull();
});
it("removes only the missing hand as soon as a new result omits it", () => {
  const tracking = new SwingTracking();
  tracking.sample([studioHand(0.7, 0.5, false), studioHand(0.3, 0.5, false)]);
  tracking.sample([studioHand(0.3, 0.5, false)]);
  expect(tracking.hands.left).toBeNull();
  expect(tracking.hands.right).not.toBeNull();
});

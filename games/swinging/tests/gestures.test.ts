import type { Body, Joint } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { SwingGestures } from "../src/gestures";

const joint = (x: number, y: number): Joint => ({ x, y, z: 0, confidence: 1 });
function body(drop = 0, left = false, right = false): Body {
  return {
    leftShoulder: joint(0.4, 0.3 + drop),
    rightShoulder: joint(0.6, 0.3 + drop),
    leftHip: joint(0.43, 0.55 + drop),
    rightHip: joint(0.57, 0.55 + drop),
    leftElbow: joint(0.35, (left ? 0.25 : 0.42) + drop),
    rightElbow: joint(0.65, (right ? 0.25 : 0.42) + drop),
    leftWrist: joint(0.3, (left ? 0.18 : 0.52) + drop),
    rightWrist: joint(0.7, (right ? 0.18 : 0.52) + drop),
  };
}
const feed = (
  gestures: SwingGestures,
  from: number,
  to: number,
  pose: Body | null,
  enabled = true,
) => {
  let jumps = 0;
  for (let now = from; now <= to; now += 20) {
    gestures.sample(pose, now, enabled);
    jumps += Number(gestures.jumped);
  }
  return jumps;
};

it("keeps a raised arm through wrist occlusion using the elbow, then lowers it independently", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 120, body());
  feed(gestures, 140, 260, body(0, true));
  expect(gestures.arms.left).toBe(true);
  const { leftWrist: _missing, ...elbowOnly } = body(0, true);
  feed(gestures, 280, 800, elbowOnly);
  expect(gestures.arms.left).toBe(true);
  expect(gestures.tracking).toBe(true);
  feed(gestures, 820, 940, body(0, false));
  expect(gestures.arms.left).toBe(false);
  expect(gestures.arms.right).toBe(false);
});

it("never treats arm-only motion as jump or a body dip as arm release", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 320, body());
  expect(feed(gestures, 340, 700, body(0, true, true))).toBe(0);
  expect(gestures.arms).toEqual({ left: true, right: true });
  expect(feed(gestures, 720, 900, body(0.06, true, true))).toBe(0);
  expect(feed(gestures, 920, 1080, body(0, true, true))).toBe(1);
  expect(gestures.arms).toEqual({ left: true, right: true });
  expect(feed(gestures, 1100, 1300, body(0, true, true))).toBe(0);
});

it("does not turn the start crouch, missing hips or tracking recovery into a jump", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 200, body(), false);
  expect(feed(gestures, 220, 3300, body(0.08), false)).toBe(0);
  expect(feed(gestures, 3320, 3500, body(), true)).toBe(0);
  const { leftHip: _left, rightHip: _right, ...noHips } = body(0.06);
  expect(feed(gestures, 3520, 3700, noHips)).toBe(0);
  feed(gestures, 3720, 4000, body(0, true));
  expect(gestures.arms.left).toBe(true);
  feed(gestures, 4020, 4260, null);
  expect(gestures.tracking).toBe(false);
  expect(gestures.arms.left).toBe(false);
  expect(feed(gestures, 4280, 4580, body(0, true))).toBe(0);
  expect(gestures.arms.left).toBe(true);
});

it("rejects a one-frame dip followed by a delayed return", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 320, body());
  gestures.sample(body(0.06), 340, true);
  feed(gestures, 360, 620, body(0.03));
  expect(feed(gestures, 640, 800, body())).toBe(0);
});

it("calibrates standing after the three-second starting crouch before accepting a new jump", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 3000, body(0.08), false);
  expect(feed(gestures, 3020, 3600, body(0.08))).toBe(0);
  expect(feed(gestures, 3620, 4040, body())).toBe(0);
  expect(feed(gestures, 4060, 4220, body(0.06))).toBe(0);
  expect(feed(gestures, 4240, 4360, body())).toBe(1);
});

it("resets jump evidence when torso visibility changes without resetting a visible arm", () => {
  const gestures = new SwingGestures();
  feed(gestures, 0, 320, body(0, true));
  const { rightShoulder: _shoulder, rightHip: _hip, ...oneSide } = body(0.06, true);
  expect(feed(gestures, 340, 500, oneSide)).toBe(0);
  expect(feed(gestures, 520, 680, body(0, true))).toBe(0);
  expect(gestures.arms.left).toBe(true);
});

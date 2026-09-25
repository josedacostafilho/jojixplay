import { expect, it } from "vitest";
import { CameraMotion } from "../src/camera-motion";
import { matchesPose, Movement, normalizePose, POSES } from "../src/movement";
import { body } from "./fixtures";
it("recognizes a rough crouch, generous center, and one jump; jitter and standing from a crouch do not jump", () => {
  const m = new Movement();
  let jumps = 0;
  for (let t = 0; t < 1500; t += 33) {
    m.sample(body({ lift: Math.sin(t) * 0.012 }), 16 / 9, t);
    jumps += Number(m.jumped);
  }
  expect(jumps).toBe(0);
  m.sample(body({ duck: true, x: 0.2 }), 16 / 9, 1530);
  expect(m.centered).toBe(true);
  expect(m.crouched).toBe(true);
  for (let t = 1560; t < 2500; t += 33) {
    m.sample(body(), 16 / 9, t);
    expect(m.jumped).toBe(false);
  }
  for (let t = 2500; t < 3300; t += 33) {
    m.sample(body({ lift: 0.12 }), 16 / 9, t);
    jumps += Number(m.jumped);
  }
  expect(jumps).toBe(1);
  m.sample(body({ x: 0.05 }), 16 / 9, 3330);
  expect(m.centered).toBe(false);
});
it("can start already crouching and uses torso displacement when lower joints disappear", () => {
  const m = new Movement();
  m.sample(body({ duck: true }), 16 / 9, 0);
  expect(m.crouched).toBe(true);
  m.reset();
  // Explicitly retain present named joints, without synthesizing missing legs.
  const standing = body(),
    crouching = body({ duck: true });
  if (!standing.leftShoulder || !crouching.leftShoulder) throw new Error("fixture");
  for (let t = 0; t < 600; t += 33) m.sample({ leftShoulder: standing.leftShoulder }, 16 / 9, t);
  for (let t = 600; t < 900; t += 33) m.sample({ leftShoulder: crouching.leftShoulder }, 16 / 9, t);
  expect(m.crouched).toBe(true);
  expect(m.skeleton.leftAnkle).toBeUndefined();
});
it("normalizes body proportions and position, keeps missing limbs absent, and requires both observed arms", () => {
  for (const pose of POSES) {
    const original = body({ pose, x: 0.3 });
    const scaled = Object.fromEntries(
      Object.entries(original).map(([k, p]) => [
        k,
        { ...p, x: 0.5 + (p.x - 0.3) * 0.6, y: 0.2 + p.y * 0.6 },
      ]),
    );
    expect(matchesPose(normalizePose(original, 16 / 9), pose)).toBe(true);
    expect(matchesPose(normalizePose(scaled, 16 / 9), pose)).toBe(true);
    const { leftWrist: _wrist, leftAnkle: _ankle, ...partial } = original;
    const skeleton = normalizePose(partial, 16 / 9);
    expect(skeleton.leftWrist).toBeUndefined();
    expect(skeleton.leftAnkle).toBeUndefined();
    expect(matchesPose(skeleton, pose)).toBe(false);
  }
  expect(matchesPose(normalizePose(body(), 16 / 9), "asas")).toBe(false);
});
it("camera uses one bounded smooth arc and eased accepted crouching, with a stable horizon", () => {
  const camera = new CameraMotion();
  let previous = 2.45;
  let peak = previous;
  for (let t = 0; t <= 2600; t += 16) {
    const y = camera.update(t, false, t >= 200 ? 1 : 0, true, false);
    expect(Math.abs(y - previous)).toBeLessThan(0.13);
    previous = y;
    peak = Math.max(peak, y);
  }
  expect(peak).toBeGreaterThan(3.4);
  expect(previous).toBeCloseTo(2.45, 1);
  for (let t = 2616; t < 3700; t += 16) {
    const y = camera.update(t, true, 1, true, false);
    expect(Math.abs(y - previous)).toBeLessThan(0.1);
    previous = y;
  }
  expect(previous).toBeCloseTo(1.25, 1);
  for (let t = 3700; t < 4800; t += 16) previous = camera.update(t, true, 1, false, false);
  expect(previous).toBeCloseTo(2.45, 1);
});

it("ignores a single upward outlier instead of throwing the camera into a jump", () => {
  const movement = new Movement();
  for (let t = 0; t < 1000; t += 20) movement.sample(body(), 16 / 9, t);
  movement.sample(body({ lift: 0.19 }), 16 / 9, 1000);
  expect(movement.jumped).toBe(false);
  for (let t = 1020; t < 1500; t += 20) {
    movement.sample(body(), 16 / 9, t);
    expect(movement.jumped).toBe(false);
  }
});
it("does not create a phantom jump when replay resets the gesture counter", () => {
  const motion = new CameraMotion();
  for (let t = 0; t <= 2600; t += 20) motion.update(t, false, 1, true, false);
  for (let t = 2620; t < 3500; t += 20)
    expect(motion.update(t, false, 0, true, false)).toBeCloseTo(2.45, 1);
});

it("can jump after arriving already crouched and then standing up", () => {
  const movement = new Movement();
  for (let t = 0; t < 3200; t += 20) movement.sample(body({ duck: true }), 16 / 9, t);
  for (let t = 3200; t < 4400; t += 20) {
    movement.sample(body(), 16 / 9, t);
    expect(movement.jumped).toBe(false);
  }
  let jumps = 0;
  for (let t = 4400; t < 4800; t += 20) {
    movement.sample(body({ lift: 0.12 }), 16 / 9, t);
    jumps += Number(movement.jumped);
  }
  expect(jumps).toBe(1);
});

it("clears the previous body scale when tracking history resets", () => {
  const movement = new Movement();
  const joint = (y: number) => ({ x: 0.5, y, z: 0, confidence: 1 });
  movement.sample({ leftShoulder: joint(0.2), leftHip: joint(0.6) }, 16 / 9, 0);
  movement.reset();
  for (let t = 0; t < 500; t += 20) movement.sample({ leftShoulder: joint(0.3) }, 16 / 9, t);
  for (let t = 500; t < 800; t += 20) movement.sample({ leftShoulder: joint(0.38) }, 16 / 9, t);
  expect(movement.crouched).toBe(true);
});

it("matches both anatomical shoulder orders and keeps the mirrored preview arms on their observed sides", () => {
  for (const pose of POSES) {
    const input = body({ pose });
    const reversed = Object.fromEntries(
      Object.entries(input).map(([name, p]) => [name, { ...p, x: 1 - p.x }]),
    );
    for (const candidate of [input, reversed]) {
      const skeleton = normalizePose(candidate, 16 / 9);
      expect(matchesPose(skeleton, pose)).toBe(true);
      const shoulder = candidate.leftShoulder,
        wrist = candidate.leftWrist;
      if (!shoulder || !wrist || !skeleton.leftShoulder || !skeleton.leftWrist)
        throw new Error("fixture");
      expect(Math.sign(skeleton.leftWrist.x)).toBe(Math.sign(0.5 - wrist.x));
      expect(Math.sign(skeleton.leftShoulder.x)).toBe(Math.sign(0.5 - shoulder.x));
    }
  }
});

it("keeps an accepted jump airborne beyond one second", () => {
  const motion = new CameraMotion();
  for (let t = 0; t <= 1300; t += 20) motion.update(t, false, 1, true, false);
  expect(motion.height).toBeGreaterThan(3);
});

it("does not turn a single downward tracking outlier into a symbolic jump", () => {
  const movement = new Movement();
  for (let t = 0; t < 1000; t += 20) movement.sample(body(), 16 / 9, t, true);
  movement.sample(body({ lift: -0.19 }), 16 / 9, 1000, true);
  for (let t = 1020; t < 1800; t += 20) {
    movement.sample(body(), 16 / 9, t, true);
    expect(movement.jumped).toBe(false);
  }
});

it("accepts a small dip and return without feet leaving the floor", () => {
  const movement = new Movement();
  let jumps = 0;
  for (let t = 0; t < 1600; t += 20) {
    movement.sample(body({ lift: t >= 600 && t < 1000 ? -0.06 : 0 }), 16 / 9, t, true);
    jumps += Number(movement.jumped);
  }
  expect(jumps).toBe(1);
});

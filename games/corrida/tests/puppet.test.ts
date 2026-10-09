import type { Body } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { calibrate, canStart, PuppetReader, preview, TUNING } from "../src/puppet";

const ASPECT = 16 / 9;
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });

/**
 * A person facing the camera. `half` is half their shoulder width as a share of the view's width,
 * so a smaller number is a smaller or more distant person. Their left is the camera's right.
 */
function person({
  x = 0.5,
  half = 0.05,
  drop = 0,
  shoulderShift = 0,
  hips = true,
}: {
  x?: number;
  half?: number;
  /** Shoulders lowered, as a share of the torso's length. */
  drop?: number;
  /** Shoulders moved sideways without the hips: a lean. */
  shoulderShift?: number;
  hips?: boolean;
} = {}): Body {
  const torso = half * 2 * ASPECT * 1.4;
  const shoulderY = 0.3 + drop * torso;
  return {
    leftShoulder: joint(x + half + shoulderShift, shoulderY),
    rightShoulder: joint(x - half + shoulderShift, shoulderY),
    ...(hips
      ? {
          leftHip: joint(x + half * 0.7, 0.3 + torso),
          rightHip: joint(x - half * 0.7, 0.3 + torso),
        }
      : {}),
  };
}
function reader(start: Body = person()) {
  const calibration = calibrate(start, ASPECT);
  if (!calibration) throw new Error("Could not calibrate");
  return new PuppetReader(calibration);
}

it("starts a run only with both shoulders seen in the central half of the view", () => {
  expect(canStart(person({ x: 0.5 }))).toBe(true);
  expect(canStart(person({ x: 0.26 }))).toBe(true);
  expect(canStart(person({ x: 0.2 }))).toBe(false);
  expect(canStart({ leftShoulder: joint(0.5, 0.3) })).toBe(false);
  expect(calibrate(person({ x: 0.9 }), ASPECT)).toBeNull();
});

it("gives a child and an adult the same avatar movement for a step of their own size", () => {
  for (const half of [0.025, 0.05, 0.08]) {
    const run = reader(person({ half }));
    // One lane is a fixed number of the player's own shoulder widths.
    const step = half * 2 * TUNING.lanePerShoulder;
    // Stepping to the player's left moves them right in the camera, and the avatar screen-left.
    const moved = run.read(person({ half, x: 0.5 + step }), ASPECT);
    expect(moved.offset).toBeCloseTo(-1);
    expect(moved.lane).toBe(-1);
    expect(run.read(person({ half, x: 0.5 - step }), ASPECT).lane).toBe(1);
  }
});

it("narrows the lanes so all three fit in the view when the player starts off-centre", () => {
  const start = person({ x: 0.28, half: 0.08 });
  const calibration = calibrate(start, ASPECT);
  if (!calibration) throw new Error("Could not calibrate");
  expect(calibration.laneWidth).toBeLessThan(0.08 * 2 * TUNING.lanePerShoulder);
  expect(calibration.centerX - 1.5 * calibration.laneWidth).toBeGreaterThanOrEqual(
    TUNING.edgeMargin - 1e-9,
  );
});

it("changes lane only on a clear step and stops the avatar at the road's edge", () => {
  const run = reader();
  const lane = 0.05 * 2 * TUNING.lanePerShoulder;
  const at = (lanes: number) => run.read(person({ x: 0.5 - lanes * lane }), ASPECT);
  // Wavering about the boundary between two lanes changes nothing.
  for (const lanes of [0.45, 0.58, 0.47, 0.6, 0.5]) expect(at(lanes).lane).toBe(0);
  expect(at(0.7).lane).toBe(1);
  for (const lanes of [0.55, 0.42, 0.5]) expect(at(lanes).lane).toBe(1);
  expect(at(0.3).lane).toBe(0);
  // The avatar itself follows every bit of the way, until the road ends.
  expect(at(0.3).offset).toBeCloseTo(0.3);
  expect(at(4).offset).toBe(1.5);
  expect(at(4).lane).toBe(1);
});

it("reads the lane from the hips, so leaning the torso does not change lane", () => {
  const run = reader();
  const leaning = run.read(person({ shoulderShift: 0.09 }), ASPECT);
  expect(leaning.lane).toBe(0);
  expect(leaning.offset).toBeCloseTo(0);
  // The player's shoulders went to their left: the avatar leans to the screen's left.
  expect(leaning.lean).toBeLessThan(-0.3);
  expect(run.read(person({ shoulderShift: -0.09 }), ASPECT).lean).toBeGreaterThan(0.3);
  // With hips out of view the shoulders decide where the player stands.
  const blind = reader(person({ hips: false }));
  expect(blind.read(person({ hips: false, x: 0.3 }), ASPECT).lane).toBe(1);
});

it("measures a crouch against the player's own torso and does not flicker at the threshold", () => {
  for (const half of [0.025, 0.08]) {
    const run = reader(person({ half }));
    const at = (drop: number) => run.read(person({ half, drop }), ASPECT);
    expect(at(0).crouch).toBe(0);
    expect(at(0.3).crouch).toBeCloseTo(0.5);
    expect(at(0.9).crouch).toBe(1);
    expect(at(0.9).ducked).toBe(true);
    // Rising a little keeps the duck; standing nearly up ends it.
    expect(at(0.25).ducked).toBe(true);
    expect(at(0.1).ducked).toBe(false);
    expect(at(0.25).ducked).toBe(false);
  }
});

it("copies each arm the camera sees by the player's own side, seen from behind", () => {
  const body: Body = {
    ...person(),
    // The player's left arm straight out to their left, their right arm straight up.
    leftElbow: joint(0.62, 0.3),
    leftWrist: joint(0.7, 0.3),
    rightElbow: joint(0.45, 0.18),
  };
  const { arms } = preview(body, ASPECT);
  expect(arms.left?.upper.x).toBeCloseTo(-1);
  expect(arms.left?.upper.y).toBeCloseTo(0);
  expect(arms.left?.lower?.x).toBeCloseTo(-1);
  expect(arms.right?.upper.x).toBeCloseTo(0);
  expect(arms.right?.upper.y).toBeCloseTo(1);
  // A forearm that is not seen is not invented.
  expect(arms.right?.lower).toBeNull();
  expect(preview(person(), ASPECT).arms).toEqual({ left: null, right: null });
});

it("warns before the player walks out of the camera's view", () => {
  const run = reader();
  expect(run.read(person({ x: 0.5 }), ASPECT).nearEdge).toBe(false);
  expect(run.read(person({ x: 0.03 }), ASPECT).nearEdge).toBe(true);
  expect(run.read(person({ x: 0.97 }), ASPECT).nearEdge).toBe(true);
});

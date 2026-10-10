import type { Body, WorldBody } from "@jojixplay/game-sdk";
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
/**
 * The same person in their own space: as the picture shows them, about life size and flat. A
 * `reach` moves an arm's elbow and wrist that many metres nearer the camera.
 */
function own(body: Body, reach: Partial<Record<"left" | "right", number>> = {}): WorldBody {
  const world: Record<string, { x: number; y: number; z: number; confidence: number }> = {};
  for (const [name, at] of Object.entries(body))
    world[name] = { x: at.x * 2 * ASPECT, y: at.y * 2, z: 0, confidence: 1 };
  for (const side of ["left", "right"] as const) {
    const forward = reach[side];
    const shoulder = world[`${side}Shoulder`];
    if (forward === undefined || !shoulder) continue;
    world[`${side}Elbow`] = { ...shoulder, y: shoulder.y + 0.1, z: -forward / 2 };
    world[`${side}Wrist`] = { ...shoulder, y: shoulder.y + 0.1, z: -forward };
  }
  return world;
}
/** Readings come 50 ms apart unless a test says otherwise. */
let clock = 0;
const later = (ms = 50) => {
  clock += ms;
  return clock;
};
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
    const moved = run.read(
      person({ half, x: 0.5 + step }),
      own(person({ half, x: 0.5 + step })),
      ASPECT,
      later(),
    );
    expect(moved.offset).toBeCloseTo(-1);
    expect(moved.lane).toBe(-1);
    expect(
      run.read(
        person({ half, x: 0.5 - step }),
        own(person({ half, x: 0.5 - step })),
        ASPECT,
        later(),
      ).lane,
    ).toBe(1);
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
  const at = (lanes: number) =>
    run.read(
      person({ x: 0.5 - lanes * lane }),
      own(person({ x: 0.5 - lanes * lane })),
      ASPECT,
      later(),
    );
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
  const leaning = run.read(
    person({ shoulderShift: 0.09 }),
    own(person({ shoulderShift: 0.09 })),
    ASPECT,
    later(),
  );
  expect(leaning.lane).toBe(0);
  expect(leaning.offset).toBeCloseTo(0);
  // The player's shoulders went to their left: the avatar leans to the screen's left.
  expect(leaning.lean).toBeLessThan(-0.3);
  expect(
    run.read(
      person({ shoulderShift: -0.09 }),
      own(person({ shoulderShift: -0.09 })),
      ASPECT,
      later(),
    ).lean,
  ).toBeGreaterThan(0.3);
  // With hips out of view the shoulders decide where the player stands.
  const blind = reader(person({ hips: false }));
  expect(
    blind.read(
      person({ hips: false, x: 0.3 }),
      own(person({ hips: false, x: 0.3 })),
      ASPECT,
      later(),
    ).lane,
  ).toBe(1);
});

it("measures a crouch against the player's own torso and does not flicker at the threshold", () => {
  for (const half of [0.025, 0.08]) {
    const run = reader(person({ half }));
    const at = (drop: number) =>
      run.read(person({ half, drop }), own(person({ half, drop })), ASPECT, later());
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

it("still reads a crouch when it hides the shoulders, and keeps it when it hides everything", () => {
  const standing: Body = { ...person(), nose: joint(0.5, 0.2) };
  const run = reader(standing);
  const torso = 0.05 * 2 * ASPECT * 1.4;
  const down = 0.5 * torso;
  // Knees and arms cover the torso in a deep crouch: one shoulder goes, then both.
  const oneShoulder: Body = { leftShoulder: joint(0.55, 0.3 + down), nose: joint(0.5, 0.2 + down) };
  expect(run.read(oneShoulder, own(oneShoulder), ASPECT, later()).ducked).toBe(true);
  const headOnly: Body = { nose: joint(0.5, 0.2 + down) };
  expect(run.read(headOnly, own(headOnly), ASPECT, later()).crouch).toBeGreaterThan(0.8);
  // Lying on the floor, out of the camera's sight: still as low as last seen.
  expect(run.read({}, own({}), ASPECT, later()).ducked).toBe(true);
  expect(run.read({}, own({}), ASPECT, later()).crouch).toBeGreaterThan(0.8);
  // Standing up again is seen at once.
  expect(run.read(standing, own(standing), ASPECT, later()).ducked).toBe(false);
});

it("reads a jump only when head and shoulders all rise, and not from standing up or raised arms", () => {
  const torso = 0.05 * 2 * ASPECT * 1.4;
  const standing: Body = { ...person(), nose: joint(0.5, 0.2) };
  const run = reader(standing);
  const risen = (by: number): Body => ({
    ...person({ drop: -by }),
    nose: joint(0.5, 0.2 - by * torso),
  });
  expect(run.read(standing, own(standing), ASPECT, later()).jumping).toBe(false);
  expect(run.read(risen(0.2), own(risen(0.2)), ASPECT, later()).rise).toBeCloseTo(0.2);
  expect(run.read(risen(0.2), own(risen(0.2)), ASPECT, later()).jumping).toBe(true);
  // Coming down, the jump lasts until the player is nearly back on the ground.
  expect(run.read(risen(0.08), own(risen(0.08)), ASPECT, later()).jumping).toBe(true);
  expect(run.read(risen(0.02), own(risen(0.02)), ASPECT, later()).jumping).toBe(false);
  expect(run.read(risen(0.08), own(risen(0.08)), ASPECT, later()).jumping).toBe(false);
  // Standing up out of a crouch only comes back to standing height.
  run.read(person({ drop: 0.5 }), own(person({ drop: 0.5 })), ASPECT, later());
  expect(run.read(standing, own(standing), ASPECT, later()).jumping).toBe(false);
  // Raised arms shrug the shoulders up while the head stays where it was.
  const shrugged: Body = { ...person({ drop: -0.2 }), nose: joint(0.5, 0.2) };
  expect(run.read(shrugged, own(shrugged), ASPECT, later()).rise).toBe(0);
  // A player the camera cannot see is not in the air.
  run.read(risen(0.2), own(risen(0.2)), ASPECT, later());
  expect(run.read({}, own({}), ASPECT, later()).jumping).toBe(false);
});

it("copies each arm the camera sees by the player's own side, seen from behind", () => {
  const body: Body = {
    ...person(),
    // The player's left arm straight out to their left, their right arm straight up.
    leftElbow: joint(0.62, 0.3),
    leftWrist: joint(0.7, 0.3),
    rightElbow: joint(0.45, 0.18),
  };
  const { arms } = preview(body, own(body), ASPECT);
  expect(arms.left?.upper.x).toBeCloseTo(-1);
  expect(arms.left?.upper.y).toBeCloseTo(0);
  expect(arms.left?.lower?.x).toBeCloseTo(-1);
  expect(arms.right?.upper.x).toBeCloseTo(0);
  expect(arms.right?.upper.y).toBeCloseTo(1);
  // A forearm that is not seen is not invented.
  expect(arms.right?.lower).toBeNull();
  expect(preview(person(), own(person()), ASPECT).arms).toEqual({ left: null, right: null });
});

it("copies arms and torso in depth: towards the camera is forwards for the avatar", () => {
  const forward = preview(person(), own(person(), { right: 0.5 }), ASPECT);
  // The player's right arm straight out at the camera points down the road.
  expect(forward.arms.right?.lower?.z).toBeCloseTo(1);
  expect(forward.arms.right?.lower?.x).toBeCloseTo(0);
  expect(forward.arms.left).toBeNull();

  const upright = own(person());
  expect(preview(person(), upright, ASPECT).pitch).toBeCloseTo(0);
  // Shoulders nearer the camera than the hips: leaning forward, and only so far.
  const leaning = (by: number): WorldBody => ({
    ...upright,
    leftShoulder: { x: 0, y: 0, z: -by, confidence: 1 },
    rightShoulder: { x: 0, y: 0, z: -by, confidence: 1 },
    leftHip: { x: 0, y: 0.5, z: 0, confidence: 1 },
    rightHip: { x: 0, y: 0.5, z: 0, confidence: 1 },
  });
  expect(preview(person(), leaning(0.5), ASPECT).pitch).toBeCloseTo(Math.PI / 4);
  expect(preview(person(), leaning(5), ASPECT).pitch).toBe(TUNING.pitch.forward);
  expect(preview(person(), leaning(-0.1), ASPECT).pitch).toBeLessThan(0);
});

it("reads a punch as a wrist moving quickly forward, wherever it starts, and once until it comes back", () => {
  const run = reader();
  const at = (reach: Partial<Record<"left" | "right", number>>, ms = 50) =>
    run.read(person(), own(person(), reach), ASPECT, later(ms));
  // In `own`, a wrist 0.2 m forward on this arm is about 83% of the arm's length; 0.06 m, 45%.
  expect(at({ right: 0.01 }).thrown).toEqual({ left: false, right: false });
  const jab = at({ right: 0.2 });
  expect(jab.thrown).toEqual({ left: false, right: true });
  expect(jab.lastPunch?.side).toBe("right");
  expect(jab.lastPunch?.rise).toBeGreaterThan(0.6);
  expect(jab.lastPunch?.ms).toBe(50);
  // Held out, it is not thrown again.
  expect(at({ right: 0.2 }).thrown.right).toBe(false);
  expect(at({ right: 0.21 }, 400).thrown.right).toBe(false);

  // From fists held up in front, a jab counts just the same, as soon as the arm has come back.
  at({ right: 0.06 }, 400);
  at({ right: 0.06 });
  expect(at({ right: 0.2 }).thrown.right).toBe(true);
  // Without coming back, pushing a little further is still the same punch.
  expect(at({ right: 0.25 }).thrown.right).toBe(false);

  // Reaching out slowly is not a punch.
  const slow = reader();
  for (const reach of [0.01, 0.02, 0.03, 0.04, 0.06, 0.08, 0.11, 0.15, 0.2])
    expect(
      slow.read(person(), own(person(), { left: reach }), ASPECT, later(200)).thrown.left,
    ).toBe(false);

  // An arm the camera cannot see whole tells nothing, and the same reading twice changes nothing.
  const twice = reader();
  const once = later();
  twice.read(person(), own(person(), { left: 0.01 }), ASPECT, once);
  expect(twice.read(person(), own(person()), ASPECT, later()).reach.left).toBeNull();
  const now = later();
  expect(twice.read(person(), own(person(), { left: 0.2 }), ASPECT, now).thrown.left).toBe(true);
  expect(twice.read(person(), own(person(), { left: 0.2 }), ASPECT, now).thrown.left).toBe(false);
});

it("warns before the player walks out of the camera's view", () => {
  const run = reader();
  expect(run.read(person({ x: 0.5 }), own(person({ x: 0.5 })), ASPECT, later()).nearEdge).toBe(
    false,
  );
  expect(run.read(person({ x: 0.03 }), own(person({ x: 0.03 })), ASPECT, later()).nearEdge).toBe(
    true,
  );
  expect(run.read(person({ x: 0.97 }), own(person({ x: 0.97 })), ASPECT, later()).nearEdge).toBe(
    true,
  );
});

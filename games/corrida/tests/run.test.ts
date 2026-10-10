import type { Body, WorldBody } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { Course, extent, type Obstacle, RUN_IN } from "../src/course";
import { RULES, Run, type RunFrame, SETTLE_MS, TRIAL } from "../src/run";
import { BEAM_SPACING, LOG_HEIGHT, MONSTER, POOL_DEPTH, SPEED } from "../src/world";

const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
const person = (x = 0.5): Body => ({
  leftShoulder: joint(x + 0.05, 0.3),
  rightShoulder: joint(x - 0.05, 0.3),
  leftHip: joint(x + 0.04, 0.55),
  rightHip: joint(x - 0.04, 0.55),
});
/** Which arm, if any, a body made by `acting` is throwing straight out at the camera. */
const thrown = new WeakMap<Body, "left" | "right">();
/**
 * The same person in their own space: as the picture shows them, about life size, flat but for
 * a thrown arm, which the picture cannot show.
 */
function own(body: Body): WorldBody {
  const world: Record<string, { x: number; y: number; z: number; confidence: number }> = {};
  for (const [name, at] of Object.entries(body))
    world[name] = { x: at.x * 2 * (1280 / 720), y: at.y * 2, z: 0, confidence: 1 };
  const side = thrown.get(body);
  const shoulder = side ? world[`${side}Shoulder`] : undefined;
  if (side && shoulder) {
    world[`${side}Elbow`] = { ...shoulder, z: -0.28 };
    world[`${side}Wrist`] = { ...shoulder, z: -0.55 };
  }
  return world;
}
const frame = (now: number, bodies: Body[], epoch = 0): RunFrame => ({
  sequence: now,
  capturedAtMs: now,
  width: 1280,
  height: 720,
  epoch,
  bodies,
  worldBodies: bodies.map(own),
});
/** Feeds one reading every 50 ms and returns the time reached. */
function play(run: Run, from: number, forMs: number, bodies: Body[] | null, epoch = 0) {
  let now = from;
  for (; now <= from + forMs; now += 50) run.tick(now, bodies && frame(now, bodies, epoch));
  return now;
}

it("waits for the player to stand near the middle, then starts where they stand", () => {
  const run = new Run(1, TRIAL);
  run.tick(0, null);
  expect([run.phase, run.waitingFor]).toEqual(["waiting", "player"]);
  let now = play(run, 50, 500, [person(0.9)]);
  expect([run.phase, run.waitingFor]).toEqual(["waiting", "middle"]);
  // The avatar already copies the player before the run.
  expect(run.puppet).not.toBeNull();
  expect(run.distance).toBe(0);

  now = play(run, now, SETTLE_MS / 2, [person(0.4)]);
  expect(run.phase).toBe("settling");
  expect(run.settled).toBeGreaterThan(0.3);
  // Wandering off before the lanes are laid out starts the wait again.
  now = play(run, now, 100, [person(0.9)]);
  expect(run.settled).toBe(0);
  now = play(run, now, SETTLE_MS + 100, [person(0.4)]);
  expect(run.phase).toBe("running");
  expect(run.puppet?.lane).toBe(0);
  expect(run.puppet?.offset).toBeCloseTo(0);
});

it("does not start the wait again when tracking drops a reading while the player stands still", () => {
  const run = new Run(1, TRIAL);
  let now = play(run, 0, SETTLE_MS / 2, [person()]);
  expect(run.phase).toBe("settling");
  now = play(run, now, 200, null);
  expect(run.phase).toBe("settling");
  now = play(run, now, SETTLE_MS / 2, [person()]);
  expect(run.phase).toBe("running");

  // A real absence does start it again.
  const other = new Run(1, TRIAL);
  now = play(other, 0, SETTLE_MS / 2, [person()]);
  now = play(other, now, 600, null);
  expect(other.phase).toBe("waiting");
  play(other, now, SETTLE_MS / 2, [person()]);
  expect(other.phase).toBe("settling");
});

it("follows the person nearest the middle and runs at a steady pace", () => {
  const run = new Run(1, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [person(0.9), person(0.5)]);
  expect(run.phase).toBe("running");
  const before = run.distance;
  now = play(run, now, 1000, [person(0.9), person(0.5)]);
  expect(run.distance - before).toBeCloseTo(SPEED * 1.05, 1);
  expect(run.puppet?.lane).toBe(0);
});

it("keeps the avatar where it was through a short loss and starts over after a long one", () => {
  const run = new Run(1, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [person()]);
  now = play(run, now, 300, [person(0.35)]);
  expect(run.puppet?.lane).toBe(1);

  now = play(run, now, 1000, null);
  expect(run.phase).toBe("running");
  expect(run.tracking).toBe(false);
  expect(run.puppet?.lane).toBe(1);

  now = play(run, now, 6000, null);
  expect(run.phase).toBe("waiting");
  expect(run.distance).toBe(0);
  // A stale reading is not a player.
  run.tick(now + 1000, frame(now, [person()]));
  expect(run.tracking).toBe(false);
});

it("lays the lanes out again when the camera's own basis changes", () => {
  const run = new Run(1, TRIAL);
  const now = play(run, 0, SETTLE_MS + 100, [person()]);
  expect(run.phase).toBe("running");
  run.tick(now, frame(now, [person()], 1));
  expect(run.phase).not.toBe("running");
  expect(run.distance).toBe(0);
});

type Hands = "left" | "right" | "both" | null;
/** A person a step to one side, crouched, off the ground, or with hands straight up. */
function acting({
  lane = 0,
  crouched = false,
  air = false,
  hands = null,
  arms = true,
  punch = null,
}: {
  lane?: number;
  crouched?: boolean;
  air?: boolean;
  hands?: Hands;
  /** Whether the camera sees the arms at all. */
  arms?: boolean;
  /** An arm thrown straight out towards the camera. */
  punch?: "left" | "right" | null;
} = {}): Body {
  // One lane is 1.25 shoulder widths; the player's left is the camera's right.
  const x = 0.5 - lane * 0.125;
  // A jump lifts the whole body in the view; a crouch lowers the shoulders over the hips.
  const up = air ? 0.05 : 0;
  const drop = crouched ? 0.2 : 0;
  const body: Record<string, ReturnType<typeof joint>> = {
    leftShoulder: joint(x + 0.05, 0.3 + drop - up),
    rightShoulder: joint(x - 0.05, 0.3 + drop - up),
    leftHip: joint(x + 0.04, 0.55 - up),
    rightHip: joint(x - 0.04, 0.55 - up),
  };
  for (const side of ["left", "right"] as const) {
    const shoulder = body[`${side}Shoulder`];
    if (!shoulder || !arms) continue;
    const way = hands === side || hands === "both" ? -1 : 1;
    body[`${side}Elbow`] = joint(shoulder.x, shoulder.y + way * 0.1);
    body[`${side}Wrist`] = joint(shoulder.x, shoulder.y + way * 0.2);
  }
  if (punch) thrown.set(body, punch);
  return body;
}
/** What a careful player does for an obstacle that is `ahead` of them, in seconds of running. */
function clear(obstacle: Obstacle, ahead: number): Body {
  if (obstacle.kind === "block")
    return acting({
      lane: ([-1, 0, 1] as const).find((lane) => !obstacle.lanes.includes(lane)) ?? 0,
    });
  if (obstacle.kind === "beam") return acting({ crouched: true });
  if (obstacle.kind === "log") return acting({ air: ahead < 0.4 && ahead > 0.2 });
  if (obstacle.kind === "monster")
    return acting({
      punch: ahead < 0.25 && ahead > 0.1 ? (obstacle.lane === 1 ? "right" : "left") : null,
    });
  return acting({ hands: "both" });
}
/**
 * Runs up to the first obstacle of the wanted kind, clearing everything before it, and through
 * it doing `how`, which is told how many seconds of running ahead the obstacle starts.
 */
function meet(
  want: (obstacle: Obstacle) => boolean,
  how: (obstacle: Obstacle, ahead: number, run: Run) => Body,
  seed = 5,
) {
  const course = new Course(seed, TRIAL.seconds * SPEED);
  course.layTo(4000);
  const target = course.obstacles.find(want);
  if (!target) throw new Error("No such obstacle on this road");
  const run = new Run(seed, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  let hearts = run.hearts;
  let points = run.points;
  // Half a second on, whatever was begun at the obstacle is over.
  while (run.distance < target.at + extent(target) + 0.5 * SPEED) {
    const next = run.items.find((item) => item.state === "coming")?.obstacle;
    const near = run.distance >= target.at - 1.4 * SPEED;
    if (!near) {
      hearts = run.hearts;
      points = run.points;
    }
    const body = near
      ? how(target, (target.at - run.distance) / SPEED, run)
      : next
        ? clear(next, (next.at - run.distance) / SPEED)
        : acting();
    run.tick(now, frame(now, [body]));
    now += 30;
  }
  const item = run.items.find((entry) => entry.obstacle.at === target.at);
  return {
    run,
    state: item?.state,
    lostHearts: hearts - run.hearts,
    wonPoints: run.points - points,
  };
}
const block = (obstacle: Obstacle) => obstacle.kind === "block";
const beam = (obstacle: Obstacle) => obstacle.kind === "beam" && obstacle.beams === 1;
const tunnel = (obstacle: Obstacle) => obstacle.kind === "beam" && obstacle.beams >= 4;
const log = (obstacle: Obstacle) => obstacle.kind === "log";
const rails = (obstacle: Obstacle) => obstacle.kind === "rails";
const monsterIn = (lane: number) => (obstacle: Obstacle) =>
  obstacle.kind === "monster" && obstacle.lane === lane;

it("costs a heart to be in a blocked lane when the block arrives, and nothing to be in an open one", () => {
  const blocked = meet(block, (obstacle) =>
    acting({ lane: obstacle.kind === "block" ? (obstacle.lanes[0] ?? 0) : 0 }),
  );
  expect([blocked.state, blocked.lostHearts]).toEqual(["hit", 1]);
  const open = meet(block, clear);
  expect([open.state, open.lostHearts]).toEqual(["passed", 0]);
});

it("clears a beam only by being ducked at the moment it arrives", () => {
  expect(meet(beam, () => acting({ crouched: true, lane: 1 })).state).toBe("passed");
  expect(meet(beam, () => acting()).state).toBe("hit");
  // Ducking early and standing up before it arrives does not count.
  const early = meet(beam, (_, ahead) => acting({ crouched: ahead > 3 }));
  expect([early.state, early.lostHearts]).toEqual(["hit", 1]);
});

it("clears a tunnel only by staying ducked under every beam, and charges one heart for it", () => {
  const through = meet(tunnel, () => acting({ crouched: true }));
  expect([through.state, through.lostHearts]).toEqual(["passed", 0]);
  // Standing up after the second beam meets the third.
  const stoodUp = meet(tunnel, (_, ahead) =>
    acting({ crouched: ahead > (-1.5 * BEAM_SPACING) / SPEED }),
  );
  expect([stoodUp.state, stoodUp.lostHearts]).toEqual(["hit", 1]);
  // Walking into every beam upright is still one stumble, not one for each.
  expect(meet(tunnel, () => acting()).lostHearts).toBe(1);
});

it("carries the character over a log when the player leaves the ground a short way before it", () => {
  const earliest = RULES.jump.earliest / SPEED;
  const latest = RULES.jump.latest / SPEED;
  // Anywhere in the stretch before the log will do, from its far end to its near one.
  for (const [from, to] of [
    [earliest - 0.02, earliest - 0.25],
    [0.4, 0.2],
    [latest + 0.05, -0.1],
  ] as const) {
    let over = 0;
    const jumped = meet(log, (_, ahead, run) => {
      if (Math.abs(ahead) < 0.02) over = run.lift;
      return acting({ air: ahead < from && ahead > to });
    });
    expect([jumped.state, jumped.lostHearts]).toEqual(["passed", 0]);
    // What the player sees agrees: the character's feet are above the log as it goes under.
    expect(over).toBeGreaterThan(LOG_HEIGHT);
    // And it is back on the road afterwards.
    expect(jumped.run.lift).toBe(0);
  }
});

it("runs into a log without a jump begun in the stretch before it", () => {
  expect(meet(log, () => acting()).state).toBe("hit");
  const earliest = RULES.jump.earliest / SPEED;
  const latest = RULES.jump.latest / SPEED;
  // Too soon, and already landed.
  const soon = meet(log, (_, ahead) => acting({ air: ahead < 1.3 && ahead > 1.1 }));
  expect([soon.state, soon.lostHearts]).toEqual(["hit", 1]);
  // Too soon, and still off the ground when the log arrives: a hop does not reach over a log.
  expect(
    meet(log, (_, ahead) => acting({ air: ahead < earliest + 0.2 && ahead > -0.1 })).state,
  ).toBe("hit");
  // Too late.
  expect(
    meet(log, (_, ahead) => acting({ air: ahead < latest - 0.05 && ahead > -0.1 })).state,
  ).toBe("hit");
});

it("lets the character hop as the player does anywhere else, for nothing", () => {
  const run = new Run(5, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  expect(run.lift).toBe(0);
  now = play(run, now, 200, [acting({ air: true })]);
  expect(run.lift).toBeGreaterThan(0.1);
  expect(run.lift).toBeLessThanOrEqual(RULES.hop.most);
  expect(RULES.hop.most).toBeLessThan(LOG_HEIGHT);
  play(run, now, 100, [acting()]);
  expect(run.lift).toBe(0);
  expect(run.hearts).toBe(RULES.hearts);
});

it("crosses a pool hanging from the rails by any raised hand, and lets hands change", () => {
  for (const hands of ["left", "right", "both"] as const) {
    let lift = 0;
    const crossed = meet(rails, (_, ahead, run) => {
      if (ahead < -0.3 && ahead > -0.4) lift = run.lift;
      return acting({ hands });
    });
    expect([crossed.state, crossed.lostHearts]).toEqual(["passed", 0]);
    expect(lift).toBeGreaterThan(0.2);
    expect(crossed.run.hanging).toBe(false);
  }
  // Both, then only the left, then both again, then only the right: one hand always holds.
  const playing = meet(rails, (_, ahead) =>
    acting({
      hands: ahead > -0.2 ? "both" : ahead > -0.4 ? "left" : ahead > -0.5 ? "both" : "right",
    }),
  );
  expect(playing.state).toBe("passed");
});

it("drops the character into the pool when no hand is raised, at the start or part of the way", () => {
  let depth = 0;
  const walkedIn = meet(rails, (_, ahead, run) => {
    if (ahead < -0.3 && ahead > -0.4) depth = run.lift;
    // A hand raised after falling in does not climb back out.
    return acting({ hands: ahead < -0.1 ? "both" : null });
  });
  expect([walkedIn.state, walkedIn.lostHearts]).toEqual(["hit", 1]);
  expect(depth).toBe(-POOL_DEPTH);
  expect(walkedIn.run.lift).toBe(0);

  const letGo = meet(rails, (_, ahead) => acting({ hands: ahead > -0.3 ? "left" : null }));
  expect([letGo.state, letGo.lostHearts]).toEqual(["hit", 1]);
});

it("keeps hold of a rail with an arm the camera loses, drawn still reaching up", () => {
  let arm: unknown = null;
  const crossed = meet(rails, (_, ahead, run) => {
    if (ahead < -0.3 && ahead > -0.4) arm = run.arms.left;
    return ahead > -0.1 ? acting({ hands: "left" }) : acting({ arms: false });
  });
  expect(crossed.state).toBe("passed");
  expect(arm).toEqual({ upper: { x: 0, y: 1, z: 0 }, lower: { x: 0, y: 1, z: 0 } });
  // Past the pool the lost arm hangs again.
  expect(crossed.run.arms.left).toBeNull();
});

it("knocks a monster away with a punch from the arm on its side, thrown shortly before it", () => {
  const jab = (side: "left" | "right") => (_: Obstacle, ahead: number) =>
    acting({ punch: ahead < 0.25 && ahead > 0.1 ? side : null });
  // On the left of the road it takes the left arm, on the right the right; in the middle, either.
  for (const [lane, side] of [
    [-1, "left"],
    [1, "right"],
    [0, "left"],
    [0, "right"],
  ] as const) {
    const punched = meet(monsterIn(lane), jab(side));
    expect([punched.state, punched.lostHearts, punched.wonPoints]).toEqual([
      "punched",
      0,
      RULES.punch.points,
    ]);
  }
  for (const [lane, side] of [
    [-1, "right"],
    [1, "left"],
  ] as const) {
    const wrong = meet(monsterIn(lane), jab(side));
    expect([wrong.state, wrong.lostHearts, wrong.wonPoints]).toEqual(["hit", 1, 0]);
  }
  // Standing in the monster's own lane, it is straight ahead and either arm reaches it.
  for (const [lane, side] of [
    [-1, "right"],
    [1, "left"],
  ] as const) {
    const facing = meet(monsterIn(lane), (_, ahead) =>
      acting({ lane, punch: ahead < 0.25 && ahead > 0.1 ? side : null }),
    );
    expect([facing.state, facing.wonPoints]).toEqual(["punched", RULES.punch.points]);
  }
  // The wrong arm first costs nothing if the right one follows in time.
  const corrected = meet(monsterIn(1), (_, ahead) =>
    acting({
      punch: ahead < 0.34 && ahead > 0.25 ? "left" : ahead < 0.2 && ahead > 0.1 ? "right" : null,
    }),
  );
  expect(corrected.state).toBe("punched");
});

it("is caught by a monster that is not punched in time, wherever the player stands", () => {
  for (const lane of [-1, 0, 1])
    expect(meet(monsterIn(0), () => acting({ lane })).state).toBe("hit");
  // How long before it arrives a monster comes within reach.
  const earliest = RULES.punch.reach / MONSTER.charge / SPEED;
  expect(earliest).toBeGreaterThan(0.3);
  expect(earliest).toBeLessThan(0.45);
  // A monster that has just arrived looms for a moment before it strikes: still time to punch.
  const late = meet(monsterIn(-1), (_, ahead) =>
    acting({ punch: ahead < -0.03 && ahead > -0.1 ? "left" : null }),
  );
  expect([late.state, late.lostHearts]).toEqual(["punched", 0]);
  // But only a moment.
  const tooLate = meet(monsterIn(-1), (_, ahead) =>
    acting({ punch: ahead < -0.2 ? "left" : null }),
  );
  expect([tooLate.state, tooLate.lostHearts]).toEqual(["hit", 1]);
  // A punch at a monster still well down the road hits nothing.
  const far = meet(monsterIn(-1), (_, ahead) =>
    acting({ punch: ahead < earliest + 0.3 && ahead > earliest + 0.15 ? "left" : null }),
  );
  expect([far.state, far.wonPoints]).toEqual(["hit", 0]);
  // Thrown and pulled back too soon.
  const soon = meet(monsterIn(-1), (_, ahead) =>
    acting({ punch: ahead < 1.38 && ahead > 1.25 ? "left" : null }),
  );
  expect([soon.state, soon.lostHearts]).toEqual(["hit", 1]);
  // An arm held out since long before was not thrown at this monster.
  const held = meet(monsterIn(-1), (_, ahead) =>
    acting({ punch: ahead < earliest + 0.2 ? "left" : null }),
  );
  expect(held.state).toBe("hit");
  // A punch at nothing costs nothing and wins nothing.
  const run = new Run(5, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  now = play(run, now, 200, [acting({ punch: "right" })]);
  play(run, now, 200, [acting()]);
  expect([run.points, run.hearts]).toEqual([0, RULES.hearts]);
});

it("keeps the road moving for a player it cannot see, who meets things as last seen", () => {
  const run = new Run(5, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  const from = run.distance;
  now = play(run, now, 2000, null);
  expect(run.distance - from).toBeCloseTo(SPEED * 2.05, 0);
  expect(run.phase).toBe("running");

  // Ducked and then lost to the camera, as when lying on the floor: still ducked for the beam.
  const course = new Course(5, TRIAL.seconds * SPEED);
  course.layTo(4000);
  const target = course.obstacles.find(beam);
  if (!target) throw new Error("No beam on this road");
  const hidden = new Run(5, TRIAL);
  now = play(hidden, 0, SETTLE_MS + 100, [acting()]);
  while (hidden.distance < target.at - 12) {
    const next = hidden.items.find((item) => item.state === "coming")?.obstacle;
    hidden.tick(now, frame(now, [next ? clear(next, next.at - hidden.distance) : acting()]));
    now += 30;
  }
  hidden.tick(now, frame(now, [acting({ crouched: true })]));
  while (hidden.distance < target.at + 1) {
    now += 30;
    hidden.tick(now, null);
  }
  expect(hidden.items.find((item) => item.obstacle.at === target.at)?.state).toBe("passed");
});

it("gives every heart back when the last one goes", () => {
  const run = new Run(5, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  let least: number = RULES.hearts;
  for (; run.refilledAt < 0 && now < 600_000; now += 30) {
    run.tick(now, frame(now, [acting()]));
    least = Math.min(least, run.hearts);
  }
  expect(least).toBe(1);
  expect(run.hearts).toBe(RULES.hearts);
});

it("ends at the finish line after its set time, with clear road before it, and can be run again", () => {
  const run = new Run(5, { seconds: 12, immortal: true });
  expect(run.length).toBe(12 * SPEED);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  now = play(run, now, 11_000, [acting()]);
  expect(run.phase).toBe("running");
  // Nothing is laid in the last stretch: the finish is run up to, not stumbled into.
  expect(run.items.every((item) => item.obstacle.at < run.length - RUN_IN)).toBe(true);
  // The last stretch is run in slow motion, so it takes longer than its length says.
  now = play(run, now, 900, [acting()]);
  expect(run.phase).toBe("running");
  now = play(run, now, 2000, [acting()]);
  expect(run.phase).toBe("finished");
  // The road has stopped, and stays stopped whether or not the player is seen.
  const stopped = run.distance;
  now = play(run, now, 500, [acting({ hands: "left" })]);
  now = play(run, now, 7000, null);
  expect([run.phase, run.distance]).toEqual(["finished", stopped]);

  run.restart();
  expect([run.phase, run.distance, run.hearts]).toEqual(["waiting", 0, RULES.hearts]);
  play(run, now, SETTLE_MS + 100, [acting()]);
  expect(run.phase).toBe("running");
});

it("fails the run when the last heart goes, unless hearts come back", () => {
  const run = new Run(5, { seconds: 300, immortal: false });
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  for (; run.phase === "running" && now < 600_000; now += 30) run.tick(now, frame(now, [acting()]));
  expect([run.phase, run.hearts]).toEqual(["failed", 0]);
  expect(run.refilledAt).toBeLessThan(0);
  const stopped = run.distance;
  play(run, now, 1000, [acting()]);
  expect(run.distance).toBe(stopped);
  run.restart();
  expect([run.phase, run.hearts]).toEqual(["waiting", RULES.hearts]);
});

it("tells the view which way the player stepped", () => {
  const run = new Run(5, TRIAL);
  let now = play(run, 0, SETTLE_MS + 100, [acting()]);
  expect(run.stepped).toBeNull();
  now = play(run, now, 200, [acting({ lane: 1 })]);
  expect(run.stepped?.way).toBe(1);
  play(run, now, 200, [acting({ lane: 0 })]);
  expect(run.stepped?.way).toBe(-1);
});

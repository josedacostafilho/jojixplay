import type { Body, BodyFrame } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { Run, SETTLE_MS, SPEED } from "../src/run";

const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
const person = (x = 0.5): Body => ({
  leftShoulder: joint(x + 0.05, 0.3),
  rightShoulder: joint(x - 0.05, 0.3),
  leftHip: joint(x + 0.04, 0.55),
  rightHip: joint(x - 0.04, 0.55),
});
const frame = (now: number, bodies: Body[], epoch = 0): BodyFrame => ({
  sequence: now,
  capturedAtMs: now,
  width: 1280,
  height: 720,
  epoch,
  bodies,
});
/** Feeds one reading every 50 ms and returns the time reached. */
function play(run: Run, from: number, forMs: number, bodies: Body[] | null, epoch = 0) {
  let now = from;
  for (; now <= from + forMs; now += 50) run.tick(now, bodies && frame(now, bodies, epoch));
  return now;
}

it("waits for the player to stand near the middle, then starts where they stand", () => {
  const run = new Run();
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
  const run = new Run();
  let now = play(run, 0, SETTLE_MS / 2, [person()]);
  expect(run.phase).toBe("settling");
  now = play(run, now, 200, null);
  expect(run.phase).toBe("settling");
  now = play(run, now, SETTLE_MS / 2, [person()]);
  expect(run.phase).toBe("running");

  // A real absence does start it again.
  const other = new Run();
  now = play(other, 0, SETTLE_MS / 2, [person()]);
  now = play(other, now, 600, null);
  expect(other.phase).toBe("waiting");
  play(other, now, SETTLE_MS / 2, [person()]);
  expect(other.phase).toBe("settling");
});

it("follows the person nearest the middle and runs at a steady pace", () => {
  const run = new Run();
  let now = play(run, 0, SETTLE_MS + 100, [person(0.9), person(0.5)]);
  expect(run.phase).toBe("running");
  const before = run.distance;
  now = play(run, now, 1000, [person(0.9), person(0.5)]);
  expect(run.distance - before).toBeCloseTo(SPEED * 1.05, 1);
  expect(run.puppet?.lane).toBe(0);
});

it("keeps the avatar where it was through a short loss and starts over after a long one", () => {
  const run = new Run();
  let now = play(run, 0, SETTLE_MS + 100, [person()]);
  now = play(run, now, 300, [person(0.35)]);
  expect(run.puppet?.lane).toBe(1);

  now = play(run, now, 1000, null);
  expect(run.phase).toBe("running");
  expect(run.tracking).toBe(false);
  expect(run.puppet?.lane).toBe(1);

  now = play(run, now, 3000, null);
  expect(run.phase).toBe("waiting");
  expect(run.distance).toBe(0);
  // A stale reading is not a player.
  run.tick(now + 1000, frame(now, [person()]));
  expect(run.tracking).toBe(false);
});

it("lays the lanes out again when the camera's own basis changes", () => {
  const run = new Run();
  const now = play(run, 0, SETTLE_MS + 100, [person()]);
  expect(run.phase).toBe("running");
  run.tick(now, frame(now, [person()], 1));
  expect(run.phase).not.toBe("running");
  expect(run.distance).toBe(0);
});

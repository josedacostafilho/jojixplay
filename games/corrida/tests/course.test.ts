import { expect, it } from "vitest";
import { Course, extent, RUN_IN } from "../src/course";
import { stretch } from "../src/world";

it("lays every kind of obstacle, in order, with time to see each one coming", () => {
  const course = new Course(7, 10_000);
  course.layTo(3000);
  const { obstacles } = course;
  expect(new Set(obstacles.map((obstacle) => obstacle.kind))).toEqual(
    new Set(["block", "fall", "beam", "log", "trunk", "gap", "monster"]),
  );
  // Nothing in the first few seconds, and about a second and a half of clear road after each.
  expect(obstacles[0]?.at).toBeGreaterThanOrEqual(stretch(2.9));
  for (let index = 1; index < obstacles.length; index += 1) {
    const before = obstacles[index - 1];
    if (!before) continue;
    const clear = (obstacles[index]?.at ?? 0) - before.at - extent(before);
    expect(clear).toBeGreaterThanOrEqual(stretch(1.4));
    expect(clear).toBeLessThanOrEqual(stretch(1.9));
  }
});

it("always leaves a lane open, keeps everything short, and varies what has a length", () => {
  const course = new Course(11, 10_000);
  course.layTo(6000);
  const beams = new Set<number>();
  for (const obstacle of course.obstacles) {
    if (obstacle.kind === "block") {
      expect(obstacle.lanes.length).toBeGreaterThanOrEqual(1);
      expect(new Set(obstacle.lanes).size).toBeLessThanOrEqual(2);
    }
    if (obstacle.kind === "beam") beams.add(obstacle.beams);
    // Nothing lasts much more than three seconds of running.
    expect(extent(obstacle)).toBeLessThanOrEqual(stretch(3.4));
  }
  // Monsters of both sizes, and vines over every lane.
  const monsters = course.obstacles.flatMap((o) => (o.kind === "monster" ? [o.size] : []));
  expect(new Set(monsters)).toEqual(new Set(["great", "small"]));
  const gaps = course.obstacles.flatMap((o) => (o.kind === "gap" ? [o] : []));
  expect(new Set(gaps.map((gap) => gap.vine))).toEqual(new Set([-1, 0, 1, null]));
  expect(new Set(gaps.map((gap) => gap.trunk))).toEqual(new Set([-1, 0, 1, null]));
  // Every gap has a way across, and two ways are over different lanes.
  for (const gap of gaps) expect(gap.vine).not.toBe(gap.trunk);
  // A river is always about as wide; ravines and trunks on the ground are of many lengths.
  const seconds = (kind: string) =>
    course.obstacles
      .filter((o) => (o.kind === "gap" ? o.over : o.kind) === kind)
      .map((o) => (o.kind === "gap" || o.kind === "trunk" ? o.length : 0) / stretch(1));
  expect(Math.min(...seconds("river"))).toBeGreaterThanOrEqual(1.25);
  expect(Math.max(...seconds("river"))).toBeLessThanOrEqual(1.85);
  for (const kind of ["ravine", "trunk"]) {
    expect(Math.min(...seconds(kind))).toBeLessThan(1.3);
    expect(Math.max(...seconds(kind))).toBeGreaterThan(2.2);
  }
  // A single beam and tunnels of several lengths.
  expect(beams.has(1)).toBe(true);
  expect(beams.size).toBeGreaterThanOrEqual(4);
});

it("lays the same road for the same seed and a different one for another", () => {
  const road = (seed: number) => {
    const course = new Course(seed, 10_000);
    course.layTo(1500);
    return JSON.stringify(course.obstacles);
  };
  expect(road(3)).toBe(road(3));
  expect(road(3)).not.toBe(road(4));
});

it("lays nothing in the run-in to the finish, however far it is asked to lay", () => {
  const course = new Course(7, 400);
  course.layTo(5000);
  expect(course.obstacles.length).toBeGreaterThan(5);
  for (const obstacle of course.obstacles)
    expect(obstacle.at + extent(obstacle)).toBeLessThanOrEqual(400 - RUN_IN);
});

import { expect, it } from "vitest";
import { Course, extent, RUN_IN } from "../src/course";
import { stretch } from "../src/world";

it("lays every kind of obstacle, in order, with time to see each one coming", () => {
  const course = new Course(7, 10_000);
  course.layTo(3000);
  const { obstacles } = course;
  expect(new Set(obstacles.map((obstacle) => obstacle.kind))).toEqual(
    new Set(["block", "beam", "log", "rails", "monster"]),
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

it("always leaves a lane open, and keeps tunnels and rails short", () => {
  const course = new Course(11, 10_000);
  course.layTo(6000);
  const beams = new Set<number>();
  for (const obstacle of course.obstacles) {
    if (obstacle.kind === "block") {
      expect(obstacle.lanes.length).toBeGreaterThanOrEqual(1);
      expect(new Set(obstacle.lanes).size).toBeLessThanOrEqual(2);
    }
    if (obstacle.kind === "beam") beams.add(obstacle.beams);
    // Nothing lasts more than two seconds of running.
    expect(extent(obstacle)).toBeLessThanOrEqual(stretch(2));
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

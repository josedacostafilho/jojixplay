import { expect, it } from "vitest";
import type { Body, BodyFrame } from "@jojixplay/game-sdk";
import { DrawSession, MAX_MARKS } from "../src/session";
const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
function body(screenX = 0.5, paint = true, handX = 0.5): Body {
  return {
    leftShoulder: joint(1 - screenX - 0.05, 0.4),
    rightShoulder: joint(1 - screenX + 0.05, 0.4),
    leftWrist: joint(1 - screenX - 0.1, paint ? 0.2 : 0.6),
    rightWrist: joint(handX, 0.5),
  };
}
function frame(sequence: number, bodies: Body[] = [body()], epoch = 0): BodyFrame {
  return { sequence, capturedAtMs: 100 + sequence * 33, width: 1280, height: 720, epoch, bodies };
}
function input(session: DrawSession, value: BodyFrame) {
  session.update(value, value.capturedAtMs);
}
it("paints without hips or legs and lifts when the other hand lowers", () => {
  const session = new DrawSession(1);
  input(session, frame(0));
  input(session, frame(1, [body(0.5, true, 0.52)]));
  expect(session.marks).toHaveLength(2);
  expect(session.marks[1]?.from).toEqual(session.marks[0]?.to);
  input(session, frame(2, [body(0.5, false, 0.54)]));
  expect(session.marks).toHaveLength(2);
  input(session, frame(3, [body(0.5, true, 0.56)]));
  expect(session.marks[2]?.from).toEqual(session.marks[2]?.to);
});
it("two artists retain screen-side colors when the detector reverses array order", () => {
  const session = new DrawSession(2);
  input(session, frame(0, [body(0.25, true, 0.75), body(0.75, true, 0.25)]));
  input(session, frame(1, [body(0.75, true, 0.27), body(0.25, true, 0.73)]));
  expect(session.marks.map((m) => m.player)).toEqual([0, 1, 0, 1]);
  expect(session.marks[2]?.stroke).toBe(session.marks[0]?.stroke);
  expect(session.marks[3]?.stroke).toBe(session.marks[1]?.stroke);
  input(session, frame(2, [body(0.75, true, 0.29)]));
  expect(session.brushes[0]?.point).toBeNull();
  expect(session.brushes[1]?.point).not.toBeNull();
});
it("stale, missing, duplicate, changed-basis and implausible input never bridge strokes", () => {
  for (const interruption of ["stale", "missing", "duplicate", "epoch", "jump"]) {
    const session = new DrawSession(1);
    input(session, frame(0));
    if (interruption === "stale") session.update(frame(1), 500);
    if (interruption === "missing") session.update(null, 150);
    if (interruption === "duplicate") input(session, frame(0));
    if (interruption === "epoch") input(session, frame(1, [body()], 1));
    if (interruption === "jump") input(session, frame(1, [body(0.5, true, 0.9)]));
    input(session, frame(2, [body(0.5, true, 0.53)]));
    const last = session.marks[session.marks.length - 1];
    expect(last?.from).toEqual(last?.to);
  }
});
it("toolbar hit testing blocks paint and undo affects only the selected artist", () => {
  const session = new DrawSession(2);
  session.update(frame(0, [body(0.25), body(0.75)]), 100, () => true);
  expect(session.marks).toHaveLength(0);
  input(session, frame(1, [body(0.25), body(0.75)]));
  expect(session.marks).toHaveLength(2);
  session.select(0, "undo");
  expect(session.marks.map((m) => m.player)).toEqual([1]);
  session.clear();
  expect(session.marks).toHaveLength(0);
});
it("central overlap is unassigned and left-hand drawing uses the other shoulder", () => {
  const session = new DrawSession(2);
  input(session, frame(0, [body(0.5), body(0.51)]));
  expect(session.marks).toHaveLength(0);
  const left = new DrawSession(1);
  left.select(0, "hand");
  input(
    left,
    frame(0, [
      { leftWrist: joint(0.5, 0.5), rightWrist: joint(0.2, 0.2), rightShoulder: joint(0.4, 0.4) },
    ]),
  );
  expect(left.marks).toHaveLength(1);
});
it("bounds retained paint rather than accumulating an unlimited scene", () => {
  const session = new DrawSession(1);
  for (let i = 0; i < MAX_MARKS + 10; i++)
    input(session, frame(i, [body(0.5, true, i % 2 ? 0.51 : 0.5)]));
  expect(session.marks).toHaveLength(MAX_MARKS);
  expect(session.full).toBe(true);
  session.select(0, "undo");
  expect(session.full).toBe(false);
});

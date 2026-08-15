import { describe, expect, it } from "vitest";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import { RacingInputSession } from "../../src/games/racing/racing-input";

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function setLandmark(pose: DetectedPose, index: number, x: number, y: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  Object.assign(landmark, { x, y, visibility: 1 });
}

function setHand(pose: DetectedPose, hand: "left" | "right", x: number, y: number): void {
  const indices = hand === "left" ? [15, 17, 19, 21] : [16, 18, 20, 22];
  for (const [offset, index] of indices.entries()) {
    setLandmark(pose, index, x + (offset - 1.5) * 0.002, y);
  }
}

function createDriverPose(screenCenterX: number, leanScreenOffset = 0, handY = 0.43): DetectedPose {
  const rawCenterX = 1 - screenCenterX;
  const rawShoulderCenterX = rawCenterX - leanScreenOffset;
  const pose: DetectedPose = { landmarks: Array.from({ length: 33 }, hiddenLandmark) };
  setLandmark(pose, 11, rawShoulderCenterX + 0.1, 0.35);
  setLandmark(pose, 12, rawShoulderCenterX - 0.1, 0.35);
  setLandmark(pose, 23, rawCenterX + 0.075, 0.65);
  setLandmark(pose, 24, rawCenterX - 0.075, 0.65);
  setHand(pose, "left", rawCenterX + 0.12, handY);
  setHand(pose, "right", rawCenterX - 0.12, handY);
  return pose;
}

function packet(sequence: number, poses: readonly DetectedPose[], epoch = 0): PosePacket {
  return {
    sequence,
    capturedAtMs: sequence * 100,
    frame: { width: 1_280, height: 720, layout: "landscape", epoch },
    poses: [...poses],
  };
}

describe("Racing input", () => {
  it("derives an aspect-correct mirrored torso lean angle", () => {
    const session = new RacingInputSession();
    const neutral = session.update(packet(1, [createDriverPose(0.5)]), 1, 100);
    expect(neutral.visibleDrivers).toBe(1);
    expect(neutral.observations[0]).toMatchObject({ slot: "solo" });
    expect(neutral.observations[0]?.leanAngleRadians).toBeCloseTo(0, 6);

    const rightLean = session.update(packet(2, [createDriverPose(0.5, 0.04)]), 1, 200);
    const leftLean = session.update(packet(3, [createDriverPose(0.5, -0.04)]), 1, 300);
    expect(rightLean.observations[0]?.leanAngleRadians).toBeGreaterThan(0);
    expect(leftLean.observations[0]?.leanAngleRadians).toBeLessThan(0);
  });

  it("keeps temporary left/right leases through pose-array reorder and one-person dropout", () => {
    const session = new RacingInputSession();
    const left = createDriverPose(0.25);
    const right = createDriverPose(0.75);
    const initial = session.update(packet(1, [left, right]), 2, 100);
    expect(initial.observations.map(({ slot }) => slot)).toEqual(["left", "right"]);
    expect(initial.observations[0]?.torsoCenter.x).toBeCloseTo(0.25, 2);
    expect(initial.observations[1]?.torsoCenter.x).toBeCloseTo(0.75, 2);

    const reordered = session.update(packet(2, [right, left]), 2, 200);
    expect(reordered.observations[0]?.torsoCenter.x).toBeCloseTo(0.25, 2);
    expect(reordered.observations[1]?.torsoCenter.x).toBeCloseTo(0.75, 2);

    const rightOnly = session.update(packet(3, [createDriverPose(0.73)]), 2, 300);
    expect(rightOnly.observations).toHaveLength(1);
    expect(rightOnly.observations[0]?.slot).toBe("right");
  });

  it("resets temporary leases on a camera epoch and assigns an unmatched pose by screen side", () => {
    const session = new RacingInputSession();
    session.update(packet(1, [createDriverPose(0.25), createDriverPose(0.75)]), 2, 100);
    const nextEpoch = session.update(packet(2, [createDriverPose(0.7)], 1), 2, 200);
    expect(nextEpoch.epoch).toBe(1);
    expect(nextEpoch.observations[0]?.slot).toBe("right");
  });

  it("requests one pause per sustained overhead gesture and rearms after lowering", () => {
    const session = new RacingInputSession();
    const overhead = createDriverPose(0.5, 0, 0.2);
    let latest = session.update(packet(1, [overhead]), 1, 100);
    for (let step = 2; step <= 11; step += 1) {
      latest = session.update(packet(step, [overhead]), 1, step * 100);
    }
    expect(latest.pauseRequested).toBe(true);
    expect(session.update(packet(12, [overhead]), 1, 1_200).pauseRequested).toBe(false);

    session.update(packet(13, [createDriverPose(0.5)]), 1, 1_300);
    latest = session.update(packet(14, [overhead]), 1, 1_400);
    for (let step = 15; step <= 24; step += 1) {
      latest = session.update(packet(step, [overhead]), 1, step * 100);
    }
    expect(latest.pauseRequested).toBe(true);
  });

  it("steers without complete hands and rejects a pose without a complete torso", () => {
    const incompletePose = createDriverPose(0.5);
    const hidden = incompletePose.landmarks[21];
    if (hidden === undefined) {
      throw new Error("Missing hand fixture landmark.");
    }
    hidden.visibility = 0;
    const session = new RacingInputSession();
    const incomplete = session.update(packet(1, [incompletePose]), 1, 100);
    expect(incomplete.visibleDrivers).toBe(1);
    expect(incomplete.observations[0]?.leanAngleRadians).toBeCloseTo(0, 6);
    expect(incomplete.observations[0]?.pausePose).toBe(false);

    const missingTorso = createDriverPose(0.5);
    const shoulder = missingTorso.landmarks[11];
    if (shoulder === undefined) {
      throw new Error("Missing torso fixture landmark.");
    }
    shoulder.visibility = 0;
    const rejected = session.update(packet(2, [missingTorso]), 1, 200);
    expect(rejected.visibleDrivers).toBe(0);
    expect(rejected.observations).toEqual([]);
  });
});

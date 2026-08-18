import { describe, expect, it } from "vitest";
import type {
  RacingDriverObservation,
  RacingInputSnapshot,
  RacingPlayerSlot,
} from "../../src/games/racing/racing-input";
import {
  RACING_COUNTDOWN_MS,
  RACING_INPUT_GRACE_MS,
  RACING_LEAN_DEAD_ZONE_RADIANS,
  RACING_LEAN_FULL_SCALE_RADIANS,
  RacingSession,
  racingSteeringTargetFromLean,
} from "../../src/games/racing/racing-session";

function observation(slot: RacingPlayerSlot, leanAngleRadians = 0): RacingDriverObservation {
  return {
    slot,
    torsoCenter: { x: slot === "left" ? 0.25 : slot === "right" ? 0.75 : 0.5, y: 0.5 },
    leanAngleRadians,
    pausePose: false,
  };
}

function input(observations: readonly RacingDriverObservation[], epoch = 0): RacingInputSnapshot {
  return {
    observations,
    visibleDrivers: observations.length,
    pauseRequested: false,
    epoch,
  };
}

function calibrate(
  session: RacingSession,
  slots: readonly RacingPlayerSlot[],
  neutralAngles: readonly number[] = slots.map(() => 0),
): number {
  let nowMs = 0;
  session.updateDrivers(
    input(slots.map((slot, index) => observation(slot, neutralAngles[index] ?? 0))),
    nowMs,
  );
  expect(session.start(nowMs).started).toBe(true);
  while (nowMs < RACING_COUNTDOWN_MS) {
    nowMs += 100;
    session.updateDrivers(
      input(slots.map((slot, index) => observation(slot, neutralAngles[index] ?? 0))),
      nowMs,
    );
    session.tick(nowMs);
  }
  expect(session.getSnapshot(nowMs).phase).toBe("racing");
  return nowMs;
}

describe("Racing session", () => {
  it("maps calibrated lean symmetrically through a dead zone to analog full lock", () => {
    const halfwayLean =
      RACING_LEAN_DEAD_ZONE_RADIANS +
      (RACING_LEAN_FULL_SCALE_RADIANS - RACING_LEAN_DEAD_ZONE_RADIANS) / 2;
    const strongerLean =
      RACING_LEAN_DEAD_ZONE_RADIANS +
      (RACING_LEAN_FULL_SCALE_RADIANS - RACING_LEAN_DEAD_ZONE_RADIANS) * 0.75;

    expect(racingSteeringTargetFromLean(0)).toBe(0);
    expect(racingSteeringTargetFromLean(RACING_LEAN_DEAD_ZONE_RADIANS)).toBe(0);
    expect(racingSteeringTargetFromLean(-RACING_LEAN_DEAD_ZONE_RADIANS)).toBe(0);
    expect(racingSteeringTargetFromLean(halfwayLean)).toBeCloseTo(0.5, 8);
    expect(racingSteeringTargetFromLean(-halfwayLean)).toBeCloseTo(-0.5, 8);
    expect(racingSteeringTargetFromLean(strongerLean)).toBeGreaterThan(0.5);
    expect(racingSteeringTargetFromLean(RACING_LEAN_FULL_SCALE_RADIANS)).toBe(1);
    expect(racingSteeringTargetFromLean(-RACING_LEAN_FULL_SCALE_RADIANS * 2)).toBe(-1);
  });

  it("requires visible torsos and advances calibration only with fresh lean input", () => {
    const session = new RacingSession();
    session.setEnabled(true, 1, 0);
    expect(session.start(0).started).toBe(false);
    session.updateDrivers(input([observation("solo")]), 0);
    expect(session.start(0).started).toBe(true);

    session.tick(1_000);
    expect(session.getSnapshot(1_000)).toMatchObject({
      phase: "starting",
      startingRemainingMs: RACING_COUNTDOWN_MS,
    });
    session.updateDrivers(input([observation("solo", 0)]), 1_000);
    session.tick(1_100);
    expect(session.getSnapshot(1_100).startingRemainingMs).toBe(RACING_COUNTDOWN_MS - 100);
    expect(session.getSnapshot(1_400).leanReadyDrivers).toBe(0);
  });

  it("applies analog lean magnitude, response filtering, and dropout centering", () => {
    const session = new RacingSession();
    session.setEnabled(true, 1, 0);
    let nowMs = calibrate(session, ["solo"]);
    const advanceWithLean = (leanAngleRadians: number, samples: number): void => {
      for (let index = 0; index < samples; index += 1) {
        nowMs += 100;
        session.updateDrivers(input([observation("solo", leanAngleRadians)]), nowMs);
        session.tick(nowMs);
      }
    };

    advanceWithLean(RACING_LEAN_DEAD_ZONE_RADIANS * 0.8, 1);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeCloseTo(0, 5);

    const halfwayLean =
      RACING_LEAN_DEAD_ZONE_RADIANS +
      (RACING_LEAN_FULL_SCALE_RADIANS - RACING_LEAN_DEAD_ZONE_RADIANS) / 2;
    advanceWithLean(halfwayLean, 8);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeCloseTo(0.5, 3);

    advanceWithLean(-halfwayLean, 8);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeCloseTo(-0.5, 3);
    advanceWithLean(RACING_LEAN_FULL_SCALE_RADIANS, 8);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeGreaterThan(0.95);

    advanceWithLean(RACING_LEAN_DEAD_ZONE_RADIANS * 0.5, 6);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeLessThan(0.02);

    advanceWithLean(RACING_LEAN_FULL_SCALE_RADIANS, 8);
    expect(session.getSnapshot(nowMs).cars[0]?.steering).toBeGreaterThan(0.95);

    const lastLeanAtMs = nowMs;
    session.updateDrivers(input([]), nowMs + 10);
    session.tick(lastLeanAtMs + RACING_INPUT_GRACE_MS - 1);
    const duringGrace =
      session.getSnapshot(lastLeanAtMs + RACING_INPUT_GRACE_MS - 1).cars[0]?.steering ?? 0;
    session.tick(lastLeanAtMs + RACING_INPUT_GRACE_MS + 300);
    const centered =
      session.getSnapshot(lastLeanAtMs + RACING_INPUT_GRACE_MS + 300).cars[0]?.steering ?? 0;
    expect(duringGrace).toBeGreaterThan(centered);
    expect(centered).toBeGreaterThanOrEqual(0);
  });

  it("freezes for user and orientation pauses and can recenter without resetting progress", () => {
    const session = new RacingSession();
    session.setEnabled(true, 1, 0);
    let nowMs = calibrate(session, ["solo"]);
    nowMs += 1_000;
    session.updateDrivers(input([observation("solo", 0)]), nowMs);
    const moving = session.tick(nowMs);
    const distanceBeforePause = moving.cars[0]?.distance ?? 0;

    const paused = session.requestUserPause(nowMs);
    expect(paused.phase).toBe("paused");
    session.tick(nowMs + 5_000);
    expect(session.getSnapshot(nowMs + 5_000).cars[0]?.distance).toBe(distanceBeforePause);

    const recentering = session.recenter(nowMs + 5_000);
    expect(recentering).toMatchObject({ phase: "starting", calibrationPurpose: "recenter" });
    expect(recentering.cars[0]?.distance).toBe(distanceBeforePause);

    session.setOrientationPaused(true, nowMs + 5_100);
    session.tick(nowMs + 10_100);
    expect(session.getSnapshot(nowMs + 10_100).startingRemainingMs).toBe(RACING_COUNTDOWN_MS);
    session.setOrientationPaused(false, nowMs + 10_100);
  });

  it("produces deterministic movement across common rendering cadences", () => {
    const run = (stepMs: number) => {
      const session = new RacingSession();
      session.setEnabled(true, 1, 0);
      let nowMs = calibrate(session, ["solo"]);
      const endMs = nowMs + 10_000;
      while (nowMs < endMs) {
        nowMs = Math.min(endMs, nowMs + stepMs);
        session.updateDrivers(input([observation("solo", 0)]), nowMs);
        session.tick(nowMs);
      }
      return session.getSnapshot(nowMs).cars[0];
    };
    const twentyFps = run(50);
    const tenFps = run(100);
    expect(twentyFps?.distance).toBeCloseTo(tenFps?.distance ?? 0, 5);
    expect(twentyFps?.speed).toBeCloseTo(tenFps?.speed ?? 0, 5);
    expect(twentyFps?.lateral).toBeCloseTo(tenFps?.lateral ?? 0, 5);
  });

  it("applies the off-road speed ceiling after sustained lateral steering", () => {
    const session = new RacingSession();
    session.setEnabled(true, 1, 0);
    let nowMs = calibrate(session, ["solo"]);
    for (let index = 1; index <= 200; index += 1) {
      nowMs += 100;
      session.updateDrivers(input([observation("solo", RACING_LEAN_FULL_SCALE_RADIANS)]), nowMs);
      session.tick(nowMs);
    }
    const car = session.getSnapshot(nowMs).cars[0];
    expect(Math.abs(car?.lateral ?? 0)).toBeGreaterThan(1);
    expect(car?.speed).toBeLessThanOrEqual(29);
  });

  it("finishes a one-player timed race and a slower two-player car loses", () => {
    const solo = new RacingSession();
    solo.setEnabled(true, 1, 0);
    let soloNow = calibrate(solo, ["solo"]);
    while (solo.getSnapshot(soloNow).phase === "racing" && soloNow < 180_000) {
      soloNow += 100;
      solo.updateDrivers(input([observation("solo", 0)]), soloNow);
      solo.tick(soloNow);
    }
    expect(solo.getSnapshot(soloNow).result).toMatchObject({ type: "time" });

    const versus = new RacingSession();
    versus.setEnabled(true, 2, 0);
    let versusNow = calibrate(versus, ["left", "right"]);
    while (versus.getSnapshot(versusNow).phase === "racing" && versusNow < 180_000) {
      versusNow += 100;
      versus.updateDrivers(
        input([observation("left", 0), observation("right", RACING_LEAN_FULL_SCALE_RADIANS)]),
        versusNow,
      );
      versus.tick(versusNow);
    }
    const result = versus.getSnapshot(versusNow).result;
    expect(result).toMatchObject({ type: "winner", winner: "left" });

    const tie = new RacingSession();
    tie.setEnabled(true, 2, 0);
    let tieNow = calibrate(tie, ["left", "right"]);
    while (tie.getSnapshot(tieNow).phase === "racing" && tieNow < 180_000) {
      tieNow += 100;
      tie.updateDrivers(input([observation("left", 0), observation("right", 0)]), tieNow);
      tie.tick(tieNow);
    }
    expect(tie.getSnapshot(tieNow).result).toMatchObject({ type: "winner", winner: "tie" });
  });
});

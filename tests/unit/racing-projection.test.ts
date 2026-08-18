import { describe, expect, it } from "vitest";
import { projectRacingObject, projectRacingRoad } from "../../src/games/racing/racing-projection";
import type { RacingCarSnapshot } from "../../src/games/racing/racing-session";
import { RACING_CURVE_DRIFT, RACING_STEERING_RATE } from "../../src/games/racing/racing-session";
import {
  RACING_TRACK,
  createRacingTrack,
  racingTrackPointAt,
} from "../../src/games/racing/racing-track";

function car(distance = 0, lateral = 0): RacingCarSnapshot {
  return {
    slot: "solo",
    distance,
    lateral,
    speed: 0,
    steering: 0,
    trackingAvailable: true,
    progress: distance / RACING_TRACK.length,
    finishedAtMs: null,
  };
}

describe("Racing track and projection", () => {
  it("builds one finite monotonic point-to-point course", () => {
    const track = createRacingTrack();
    expect(track.points.length).toBeGreaterThan(280);
    expect(track.length).toBeGreaterThan(3_400);
    for (const [index, point] of track.points.entries()) {
      expect(Object.values(point).every(Number.isFinite)).toBe(true);
      if (index > 0) {
        expect(point.distance).toBeGreaterThan(track.points[index - 1]?.distance ?? -1);
      }
    }
    expect(racingTrackPointAt(track, -1).distance).toBe(0);
    expect(racingTrackPointAt(track, track.length + 1).distance).toBe(track.length);
  });

  it("authors frequent balanced turns whose full-speed demand stays below full steering", () => {
    const track = createRacingTrack();
    const meaningfulCurves = track.points
      .map(({ curve }) => curve)
      .filter((curve) => Math.abs(curve) > 0.0001);
    const signs = meaningfulCurves.map((curve) => Math.sign(curve));
    const directionChanges = signs.reduce(
      (count, sign, index) => count + (index > 0 && sign !== signs[index - 1] ? 1 : 0),
      0,
    );
    const maximumCurve = Math.max(...meaningfulCurves.map(Math.abs));

    expect(directionChanges).toBeGreaterThanOrEqual(7);
    expect(Math.min(...meaningfulCurves)).toBeLessThan(-0.0024);
    expect(Math.max(...meaningfulCurves)).toBeGreaterThan(0.0025);
    expect(maximumCurve).toBeLessThanOrEqual(0.00265);
    expect((maximumCurve * RACING_CURVE_DRIFT) / RACING_STEERING_RATE).toBeLessThan(0.85);
  });

  it.each([
    { width: 1_280, height: 720 },
    { width: 640, height: 720 },
    { width: 720, height: 1_280 },
  ])("projects bounded finite road slices for $width × $height", (viewport) => {
    const projection = projectRacingRoad(car(600, 0.35), viewport);
    expect(projection.slices.length).toBeGreaterThan(30);
    expect(projection.horizonY).toBeGreaterThan(0);
    for (const slice of projection.slices) {
      expect(slice.far.depth).toBeGreaterThan(slice.near.depth);
      expect(slice.near.roadHalfWidth).toBeGreaterThan(slice.far.roadHalfWidth);
      expect(
        [
          slice.near.centerX,
          slice.near.y,
          slice.near.roadHalfWidth,
          slice.far.centerX,
          slice.far.y,
          slice.far.roadHalfWidth,
        ].every(Number.isFinite),
      ).toBe(true);
    }
  });

  it("projects an explicit near slice past the viewport bottom at a segment boundary", () => {
    const viewport = { width: 1_280, height: 720 };
    const projection = projectRacingRoad(car(163), viewport);
    const nearestSlice = projection.slices[0];
    expect(nearestSlice).toBeDefined();
    expect(nearestSlice?.near.depth).toBeGreaterThan(1.5);
    expect(nearestSlice?.near.depth).toBeLessThan(4);
    expect(nearestSlice?.near.y).toBeGreaterThan(viewport.height);
    expect(nearestSlice?.far.y).toBeLessThan(nearestSlice?.near.y ?? 0);
  });

  it("projects opponents through approach, side-by-side, and overtake depth", () => {
    const viewport = { width: 640, height: 720 };
    const cameraCar = car(400, 0);
    const farAhead = projectRacingObject(cameraCar, 440, 0.2, viewport);
    const approaching = projectRacingObject(cameraCar, 408, 0.2, viewport);
    const alongsideLeft = projectRacingObject(cameraCar, 400, -0.45, viewport);
    const alongsideRight = projectRacingObject(cameraCar, 400, 0.45, viewport);
    const justOvertaken = projectRacingObject(cameraCar, 396, 0.2, viewport);
    const behindCamera = projectRacingObject(cameraCar, 390, 0, viewport);

    expect(farAhead.visible).toBe(true);
    expect(approaching.visible).toBe(true);
    expect(approaching.scale).toBeGreaterThan(farAhead.scale);
    expect(alongsideLeft.visible).toBe(true);
    expect(alongsideRight.visible).toBe(true);
    expect(alongsideLeft.x).toBeLessThan(alongsideRight.x);
    expect(justOvertaken.visible).toBe(true);
    expect(behindCamera.visible).toBe(false);
  });

  it("keeps an opponent finite and visible while both cars enter a strong curve", () => {
    const viewport = { width: 640, height: 720 };
    const strongestPoint = RACING_TRACK.points.reduce((strongest, point) =>
      Math.abs(point.curve) > Math.abs(strongest.curve) ? point : strongest,
    );
    const cameraCar = car(Math.max(20, strongestPoint.distance - 24), 0.3);
    const opponent = projectRacingObject(cameraCar, strongestPoint.distance, -0.35, viewport);

    expect(opponent.visible).toBe(true);
    expect([opponent.x, opponent.y, opponent.scale, opponent.depth].every(Number.isFinite)).toBe(
      true,
    );
    expect(opponent.scale).toBeGreaterThan(0);
  });

  it("rejects an opponent beyond the forward draw distance", () => {
    const viewport = { width: 640, height: 720 };
    const opponent = projectRacingObject(car(400, 0), 2_000, 0, viewport);
    expect(opponent.visible).toBe(false);
  });
});

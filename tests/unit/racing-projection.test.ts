import { describe, expect, it } from "vitest";
import { projectRacingObject, projectRacingRoad } from "../../src/games/racing/racing-projection";
import type { RacingCarSnapshot } from "../../src/games/racing/racing-session";
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
    expect(track.points.length).toBeGreaterThan(200);
    expect(track.length).toBeGreaterThan(2_500);
    for (const [index, point] of track.points.entries()) {
      expect(Object.values(point).every(Number.isFinite)).toBe(true);
      if (index > 0) {
        expect(point.distance).toBeGreaterThan(track.points[index - 1]?.distance ?? -1);
      }
    }
    expect(racingTrackPointAt(track, -1).distance).toBe(0);
    expect(racingTrackPointAt(track, track.length + 1).distance).toBe(track.length);
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

  it("projects an opponent ahead and rejects one behind the chase camera", () => {
    const viewport = { width: 640, height: 720 };
    const cameraCar = car(400, 0);
    const ahead = projectRacingObject(cameraCar, 440, 0.2, viewport);
    const behind = projectRacingObject(cameraCar, 380, 0, viewport);
    expect(ahead.visible).toBe(true);
    expect(ahead.scale).toBeGreaterThan(0);
    expect(behind.visible).toBe(false);
  });
});

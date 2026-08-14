import { describe, expect, it } from "vitest";
import { StationaryHoldTracker } from "../../src/interaction/stationary-hold";
import type { Point, Size } from "../../src/render/geometry";

const FRAME: Size = { width: 1_280, height: 720 };
const A: Point = { x: 0.4, y: 0.5 };
const B: Point = { x: 0.42, y: 0.5 };

function tracker(): StationaryHoldTracker {
  return new StationaryHoldTracker({
    dwellMs: 500,
    radius: 0.012,
    excursionGraceMs: 100,
    maximumExcursionRatio: 0.2,
    maximumSampleGapMs: 250,
  });
}

describe("stationary hold", () => {
  it("completes a clean irregular-cadence hold at exactly 500 ms", () => {
    const hold = tracker();

    expect(hold.update(A, 0, FRAME)).toEqual({ completed: false, progress: 0 });
    expect(hold.update(A, 137, FRAME).completed).toBe(false);
    expect(hold.update(A, 311, FRAME).completed).toBe(false);
    expect(hold.update(A, 499, FRAME).completed).toBe(false);
    expect(hold.update(A, 500, FRAME)).toEqual({ completed: true, progress: 0 });
    expect(hold.latched).toBe(true);
  });

  it("tolerates one short landmark excursion without restarting the hold", () => {
    const hold = tracker();

    hold.update(A, 0, FRAME);
    hold.update(A, 100, FRAME);
    expect(hold.update(B, 200, FRAME).completed).toBe(false);
    expect(hold.update(A, 250, FRAME).completed).toBe(false);
    expect(hold.update(A, 500, FRAME).completed).toBe(true);
  });

  it("rejects frequent excursions that consume more than the accepted time share", () => {
    const hold = tracker();

    hold.update(A, 0, FRAME);
    for (let atMs = 50; atMs <= 500; atMs += 50) {
      const point = atMs % 100 === 0 ? A : B;
      expect(hold.update(point, atMs, FRAME).completed).toBe(false);
    }
    expect(hold.latched).toBe(false);
    expect(hold.progress).toBe(0);
  });

  it("times a stable new region from its first clustered sample", () => {
    const hold = tracker();

    hold.update(A, 0, FRAME);
    hold.update(A, 100, FRAME);
    hold.update(B, 200, FRAME);
    hold.update(B, 250, FRAME);
    expect(hold.update(B, 300, FRAME).progress).toBeCloseTo(0.2);
    hold.update(B, 500, FRAME);
    expect(hold.update(B, 699, FRAME).completed).toBe(false);
    expect(hold.update(B, 700, FRAME).completed).toBe(true);
  });

  it("does not treat continuous movement as a stationary region", () => {
    const hold = tracker();

    for (let atMs = 0; atMs <= 1_000; atMs += 50) {
      const point = { x: 0.4 + (atMs / 50) * 0.02, y: 0.5 };
      expect(hold.update(point, atMs, FRAME).completed).toBe(false);
    }
    expect(hold.latched).toBe(false);
  });

  it("stays latched through an isolated spike and rearms after deliberate movement", () => {
    const hold = tracker();

    hold.update(A, 0, FRAME);
    hold.update(A, 200, FRAME);
    hold.update(A, 400, FRAME);
    expect(hold.update(A, 500, FRAME).completed).toBe(true);

    hold.update(B, 550, FRAME);
    hold.update(A, 600, FRAME);
    expect(hold.latched).toBe(true);

    hold.update(B, 700, FRAME);
    hold.update(B, 800, FRAME);
    expect(hold.latched).toBe(false);
    hold.update(B, 1_000, FRAME);
    expect(hold.update(B, 1_199, FRAME).completed).toBe(false);
    expect(hold.update(B, 1_200, FRAME).completed).toBe(true);
  });

  it("resets evidence across a stale sample gap", () => {
    const hold = tracker();

    hold.update(A, 0, FRAME);
    hold.update(A, 200, FRAME);
    expect(hold.update(A, 500, FRAME).progress).toBe(0);
    hold.update(A, 700, FRAME);
    hold.update(A, 900, FRAME);
    expect(hold.update(A, 999, FRAME).completed).toBe(false);
    expect(hold.update(A, 1_000, FRAME).completed).toBe(true);
  });
});

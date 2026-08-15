import { describe, expect, it, vi } from "vitest";
import { drawBubbles } from "../../src/games/bubbles/bubbles-renderer";
import type { BubblesSnapshot } from "../../src/games/bubbles/bubbles-session";

function gradient() {
  return { addColorStop: vi.fn() } as unknown as CanvasGradient;
}

function contextMock(): CanvasRenderingContext2D {
  return {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    createLinearGradient: vi.fn(gradient),
    createRadialGradient: vi.fn(gradient),
    fill: vi.fn(),
    fillText: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("Bubbles renderer", () => {
  it("draws procedural active/pop bubbles, bounded effects, labels, and hand rings", () => {
    const snapshot: BubblesSnapshot = {
      paused: false,
      phase: "playing",
      playerCount: 2,
      visiblePlayers: 2,
      readyToStart: true,
      scores: { left: 1, right: 0 },
      startingRemainingMs: 0,
      roundRemainingMs: 59_000,
      roundElapsedMs: 1_000,
      bubbles: [
        {
          id: 1,
          point: { x: 0.3, y: 0.4 },
          radius: 0.05,
          velocity: { x: 0.03, y: -0.01 },
          hue: 190,
          shimmerPhase: 0.4,
          spawnedAtMs: 0,
          state: "active",
          poppedAtMs: null,
          poppedBy: null,
        },
        {
          id: 2,
          point: { x: 0.7, y: 0.6 },
          radius: 0.04,
          velocity: { x: -0.02, y: 0.01 },
          hue: 300,
          shimmerPhase: 1.2,
          spawnedAtMs: 0,
          state: "popping",
          poppedAtMs: 880,
          poppedBy: "left",
        },
      ],
      hands: [
        { side: "left", hand: "left", point: { x: 0.2, y: 0.5 } },
        { side: "right", hand: "right", point: { x: 0.8, y: 0.5 } },
      ],
      result: null,
      lastPopAtMs: { left: 880, right: null },
      nowMs: 1_000,
    };
    const context = contextMock();

    drawBubbles(context, snapshot, 1_280, 720);

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 1_280, 720);
    expect(context.createRadialGradient).toHaveBeenCalledTimes(2);
    expect(context.createLinearGradient).toHaveBeenCalledTimes(2);
    expect(context.fillText).toHaveBeenCalledWith("+1", expect.any(Number), expect.any(Number));
    expect(context.arc).toHaveBeenCalledTimes(20);
  });

  it("does not render gameplay hand rings before or after a round", () => {
    const snapshot: BubblesSnapshot = {
      paused: false,
      phase: "ready",
      playerCount: 1,
      visiblePlayers: 1,
      readyToStart: true,
      scores: { left: 0, right: 0 },
      startingRemainingMs: 0,
      roundRemainingMs: 60_000,
      roundElapsedMs: 0,
      bubbles: [],
      hands: [{ side: "right", hand: "left", point: { x: 0.5, y: 0.5 } }],
      result: null,
      lastPopAtMs: { left: null, right: null },
      nowMs: 0,
    };
    const context = contextMock();

    drawBubbles(context, snapshot, 1_280, 720);

    expect(context.arc).not.toHaveBeenCalled();
  });
});

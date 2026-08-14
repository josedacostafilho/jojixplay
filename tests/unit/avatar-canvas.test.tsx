import { act, cleanup, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AvatarCanvas } from "../../src/components/avatar-canvas";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";
import { AVATAR_APPEARANCES } from "../../src/render/avatar";

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function packet(sequence: number): PosePacket {
  const pose: DetectedPose = { landmarks: Array.from({ length: 33 }, hiddenLandmark) };
  for (const [index, x, y] of [
    [11, 0.4, 0.3],
    [12, 0.6, 0.3],
    [23, 0.44, 0.58],
    [24, 0.56, 0.58],
  ] as const) {
    const target = pose.landmarks[index];
    if (target === undefined) {
      throw new Error(`Missing test landmark ${index}.`);
    }
    Object.assign(target, { x, y, visibility: 1 });
  }
  return {
    sequence,
    capturedAtMs: sequence * 100,
    frame: { width: 1_000, height: 1_000 },
    poses: [pose],
  };
}

class ImmediateResizeObserver {
  public constructor(private readonly callback: ResizeObserverCallback) {}

  public observe(): void {
    this.callback(
      [{ contentRect: { width: 640, height: 360 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  public unobserve(): void {}

  public disconnect(): void {}
}

let callbacks: FrameRequestCallback[] = [];
let context: CanvasRenderingContext2D;

function flushAnimationFrames(): void {
  const pending = callbacks;
  callbacks = [];
  act(() => {
    for (const callback of pending) {
      callback(0);
    }
  });
}

beforeEach(() => {
  callbacks = [];
  vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return callbacks.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  context = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    ellipse: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => context);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Avatar canvas", () => {
  it("renders event-driven camera and stage profiles with an accessible label", () => {
    const view = render(
      <AvatarCanvas
        packet={packet(1)}
        label="Local live body avatar"
        className="avatar-canvas avatar-canvas--camera"
        appearance="camera"
      />,
    );
    flushAnimationFrames();

    const canvas = screen.getByRole("img", { name: "Local live body avatar" });
    expect(canvas).toHaveClass("avatar-canvas--camera");
    expect(canvas).toHaveAttribute("width", "640");
    expect(canvas).toHaveAttribute("height", "360");
    expect(context.globalAlpha).toBe(AVATAR_APPEARANCES.camera.opacity);

    view.rerender(
      <AvatarCanvas
        packet={packet(1)}
        label="Local live body avatar"
        className="avatar-canvas avatar-canvas--camera"
        appearance="stage"
      />,
    );
    flushAnimationFrames();
    expect(context.globalAlpha).toBe(AVATAR_APPEARANCES.stage.opacity);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it("clears the canvas when pose input disappears", () => {
    const view = render(<AvatarCanvas packet={packet(1)} label="Avatar" appearance="camera" />);
    flushAnimationFrames();
    vi.mocked(context.clearRect).mockClear();

    view.rerender(<AvatarCanvas packet={null} label="Avatar" appearance="camera" />);
    flushAnimationFrames();

    expect(context.clearRect).toHaveBeenCalledWith(0, 0, 640, 360);
  });
});

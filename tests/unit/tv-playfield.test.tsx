import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TvPlayfield } from "../../src/components/tv-playfield";
import type { DetectedPose, PoseLandmark, PosePacket } from "../../src/domain/pose";

function hiddenLandmark(): PoseLandmark {
  return { x: 0.5, y: 0.5, z: 0, visibility: 0 };
}

function visibleLandmark(pose: DetectedPose, index: number, x: number, y: number): void {
  const landmark = pose.landmarks[index];
  if (landmark === undefined) {
    throw new Error(`Missing test landmark ${index}.`);
  }
  Object.assign(landmark, { x, y, visibility: 1 });
}

function createRaisedHandPacket(sequence: number): PosePacket {
  const pose: DetectedPose = { landmarks: Array.from({ length: 33 }, hiddenLandmark) };
  visibleLandmark(pose, 11, 0.4, 0.3);
  visibleLandmark(pose, 12, 0.6, 0.3);
  visibleLandmark(pose, 13, 0.4, 0.5);
  visibleLandmark(pose, 14, 0.6, 0.5);
  visibleLandmark(pose, 15, 0.4, 0.2);
  visibleLandmark(pose, 16, 0.6, 0.55);
  visibleLandmark(pose, 23, 0.43, 0.65);
  visibleLandmark(pose, 24, 0.57, 0.65);
  return {
    sequence,
    capturedAtMs: sequence * 100,
    frame: { width: 1_280, height: 720 },
    poses: [pose],
  };
}

class ImmediateResizeObserver {
  readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(): void {
    this.callback(
      [{ contentRect: { width: 1_280, height: 720 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {}

  disconnect(): void {}
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TV playfield", () => {
  it("exposes all claimed actions and applies acknowledged player-mode changes", async () => {
    let nowMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    const requestAnimationFrame = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({}) as CanvasRenderingContext2D,
    );

    const onPoseLimitRequest = vi.fn(async () => undefined);
    const renderPlayfield = (packet: PosePacket, poseLimit: 1 | 2 = 1) => (
      <TvPlayfield
        packet={packet}
        poseLimit={poseLimit}
        poseLimitPending={false}
        onPoseLimitRequest={onPoseLimitRequest}
      />
    );
    const view = render(renderPlayfield(createRaisedHandPacket(0)));
    for (const sequence of [1, 2, 3]) {
      nowMs = sequence * 100;
      view.rerender(renderPlayfield(createRaisedHandPacket(sequence)));
    }

    const backgroundButton = screen.getByRole("button", { name: "Background" });
    const playersButton = screen.getByRole("button", { name: "Switch to 2-player mode" });
    const circlesButton = screen.getByRole("button", { name: "Circles" });
    const playfield = view.container.querySelector<HTMLElement>(".tv-playfield");
    const cursor = view.container.querySelector<HTMLElement>(".pose-cursor");
    expect(playfield).not.toBeNull();
    expect(cursor).not.toBeNull();
    expect(playfield).toHaveAttribute("data-background-theme", "navy");
    expect(cursor).toHaveStyle("--pose-cursor-color: #5eead4");

    fireEvent.click(backgroundButton);
    expect(playfield).toHaveAttribute("data-background-theme", "plum");

    fireEvent.click(playersButton);
    expect(onPoseLimitRequest).toHaveBeenCalledWith(2);
    await screen.findByText("2-player mode is active.");

    view.rerender(renderPlayfield(createRaisedHandPacket(4), 2));
    expect(screen.getByRole("button", { name: "Switch to 1-player mode" })).toHaveTextContent(
      "Players: 2",
    );
    expect(cursor).toHaveStyle("--pose-cursor-color: #5eead4");

    requestAnimationFrame.mockClear();
    fireEvent.click(circlesButton);
    expect(screen.getByText("Circle burst created.")).toBeInTheDocument();
    expect(requestAnimationFrame).toHaveBeenCalledOnce();
  });

  it("suspends actions while a player-mode request is pending", () => {
    let nowMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({}) as CanvasRenderingContext2D,
    );

    const view = render(
      <TvPlayfield
        packet={createRaisedHandPacket(0)}
        poseLimit={1}
        poseLimitPending
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />,
    );
    for (const sequence of [1, 2, 3]) {
      nowMs = sequence * 100;
      view.rerender(
        <TvPlayfield
          packet={createRaisedHandPacket(sequence)}
          poseLimit={1}
          poseLimitPending
          onPoseLimitRequest={vi.fn(async () => undefined)}
        />,
      );
    }

    expect(screen.getByRole("button", { name: "Background" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Switch to 2-player mode" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Circles" })).toBeDisabled();
  });

  it("suspends repeated semantic actions immediately when a player-mode request starts", () => {
    let nowMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({}) as CanvasRenderingContext2D,
    );

    const onPoseLimitRequest = vi.fn(() => new Promise<void>(() => undefined));
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending={false}
        onPoseLimitRequest={onPoseLimitRequest}
      />
    );
    const view = render(renderPlayfield(createRaisedHandPacket(0)));
    for (const sequence of [1, 2, 3]) {
      nowMs = sequence * 100;
      view.rerender(renderPlayfield(createRaisedHandPacket(sequence)));
    }

    fireEvent.click(screen.getByRole("button", { name: "Switch to 2-player mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Switch to 2-player mode" }));
    fireEvent.click(screen.getByRole("button", { name: "Background" }));

    expect(onPoseLimitRequest).toHaveBeenCalledOnce();
    expect(view.container.querySelector(".tv-playfield")).toHaveAttribute(
      "data-background-theme",
      "navy",
    );
  });

  it("retains the acknowledged mode and announces a failed player-mode request", async () => {
    let nowMs = 0;
    vi.spyOn(performance, "now").mockImplementation(() => nowMs);
    vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 1),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => ({}) as CanvasRenderingContext2D,
    );

    const onPoseLimitRequest = vi.fn(async () => {
      throw new Error("Phone rejected the request.");
    });
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending={false}
        onPoseLimitRequest={onPoseLimitRequest}
      />
    );
    const view = render(renderPlayfield(createRaisedHandPacket(0)));
    for (const sequence of [1, 2, 3]) {
      nowMs = sequence * 100;
      view.rerender(renderPlayfield(createRaisedHandPacket(sequence)));
    }

    fireEvent.click(screen.getByRole("button", { name: "Switch to 2-player mode" }));

    await screen.findByText(
      "Player mode could not be changed. 1-player mode remains active. Check the phone and restart body tracking if needed.",
    );
    expect(screen.getByRole("button", { name: "Switch to 2-player mode" })).toHaveTextContent(
      "Players: 1",
    );
  });
});

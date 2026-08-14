import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  visibleLandmark(pose, 0, 0.5, 0.16);
  visibleLandmark(pose, 11, 0.4, 0.3);
  visibleLandmark(pose, 12, 0.6, 0.3);
  visibleLandmark(pose, 13, 0.4, 0.5);
  visibleLandmark(pose, 14, 0.6, 0.5);
  visibleLandmark(pose, 15, 0.4, 0.2);
  visibleLandmark(pose, 16, 0.6, 0.55);
  visibleLandmark(pose, 17, 0.38, 0.18);
  visibleLandmark(pose, 18, 0.58, 0.57);
  visibleLandmark(pose, 19, 0.4, 0.17);
  visibleLandmark(pose, 20, 0.6, 0.58);
  visibleLandmark(pose, 21, 0.42, 0.18);
  visibleLandmark(pose, 22, 0.62, 0.57);
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
  public constructor(private readonly callback: ResizeObserverCallback) {}

  public observe(): void {
    this.callback(
      [{ contentRect: { width: 1_280, height: 720 } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }

  public unobserve(): void {}

  public disconnect(): void {}
}

let nowMs = 0;
let animationCallbacks: FrameRequestCallback[] = [];
let canvasContext: CanvasRenderingContext2D;

beforeEach(() => {
  nowMs = 0;
  animationCallbacks = [];
  vi.spyOn(performance, "now").mockImplementation(() => nowMs);
  vi.stubGlobal("ResizeObserver", ImmediateResizeObserver);
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      animationCallbacks.push(callback);
      return animationCallbacks.length;
    }),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  canvasContext = {
    arc: vi.fn(),
    beginPath: vi.fn(),
    clearRect: vi.fn(),
    fill: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => canvasContext);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function claimControls(
  view: ReturnType<typeof render>,
  renderPlayfield: (packet: PosePacket) => preact.JSX.Element,
  packetFactory: (sequence: number) => PosePacket = createRaisedHandPacket,
): void {
  for (const sequence of [1, 2, 3]) {
    nowMs = sequence * 100;
    view.rerender(renderPlayfield(packetFactory(sequence)));
  }
}

describe("TV playfield", () => {
  it("exposes Main Menu actions, applies player-mode acknowledgement, and navigates Games", async () => {
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
    claimControls(view, (packet) => renderPlayfield(packet));

    const playfield = view.container.querySelector<HTMLElement>(".tv-playfield");
    const cursor = view.container.querySelector<HTMLElement>(".pose-cursor");
    expect(playfield).toHaveAttribute("data-playfield-view", "main");
    expect(playfield).toHaveAttribute("data-background-theme", "navy");
    expect(cursor).toHaveStyle("--pose-cursor-color: #5eead4");
    expect(screen.getByRole("button", { name: "Background" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to 2-player mode" })).toHaveTextContent(
      "Players: 1",
    );
    expect(screen.getByRole("button", { name: "Games" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Circles" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Background" }));
    expect(playfield).toHaveAttribute("data-background-theme", "plum");
    fireEvent.click(screen.getByRole("button", { name: "Switch to 2-player mode" }));
    expect(onPoseLimitRequest).toHaveBeenCalledWith(2);
    await screen.findByText("2-player mode is active.");
    view.rerender(renderPlayfield(createRaisedHandPacket(4), 2));
    expect(screen.getByRole("button", { name: "Switch to 1-player mode" })).toHaveTextContent(
      "Players: 2",
    );

    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "games");
    expect(screen.getByRole("button", { name: "Draw" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to Main Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to Main Menu" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "main");
  });

  it("opens Draw on the exact camera projection and retains its color across Exit", () => {
    const createPortraitPacket = (sequence: number) => ({
      ...createRaisedHandPacket(sequence),
      frame: { width: 720, height: 1_280 },
    });
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending={false}
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />
    );
    const view = render(renderPlayfield(createPortraitPacket(0)));
    claimControls(view, renderPlayfield, createPortraitPacket);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    animationCallbacks = [];
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));

    const playfield = view.container.querySelector<HTMLElement>(".tv-playfield");
    expect(playfield).toHaveAttribute("data-playfield-view", "draw");
    expect(screen.getByTestId("draw-board")).toHaveStyle({
      left: "437.5px",
      top: "0px",
      width: "405px",
      height: "720px",
    });
    expect(screen.getByRole("img", { name: "Your Draw artwork" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change drawing color/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear drawing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit Draw" })).toBeInTheDocument();
    animationCallbacks.at(-1)?.(0);
    expect(canvasContext.globalAlpha).toBe(0.28);

    fireEvent.click(screen.getByRole("button", { name: /Change drawing color/ }));
    expect(
      screen.getByRole("button", { name: "Change drawing color; current color #2563eb" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit Draw" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "games");
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(
      screen.getByRole("button", { name: "Change drawing color; current color #2563eb" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear drawing" }));
    expect(screen.getByText("Drawing cleared.")).toBeInTheDocument();
  });

  it("asks for overhead framing and withholds controls when the head is too high", () => {
    const noHeadroomPacket = (sequence: number) => {
      const posePacket = createRaisedHandPacket(sequence);
      const face = posePacket.poses[0]?.landmarks[0];
      if (face === undefined) {
        throw new Error("Expected a face landmark.");
      }
      face.y = 0.04;
      return posePacket;
    };
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending={false}
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />
    );
    const view = render(renderPlayfield(noHeadroomPacket(0)));
    for (const sequence of [1, 2, 3]) {
      nowMs = sequence * 100;
      view.rerender(renderPlayfield(noHeadroomPacket(sequence)));
    }

    expect(screen.getByText("Step back and leave clear space above your head")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
  });

  it("disables every current action while a player-mode request is pending", () => {
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />
    );
    const view = render(renderPlayfield(createRaisedHandPacket(0)));
    claimControls(view, renderPlayfield);

    expect(screen.getByRole("button", { name: "Background" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Switch to 2-player mode" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Games" })).toBeDisabled();
  });

  it("suspends repeated semantic actions immediately when a player-mode request starts", () => {
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
    claimControls(view, renderPlayfield);

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
    claimControls(view, renderPlayfield);
    fireEvent.click(screen.getByRole("button", { name: "Switch to 2-player mode" }));

    await screen.findByText(
      "Player mode could not be changed. 1-player mode remains active. Check the phone and restart body tracking if needed.",
    );
    expect(screen.getByRole("button", { name: "Switch to 2-player mode" })).toHaveTextContent(
      "Players: 1",
    );
  });
});

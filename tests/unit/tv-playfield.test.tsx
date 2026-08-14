import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
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

function createCloseHandsPacket(sequence: number): PosePacket {
  const posePacket = createRaisedHandPacket(sequence);
  const pose = posePacket.poses[0];
  if (pose === undefined) {
    throw new Error("Expected one pose.");
  }
  for (const [index, x, y] of [
    [16, 0.47, 0.2],
    [18, 0.45, 0.19],
    [20, 0.47, 0.18],
    [22, 0.49, 0.19],
  ] as const) {
    visibleLandmark(pose, index, x, y);
  }
  return posePacket;
}

function createTwoPlayerPacket(sequence: number): PosePacket {
  const source = createCloseHandsPacket(sequence);
  const basePose = source.poses[0];
  if (basePose === undefined) {
    throw new Error("Expected a source pose.");
  }
  const shiftedPose = (offset: number): DetectedPose => ({
    landmarks: basePose.landmarks.map((landmark) => ({
      ...landmark,
      x: landmark.visibility > 0 ? landmark.x + offset : landmark.x,
    })),
  });
  return { ...source, poses: [shiftedPose(-0.2), shiftedPose(0.2)] };
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
    closePath: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    ellipse: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
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

function runAnimationFrame(timestamp: number): void {
  const callbacks = animationCallbacks;
  animationCallbacks = [];
  act(() => {
    for (const callback of callbacks) {
      callback(timestamp);
    }
  });
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
    expect(screen.getByRole("button", { name: "Bubbles" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Return to Main Menu" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Background" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to Main Menu" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "main");
  });

  it("uses a compact left Draw toolbar and retains its tool and color across Exit", () => {
    const createPortraitPacket = (sequence: number) => ({
      ...createRaisedHandPacket(sequence),
      frame: { width: 720, height: 1_280 },
    });
    const createClosePortraitPacket = (sequence: number) => ({
      ...createCloseHandsPacket(sequence),
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
    const toolButton = screen.getByRole("button", {
      name: "Switch to Eraser; current tool Pencil",
    });
    expect(screen.getByRole("button", { name: /Change drawing color/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear drawing" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit Draw" })).toBeInTheDocument();
    const drawButtons = [
      toolButton,
      screen.getByRole("button", { name: /Change drawing color/ }),
      screen.getByRole("button", { name: "Clear drawing" }),
      screen.getByRole("button", { name: "Exit Draw" }),
    ];
    expect(view.container.querySelector(".pose-control-targets")).toHaveAttribute(
      "data-control-placement",
      "left-column",
    );
    expect(drawButtons.map(({ style }) => style.left)).toEqual([
      drawButtons[0]?.style.left,
      drawButtons[0]?.style.left,
      drawButtons[0]?.style.left,
      drawButtons[0]?.style.left,
    ]);
    expect(drawButtons.map(({ style }) => Number.parseFloat(style.top))).toEqual(
      [...drawButtons]
        .map(({ style }) => Number.parseFloat(style.top))
        .sort((left, right) => left - right),
    );
    expect(Number.parseFloat(toolButton.style.width)).toBeLessThan(150);

    nowMs = 400;
    view.rerender(renderPlayfield(createClosePortraitPacket(4)));
    expect(view.container.querySelectorAll(".draw-tool-cursor")).toHaveLength(1);
    expect(view.container.querySelector(".draw-tool-cursor--pencil")).toBeInTheDocument();
    animationCallbacks.at(-1)?.(0);
    expect(canvasContext.globalAlpha).toBe(0.24);

    fireEvent.click(toolButton);
    expect(screen.getByText("Eraser selected.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Switch to Pencil; current tool Eraser" }),
    ).toBeInTheDocument();
    expect(view.container.querySelector(".draw-tool-cursor--eraser")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Change drawing color/ }));
    expect(
      screen.getByRole("button", { name: "Change drawing color; current color #2563eb" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit Draw" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "games");
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    expect(
      screen.getByRole("button", { name: "Switch to Pencil; current tool Eraser" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Change drawing color; current color #2563eb" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear drawing" }));
    expect(screen.getByText("Drawing cleared.")).toBeInTheDocument();
  });

  it("runs the Bubbles countdown, suspends controls, and exposes results", () => {
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={1}
        poseLimitPending={false}
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />
    );
    const view = render(renderPlayfield(createRaisedHandPacket(0)));
    claimControls(view, renderPlayfield);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.click(screen.getByRole("button", { name: "Bubbles" }));

    const playfield = view.container.querySelector<HTMLElement>(".tv-playfield");
    expect(playfield).toHaveAttribute("data-playfield-view", "bubbles");
    expect(screen.getByTestId("bubbles-board")).toHaveStyle({
      left: "0px",
      top: "0px",
      width: "1280px",
      height: "720px",
    });
    expect(screen.getByRole("img", { name: "Bubbles game arena" })).toBeInTheDocument();
    expect(screen.getByLabelText("Score")).toHaveTextContent("0");
    expect(screen.queryByLabelText("Left player score")).not.toBeInTheDocument();
    expect(view.container.querySelector(".bubbles-timer")).toHaveTextContent("1:00");
    expect(screen.getByRole("button", { name: "Start Bubbles" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Exit Bubbles" })).toBeInTheDocument();

    animationCallbacks = [];
    nowMs = 400;
    fireEvent.click(screen.getByRole("button", { name: "Start Bubbles" }));
    expect(screen.getByTestId("bubbles-board")).toHaveAttribute("data-bubbles-phase", "starting");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Exit Bubbles" })).not.toBeInTheDocument();

    nowMs = 3_400;
    runAnimationFrame(nowMs);
    expect(screen.getByTestId("bubbles-board")).toHaveAttribute("data-bubbles-phase", "playing");
    expect(screen.getByText("Go!")).toBeInTheDocument();
    expect(view.container.querySelector(".bubbles-timer")).toHaveTextContent("1:00");

    nowMs = 4_400;
    runAnimationFrame(nowMs);
    expect(view.container.querySelector(".bubbles-timer")).toHaveTextContent("0:59");

    nowMs = 63_400;
    runAnimationFrame(nowMs);
    expect(screen.getByTestId("bubbles-board")).toHaveAttribute("data-bubbles-phase", "finished");
    expect(screen.getByText("Final score: 0.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play Bubbles again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Exit Bubbles" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Exit Bubbles" }));
    expect(playfield).toHaveAttribute("data-playfield-view", "games");
  });

  it("shows identity-independent left and right Bubbles score slots in two-player mode", () => {
    const renderPlayfield = (packet: PosePacket) => (
      <TvPlayfield
        packet={packet}
        poseLimit={2}
        poseLimitPending={false}
        onPoseLimitRequest={vi.fn(async () => undefined)}
      />
    );
    const view = render(renderPlayfield(createTwoPlayerPacket(0)));
    for (const sequence of [1, 2, 3, 4, 5]) {
      nowMs = sequence * 100;
      view.rerender(renderPlayfield(createTwoPlayerPacket(sequence)));
    }
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.click(screen.getByRole("button", { name: "Bubbles" }));

    expect(screen.getByLabelText("Left player score")).toHaveTextContent("Left0");
    expect(screen.getByLabelText("Right player score")).toHaveTextContent("Right0");
    expect(screen.getByText("Both players ready")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start Bubbles" })).toBeEnabled();
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

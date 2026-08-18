import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CameraLayout } from "../../src/domain/camera";
import type { PosePacket } from "../../src/domain/pose";
import type { PoseLimit } from "../../src/domain/pose-limit";
import { LocalPlayPage } from "../../src/pages/local-play-page";

interface CapturedPlayfieldProps {
  audio: unknown;
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  poseLimitPending: boolean;
  cameraLayoutPending: boolean;
  onPoseLimitRequest: (poseLimit: PoseLimit) => Promise<void>;
  onCameraLayoutRequest: (layout: CameraLayout) => Promise<void>;
}

const localMocks = vi.hoisted(() => ({
  camera: {
    videoRef: { current: null as HTMLVideoElement | null },
    state: "idle" as "idle" | "starting" | "tracking" | "error",
    packet: null as PosePacket | null,
    poseLimit: 1 as PoseLimit,
    cameraFrame: null,
    requestedCameraLayout: null as CameraLayout | null,
    diagnostics: null,
    errorMessage: null as string | null,
    start: vi.fn(async () => true),
    stop: vi.fn(),
    setPoseLimit: vi.fn(async (_poseLimit: 1 | 2): Promise<void> => undefined),
    requestCameraLayout: vi.fn(
      async (_layout: "portrait" | "landscape"): Promise<void> => undefined,
    ),
  },
  immersiveStart: vi.fn(),
  immersiveStop: vi.fn(async () => undefined),
  audioStart: vi.fn(async () => undefined),
  audioResume: vi.fn(async () => undefined),
  audioStop: vi.fn(async () => undefined),
  audioSetMuted: vi.fn(),
  audioPlayCue: vi.fn(),
  audioSetDrawContact: vi.fn(),
  audioSetRacingCars: vi.fn(),
  latestPlayfieldProps: null as CapturedPlayfieldProps | null,
}));

vi.mock("../../src/audio/audio-engine", () => ({
  AppAudioEngine: class AppAudioEngineMock {
    private mutedValue = false;

    public constructor(
      private readonly onStateChange: (state: "idle" | "starting" | "running" | "error") => void,
    ) {}

    public get muted(): boolean {
      return this.mutedValue;
    }

    public async start(): Promise<void> {
      this.onStateChange("starting");
      try {
        await localMocks.audioStart();
        this.onStateChange("running");
      } catch (error) {
        this.onStateChange("error");
        throw error;
      }
    }

    public async resume(): Promise<void> {
      await localMocks.audioResume();
      this.onStateChange("running");
    }

    public async stop(): Promise<void> {
      await localMocks.audioStop();
      this.onStateChange("idle");
    }

    public setMuted(muted: boolean): void {
      this.mutedValue = muted;
      localMocks.audioSetMuted(muted);
    }

    public playCue = localMocks.audioPlayCue;
    public setDrawContact = localMocks.audioSetDrawContact;
    public setRacingCars = localMocks.audioSetRacingCars;
  },
}));

vi.mock("../../src/platform/capabilities", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/platform/capabilities")>()),
  inspectLocalPlayCapabilities: () => ({ supported: true, missing: [] }),
}));

vi.mock("../../src/pose/use-camera-pose", () => ({
  useCameraPose: () => localMocks.camera,
}));

vi.mock("../../src/platform/local-immersive-session", () => ({
  LocalImmersiveSession: class LocalImmersiveSessionMock {
    public readonly start = localMocks.immersiveStart;
    public readonly stop = localMocks.immersiveStop;
  },
}));

vi.mock("../../src/components/body-playfield", () => ({
  BodyPlayfield: (props: CapturedPlayfieldProps) => {
    localMocks.latestPlayfieldProps = props;
    return <div data-testid="shared-body-playfield" />;
  },
}));

const EMPTY_PACKET: PosePacket = {
  sequence: 4,
  capturedAtMs: 120,
  frame: { width: 1_280, height: 720, layout: "landscape", epoch: 0 },
  poses: [],
};

beforeEach(() => {
  localMocks.camera.state = "idle";
  localMocks.camera.packet = null;
  localMocks.camera.poseLimit = 1;
  localMocks.camera.requestedCameraLayout = null;
  localMocks.camera.errorMessage = null;
  localMocks.camera.start.mockReset().mockResolvedValue(true);
  localMocks.camera.stop.mockReset();
  localMocks.camera.setPoseLimit.mockReset().mockResolvedValue(undefined);
  localMocks.camera.requestCameraLayout.mockReset().mockResolvedValue(undefined);
  localMocks.immersiveStart.mockReset();
  localMocks.immersiveStop.mockReset().mockResolvedValue(undefined);
  localMocks.audioStart.mockReset().mockResolvedValue(undefined);
  localMocks.audioResume.mockReset().mockResolvedValue(undefined);
  localMocks.audioStop.mockReset().mockResolvedValue(undefined);
  localMocks.audioSetMuted.mockReset();
  localMocks.audioPlayCue.mockReset();
  localMocks.audioSetDrawContact.mockReset();
  localMocks.audioSetRacingCars.mockReset();
  localMocks.latestPlayfieldProps = null;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("local play page", () => {
  it("starts camera and optional immersive behavior only after explicit activation", async () => {
    const view = render(<LocalPlayPage />);

    expect(
      screen.getByRole("heading", { name: "Play right here on your phone." }),
    ).toBeInTheDocument();
    expect(localMocks.camera.start).not.toHaveBeenCalled();
    expect(localMocks.immersiveStart).not.toHaveBeenCalled();
    expect(localMocks.audioStart).not.toHaveBeenCalled();
    const captureSource = view.container.querySelector("video.local-camera-source");
    expect(captureSource).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByLabelText(/camera preview/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));

    expect(localMocks.immersiveStart).toHaveBeenCalledOnce();
    expect(localMocks.camera.start).toHaveBeenCalledOnce();
    expect(localMocks.audioStart).toHaveBeenCalledOnce();
    await waitFor(() => expect(localMocks.immersiveStop).not.toHaveBeenCalled());
  });

  it("feeds the current packet directly into the shared playfield and stops every local owner", async () => {
    const view = render(<LocalPlayPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));
    await waitFor(() => expect(localMocks.audioStart).toHaveBeenCalledOnce());
    localMocks.camera.state = "tracking";
    localMocks.camera.packet = EMPTY_PACKET;
    view.rerender(<LocalPlayPage />);

    expect(screen.getByTestId("shared-body-playfield")).toBeInTheDocument();
    expect(localMocks.latestPlayfieldProps?.packet).toBe(EMPTY_PACKET);
    expect(localMocks.latestPlayfieldProps?.poseLimit).toBe(1);
    expect(screen.getByRole("button", { name: "Stop local play" })).toBeInTheDocument();
    expect(view.container.querySelector("video.local-camera-source")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Stop local play" }));

    expect(localMocks.camera.stop).toHaveBeenCalledWith({ resetPoseLimit: true });
    expect(localMocks.immersiveStop).toHaveBeenCalledOnce();
    expect(localMocks.audioStop).toHaveBeenCalledOnce();
  });

  it("withholds a local packet after the one-second freshness bound", async () => {
    vi.useFakeTimers();
    const view = render(<LocalPlayPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));
    await act(async () => undefined);
    localMocks.camera.state = "tracking";
    localMocks.camera.packet = EMPTY_PACKET;
    view.rerender(<LocalPlayPage />);

    await act(async () => undefined);
    expect(localMocks.latestPlayfieldProps?.packet).toBe(EMPTY_PACKET);

    act(() => {
      vi.advanceTimersByTime(1_001);
    });
    expect(localMocks.latestPlayfieldProps?.packet).toBeNull();
  });

  it("keeps direct player and layout requests pending until the camera controller applies them", async () => {
    let resolvePoseLimit: (() => void) | null = null;
    localMocks.camera.setPoseLimit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePoseLimit = resolve;
        }),
    );
    const view = render(<LocalPlayPage />);
    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));
    await waitFor(() => expect(localMocks.audioStart).toHaveBeenCalledOnce());
    localMocks.camera.state = "tracking";
    localMocks.camera.packet = EMPTY_PACKET;
    view.rerender(<LocalPlayPage />);

    const initialProps = localMocks.latestPlayfieldProps;
    if (initialProps === null) {
      throw new Error("The shared body playfield did not mount.");
    }
    let poseLimitRequest: Promise<void> | null = null;
    act(() => {
      poseLimitRequest = initialProps.onPoseLimitRequest(2);
    });
    await waitFor(() => expect(localMocks.latestPlayfieldProps?.poseLimitPending).toBe(true));
    expect(localMocks.camera.poseLimit).toBe(1);
    expect(localMocks.camera.setPoseLimit).toHaveBeenCalledWith(2);

    await act(async () => {
      resolvePoseLimit?.();
      await poseLimitRequest;
    });
    expect(localMocks.latestPlayfieldProps?.poseLimitPending).toBe(false);

    await act(async () => {
      await localMocks.latestPlayfieldProps?.onCameraLayoutRequest("landscape");
    });
    expect(localMocks.camera.requestCameraLayout).toHaveBeenCalledWith("landscape");
    expect(localMocks.latestPlayfieldProps?.cameraLayoutPending).toBe(false);
  });

  it("releases optional immersive ownership when startup fails or the page unmounts", async () => {
    localMocks.camera.start.mockResolvedValue(false);
    const view = render(<LocalPlayPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));
    await waitFor(() => expect(localMocks.immersiveStop).toHaveBeenCalledOnce());
    expect(localMocks.audioStop).toHaveBeenCalledOnce();

    view.unmount();
    expect(localMocks.immersiveStop).toHaveBeenCalledTimes(2);
    expect(localMocks.audioStop).toHaveBeenCalledTimes(2);
  });

  it("tears down partial startup and reports an audio startup failure", async () => {
    localMocks.audioStart.mockRejectedValue(new Error("blocked"));
    render(<LocalPlayPage />);

    fireEvent.click(screen.getByRole("button", { name: "Start local play" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Local play could not start its camera and sound.",
    );
    expect(localMocks.camera.stop).toHaveBeenCalledWith({ resetPoseLimit: true });
    expect(localMocks.audioStop).toHaveBeenCalledOnce();
    expect(localMocks.immersiveStop).toHaveBeenCalledOnce();
  });
});

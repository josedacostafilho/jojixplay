import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PosePacket } from "../../src/domain/pose";
import { useCameraPose } from "../../src/pose/use-camera-pose";

const estimator = vi.hoisted(() => ({
  initialize: vi.fn(),
  estimate: vi.fn(),
  setPoseLimit: vi.fn(),
  resetTracking: vi.fn(),
  close: vi.fn(),
}));

vi.mock("../../src/pose/pose-estimator", () => ({
  PoseEstimator: class PoseEstimatorMock {
    readonly initialize = estimator.initialize;
    readonly estimate = estimator.estimate;
    readonly setPoseLimit = estimator.setPoseLimit;
    readonly resetTracking = estimator.resetTracking;
    readonly close = estimator.close;
  },
}));

const EMPTY_PACKET: PosePacket = {
  sequence: 7,
  capturedAtMs: 100,
  frame: { width: 1_280, height: 720, layout: "landscape", epoch: 0 },
  poses: [],
};

interface CameraHarnessProps {
  onPacket: (packet: PosePacket) => void;
}

function CameraHarness({ onPacket }: CameraHarnessProps) {
  const camera = useCameraPose({ onPacket });
  return (
    <section>
      <video ref={camera.videoRef} muted playsInline />
      <output aria-label="Camera state">{camera.state}</output>
      <output aria-label="Packet sequence">{camera.packet?.sequence ?? "none"}</output>
      <output aria-label="Pose limit">{camera.poseLimit}</output>
      <button type="button" onClick={() => void camera.start()}>
        Start
      </button>
      <button type="button" onClick={() => void camera.setPoseLimit(2)}>
        Two players
      </button>
    </section>
  );
}

describe("shared camera pose lifecycle", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();
  const frameClose = vi.fn();
  let frameCallbacks: VideoFrameRequestCallback[];

  beforeEach(() => {
    estimator.initialize.mockReset().mockResolvedValue(undefined);
    estimator.estimate.mockReset().mockResolvedValue(EMPTY_PACKET);
    estimator.setPoseLimit.mockReset().mockResolvedValue(undefined);
    estimator.resetTracking.mockReset().mockResolvedValue(undefined);
    estimator.close.mockReset();
    trackStop.mockReset();
    getUserMedia.mockReset().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);
    frameClose.mockReset();
    frameCallbacks = [];
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("screen", {
      orientation: { type: "landscape-primary", angle: 0 },
    });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 1_280, height: 720, close: frameClose })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("owns one camera controller, publishes packets directly, applies mode before display, and cleans up", async () => {
    const onPacket = vi.fn();
    const view = render(<CameraHarness onPacket={onPacket} />);
    const video = view.container.querySelector("video");
    if (video === null) {
      throw new Error("Camera harness did not render its capture source.");
    }
    Object.defineProperty(video, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_CURRENT_DATA,
    });
    Object.assign(video, {
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      requestVideoFrameCallback: vi.fn((callback: VideoFrameRequestCallback) => {
        frameCallbacks.push(callback);
        return frameCallbacks.length;
      }),
      cancelVideoFrameCallback: vi.fn(),
    });

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Camera state")).toHaveTextContent("tracking"),
    );
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(estimator.initialize).toHaveBeenCalledWith(
      expect.stringContaining("mediapipe/tasks-vision-1.0.1/wasm"),
      expect.stringContaining("pose_landmarker_lite.task"),
      1,
    );

    await act(async () => {
      frameCallbacks[0]?.(100, {} as VideoFrameCallbackMetadata);
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByLabelText("Packet sequence")).toHaveTextContent("7"));
    expect(onPacket).toHaveBeenCalledWith(EMPTY_PACKET);

    let resolvePoseLimit: (() => void) | null = null;
    estimator.setPoseLimit.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolvePoseLimit = resolve;
        }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Two players" }));
    await waitFor(() => expect(estimator.setPoseLimit).toHaveBeenCalledWith(2));
    expect(screen.getByLabelText("Pose limit")).toHaveTextContent("1");

    await act(async () => {
      resolvePoseLimit?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByLabelText("Pose limit")).toHaveTextContent("2"));

    view.unmount();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(estimator.close).toHaveBeenCalledOnce();
  });
});

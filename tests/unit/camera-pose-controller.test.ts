import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PosePacket } from "../../src/domain/pose";
import { CameraPoseController } from "../../src/pose/camera-pose-controller";

const estimator = vi.hoisted(() => ({
  initialize: vi.fn(),
  estimate: vi.fn(),
  setPoseLimit: vi.fn(),
  close: vi.fn(),
}));

vi.mock("../../src/pose/pose-estimator", () => ({
  PoseEstimator: class PoseEstimatorMock {
    readonly initialize = estimator.initialize;
    readonly estimate = estimator.estimate;
    readonly setPoseLimit = estimator.setPoseLimit;
    readonly close = estimator.close;
  },
}));

const EMPTY_PACKET: PosePacket = {
  sequence: 0,
  capturedAtMs: 100,
  frame: { width: 1_280, height: 720 },
  poses: [],
};

describe("camera pose controller player limit", () => {
  const trackStop = vi.fn();
  const getUserMedia = vi.fn();
  const frameClose = vi.fn();
  let video: HTMLVideoElement;
  let frameCallbacks: VideoFrameRequestCallback[];

  beforeEach(() => {
    estimator.initialize.mockReset().mockResolvedValue(undefined);
    estimator.estimate.mockReset();
    estimator.setPoseLimit.mockReset().mockResolvedValue(undefined);
    estimator.close.mockReset();
    trackStop.mockReset();
    getUserMedia.mockReset().mockResolvedValue({
      getTracks: () => [{ stop: trackStop }],
    } as unknown as MediaStream);
    frameClose.mockReset();
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ close: frameClose })),
    );

    frameCallbacks = [];
    video = document.createElement("video");
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
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for in-flight inference, reconfigures in place, and keeps the camera stream", async () => {
    let resolveEstimate: ((packet: PosePacket) => void) | undefined;
    estimator.estimate.mockReturnValue(
      new Promise<PosePacket>((resolve) => {
        resolveEstimate = resolve;
      }),
    );
    const onPacket = vi.fn();
    const controller = new CameraPoseController({
      video,
      initialPoseLimit: 1,
      onPacket,
      onError: vi.fn(),
    });

    await controller.start();
    expect(estimator.initialize).toHaveBeenCalledWith(
      expect.stringContaining("mediapipe/tasks-vision-1.0.1/wasm"),
      expect.stringContaining("pose_landmarker_lite.task"),
      1,
    );
    expect(getUserMedia).toHaveBeenCalledOnce();

    frameCallbacks[0]?.(100, {} as VideoFrameCallbackMetadata);
    await Promise.resolve();
    expect(estimator.estimate).toHaveBeenCalledOnce();

    const changing = controller.setPoseLimit(2);
    expect(estimator.setPoseLimit).not.toHaveBeenCalled();
    resolveEstimate?.(EMPTY_PACKET);
    await changing;

    expect(onPacket).toHaveBeenCalledWith(EMPTY_PACKET);
    expect(estimator.setPoseLimit).toHaveBeenCalledWith(2);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(trackStop).not.toHaveBeenCalled();

    controller.stop();
    expect(trackStop).toHaveBeenCalledOnce();
    expect(estimator.close).toHaveBeenCalledOnce();
  });
});

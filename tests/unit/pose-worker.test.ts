import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PoseWorkerRequest, PoseWorkerResponse } from "../../src/pose/worker-protocol";

const mediaPipe = vi.hoisted(() => ({
  forVisionTasks: vi.fn(),
  createFromOptions: vi.fn(),
  setOptions: vi.fn(),
}));

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: mediaPipe.forVisionTasks },
  PoseLandmarker: { createFromOptions: mediaPipe.createFromOptions },
}));

interface WorkerHarness {
  postMessage: ReturnType<typeof vi.fn<(message: PoseWorkerResponse) => void>>;
  onmessage: ((event: MessageEvent<PoseWorkerRequest>) => void) | null;
}

describe("pose worker player limit", () => {
  let worker: WorkerHarness;

  beforeEach(() => {
    vi.resetModules();
    mediaPipe.forVisionTasks.mockReset().mockResolvedValue({});
    mediaPipe.setOptions.mockReset().mockResolvedValue(undefined);
    mediaPipe.createFromOptions.mockReset().mockResolvedValue({
      setOptions: mediaPipe.setOptions,
      detectForVideo: vi.fn(),
    });
    worker = { postMessage: vi.fn(), onmessage: null };
    vi.stubGlobal("self", worker);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates one-pose inference by default and acknowledges in-place two-pose reconfiguration", async () => {
    await import("../../src/pose/pose.worker");

    worker.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "initialize",
          wasmBaseUrl: "/wasm",
          modelUrl: "/pose.task",
          poseLimit: 1,
        },
      }),
    );
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledWith({ type: "ready" }));
    expect(mediaPipe.createFromOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ numPoses: 1 }),
    );

    worker.onmessage?.(
      new MessageEvent("message", {
        data: { type: "set-pose-limit", poseLimit: 2 },
      }),
    );
    await vi.waitFor(() =>
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: "pose-limit-set",
        poseLimit: 2,
      }),
    );
    expect(mediaPipe.setOptions).toHaveBeenCalledWith({ numPoses: 2 });
  });
});

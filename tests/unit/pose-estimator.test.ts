import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoseEstimator } from "../../apps/jojixplay/src/pose/pose-estimator";
import type { PoseWorkerResponse } from "../../apps/jojixplay/src/pose/worker-protocol";

class WorkerHarness {
  onmessage: ((event: MessageEvent<PoseWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  respond(message: PoseWorkerResponse): void {
    this.onmessage?.(new MessageEvent("message", { data: message }));
  }
}

describe("pose estimator worker protocol", () => {
  let worker: WorkerHarness;

  beforeEach(() => {
    worker = new WorkerHarness();
    vi.stubGlobal(
      "Worker",
      vi.fn(function WorkerMock() {
        return worker;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("initializes in one-player mode and acknowledges a runtime switch to two players", async () => {
    const estimator = new PoseEstimator();
    const initialized = estimator.initialize("/wasm", "body", "/pose.task", 1);

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "initialize",
      wasmBaseUrl: "/wasm",
      sensing: "body",
      modelUrl: "/pose.task",
      poseLimit: 1,
    });
    worker.respond({ type: "ready" });
    await initialized;

    const changed = estimator.setPoseLimit(2);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "set-pose-limit", poseLimit: 2 });
    worker.respond({ type: "pose-limit-set", poseLimit: 2 });
    await expect(changed).resolves.toBeUndefined();

    const reset = estimator.resetTracking();
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "reset-tracking" });
    worker.respond({ type: "tracking-reset" });
    await expect(reset).resolves.toBeUndefined();

    estimator.close();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("starts a hand-sensing worker and accepts its hand results", async () => {
    const estimator = new PoseEstimator();
    const ready = estimator.initialize("/wasm", "hands", "/hands.task", 1);
    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "initialize",
      wasmBaseUrl: "/wasm",
      sensing: "hands",
      modelUrl: "/hands.task",
      poseLimit: 1,
    });
    worker.respond({ type: "ready" });
    await ready;

    const frame = { width: 1280, height: 720, layout: "landscape", epoch: 0 } as const;
    const packet = {
      sequence: 0,
      capturedAtMs: 0,
      frame,
      hands: [
        {
          label: "left" as const,
          score: 0.9,
          landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
        },
      ],
    };
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const estimate = estimator.estimate(bitmap, 0, 0, frame, 0);
    worker.respond({ type: "result", packet });
    await expect(estimate).resolves.toEqual(packet);
    estimator.close();
  });

  it("allows GPU warm-up on the first frame, then bounds subsequent estimates", async () => {
    vi.useFakeTimers();
    const estimator = new PoseEstimator();
    const ready = estimator.initialize("/wasm", "body", "/pose.task", 1);
    worker.respond({ type: "ready" });
    await ready;
    const frame = { width: 1280, height: 720, layout: "landscape", epoch: 0 } as const;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const result = estimator.estimate(bitmap, 0, 0, frame, 0).then(
      () => true,
      () => false,
    );
    await vi.advanceTimersByTimeAsync(6_000);
    worker.respond({ type: "result", packet: { sequence: 0, capturedAtMs: 0, frame, poses: [] } });
    expect(await result).toBe(true);
    const stalled = estimator.estimate(bitmap, 6_000, 1, frame, 0);
    const rejected = expect(stalled).rejects.toThrow("stopped responding");
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    estimator.close();
  });

  it.each(["players", "tracking"] as const)(
    "allows bounded GPU warm-up after a %s graph rebuild, then restores the live deadline",
    async (change) => {
      vi.useFakeTimers();
      const estimator = new PoseEstimator();
      const ready = estimator.initialize("/wasm", "body", "/pose.task", 1);
      worker.respond({ type: "ready" });
      await ready;
      const frame = { width: 1280, height: 720, layout: "landscape", epoch: 0 } as const;
      const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
      const first = estimator.estimate(bitmap, 0, 0, frame, 0);
      worker.respond({
        type: "result",
        packet: { sequence: 0, capturedAtMs: 0, frame, poses: [] },
      });
      await first;
      const changed = change === "players" ? estimator.setPoseLimit(2) : estimator.resetTracking();
      worker.respond(
        change === "players"
          ? { type: "pose-limit-set", poseLimit: 2 }
          : { type: "tracking-reset" },
      );
      await changed;
      const warmed = estimator.estimate(bitmap, 1, 1, frame, 0).then(
        () => true,
        () => false,
      );
      await vi.advanceTimersByTimeAsync(6000);
      worker.respond({
        type: "result",
        packet: { sequence: 1, capturedAtMs: 1, frame, poses: [] },
      });
      expect(await warmed).toBe(true);
      const stalled = estimator.estimate(bitmap, 6001, 2, frame, 0);
      const rejected = expect(stalled).rejects.toThrow("stopped responding");
      await vi.advanceTimersByTimeAsync(5000);
      await rejected;
      estimator.close();
    },
  );

  it("bounds first-frame warm-up instead of leaving the camera permanently busy", async () => {
    vi.useFakeTimers();
    const estimator = new PoseEstimator();
    const ready = estimator.initialize("/wasm", "body", "/pose.task", 1);
    worker.respond({ type: "ready" });
    await ready;
    const bitmap = { close: vi.fn() } as unknown as ImageBitmap;
    const pending = estimator.estimate(
      bitmap,
      0,
      0,
      { width: 1280, height: 720, layout: "landscape", epoch: 0 },
      0,
    );
    const rejected = expect(pending).rejects.toThrow("stopped responding");
    await vi.advanceTimersByTimeAsync(30_000);
    await rejected;
    estimator.close();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("fails closed when the worker acknowledges a different player limit", async () => {
    const estimator = new PoseEstimator();
    const initialized = estimator.initialize("/wasm", "body", "/pose.task", 1);
    worker.respond({ type: "ready" });
    await initialized;

    const changed = estimator.setPoseLimit(2);
    worker.respond({ type: "pose-limit-set", poseLimit: 1 });

    await expect(changed).rejects.toThrow("unexpected player mode");
    await expect(estimator.setPoseLimit(2)).rejects.toThrow("unexpected player mode");
  });
});

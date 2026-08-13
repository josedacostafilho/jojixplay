import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PoseEstimator } from "../../src/pose/pose-estimator";
import type { PoseWorkerResponse } from "../../src/pose/worker-protocol";

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
  });

  it("initializes in one-player mode and acknowledges a runtime switch to two players", async () => {
    const estimator = new PoseEstimator();
    const initialized = estimator.initialize("/wasm", "/pose.task", 1);

    expect(worker.postMessage).toHaveBeenCalledWith({
      type: "initialize",
      wasmBaseUrl: "/wasm",
      modelUrl: "/pose.task",
      poseLimit: 1,
    });
    worker.respond({ type: "ready" });
    await initialized;

    const changed = estimator.setPoseLimit(2);
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: "set-pose-limit", poseLimit: 2 });
    worker.respond({ type: "pose-limit-set", poseLimit: 2 });
    await expect(changed).resolves.toBeUndefined();

    estimator.close();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("fails closed when the worker acknowledges a different player limit", async () => {
    const estimator = new PoseEstimator();
    const initialized = estimator.initialize("/wasm", "/pose.task", 1);
    worker.respond({ type: "ready" });
    await initialized;

    const changed = estimator.setPoseLimit(2);
    worker.respond({ type: "pose-limit-set", poseLimit: 1 });

    await expect(changed).rejects.toThrow("unexpected player mode");
    await expect(estimator.setPoseLimit(2)).rejects.toThrow("unexpected player mode");
  });
});

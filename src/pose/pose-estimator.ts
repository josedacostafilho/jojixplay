import type { PosePacket } from "../domain/pose";
import type { PoseLimit } from "../domain/pose-limit";
import { parsePosePacket } from "../domain/pose";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface PendingEstimate {
  resolve: (packet: PosePacket) => void;
  reject: (error: Error) => void;
}

interface PendingPoseLimit {
  requested: PoseLimit;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class PoseEstimator {
  private readonly worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
    type: "module",
    name: "jojixplay-pose",
  });
  private initializePromise: Promise<void> | null = null;
  private initializeResolve: (() => void) | null = null;
  private initializeReject: ((error: Error) => void) | null = null;
  private initializeTimeoutId: number | null = null;
  private pendingEstimate: PendingEstimate | null = null;
  private pendingPoseLimit: PendingPoseLimit | null = null;
  private poseLimitTimeoutId: number | null = null;
  private failedError: Error | null = null;
  private ready = false;
  private closed = false;

  public constructor() {
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.fail(new Error("The pose worker stopped unexpectedly."));
    };
  }

  public initialize(wasmBaseUrl: string, modelUrl: string, poseLimit: PoseLimit): Promise<void> {
    if (this.initializePromise !== null) {
      return this.initializePromise;
    }

    this.initializePromise = new Promise<void>((resolve, reject) => {
      this.initializeResolve = resolve;
      this.initializeReject = reject;
      const request: PoseWorkerRequest = {
        type: "initialize",
        wasmBaseUrl,
        modelUrl,
        poseLimit,
      };
      this.worker.postMessage(request);
      this.initializeTimeoutId = window.setTimeout(() => {
        this.fail(new Error("The pose engine took too long to start."));
      }, 30_000);
    });
    return this.initializePromise;
  }

  public setPoseLimit(poseLimit: PoseLimit): Promise<void> {
    if (
      this.closed ||
      !this.ready ||
      this.pendingEstimate !== null ||
      this.pendingPoseLimit !== null ||
      this.failedError !== null
    ) {
      return Promise.reject(
        this.failedError ?? new Error("The pose estimator cannot change player mode now."),
      );
    }

    return new Promise<void>((resolve, reject) => {
      this.pendingPoseLimit = { requested: poseLimit, resolve, reject };
      try {
        this.worker.postMessage({ type: "set-pose-limit", poseLimit } satisfies PoseWorkerRequest);
      } catch (error) {
        this.pendingPoseLimit = null;
        reject(error instanceof Error ? error : new Error("Player-mode request failed."));
        return;
      }
      this.poseLimitTimeoutId = window.setTimeout(() => {
        this.fail(new Error("The pose engine took too long to change player mode."));
      }, 10_000);
    });
  }

  public estimate(frame: ImageBitmap, capturedAtMs: number, sequence: number): Promise<PosePacket> {
    if (
      this.closed ||
      !this.ready ||
      this.pendingEstimate !== null ||
      this.pendingPoseLimit !== null ||
      this.failedError !== null
    ) {
      frame.close();
      return Promise.reject(this.failedError ?? new Error("The pose estimator is not available."));
    }

    return new Promise<PosePacket>((resolve, reject) => {
      this.pendingEstimate = { resolve, reject };
      const request: PoseWorkerRequest = {
        type: "estimate",
        frame,
        capturedAtMs,
        sequence,
      };
      try {
        this.worker.postMessage(request, [frame]);
      } catch (error) {
        this.pendingEstimate = null;
        frame.close();
        reject(error instanceof Error ? error : new Error("Frame transfer failed."));
      }
    });
  }

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.clearInitializeTimeout();
    const error = new Error("The pose estimator was stopped.");
    this.initializeReject?.(error);
    this.pendingEstimate?.reject(error);
    this.pendingEstimate = null;
    this.pendingPoseLimit?.reject(error);
    this.pendingPoseLimit = null;
    this.clearPoseLimitTimeout();
    this.worker.terminate();
  }

  private handleMessage(message: PoseWorkerResponse): void {
    if (this.closed) {
      return;
    }
    if (message.type === "ready") {
      this.clearInitializeTimeout();
      this.ready = true;
      this.initializeResolve?.();
      this.initializeResolve = null;
      this.initializeReject = null;
      return;
    }
    if (message.type === "error") {
      this.fail(new Error(message.message));
      return;
    }

    if (message.type === "pose-limit-set") {
      const pending = this.pendingPoseLimit;
      this.pendingPoseLimit = null;
      this.clearPoseLimitTimeout();
      if (pending === null || pending.requested !== message.poseLimit) {
        const error = new Error("The pose worker acknowledged an unexpected player mode.");
        pending?.reject(error);
        this.fail(error);
        return;
      }
      pending.resolve();
      return;
    }

    const pending = this.pendingEstimate;
    this.pendingEstimate = null;
    const parsed = parsePosePacket(message.packet);
    if (parsed.ok) {
      pending?.resolve(parsed.value);
    } else {
      pending?.reject(new Error("The pose worker returned invalid data."));
    }
  }

  private fail(error: Error): void {
    this.failedError = error;
    this.ready = false;
    this.clearInitializeTimeout();
    this.initializeReject?.(error);
    this.initializeResolve = null;
    this.initializeReject = null;
    this.pendingEstimate?.reject(error);
    this.pendingEstimate = null;
    this.pendingPoseLimit?.reject(error);
    this.pendingPoseLimit = null;
    this.clearPoseLimitTimeout();
  }

  private clearInitializeTimeout(): void {
    if (this.initializeTimeoutId !== null) {
      window.clearTimeout(this.initializeTimeoutId);
      this.initializeTimeoutId = null;
    }
  }

  private clearPoseLimitTimeout(): void {
    if (this.poseLimitTimeoutId !== null) {
      window.clearTimeout(this.poseLimitTimeoutId);
      this.poseLimitTimeoutId = null;
    }
  }
}

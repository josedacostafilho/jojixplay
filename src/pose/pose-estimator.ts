import type { PosePacket } from "../domain/pose";
import { parsePosePacket } from "../domain/pose";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

interface PendingEstimate {
  resolve: (packet: PosePacket) => void;
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
  private failedError: Error | null = null;
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

  public initialize(wasmBaseUrl: string, modelUrl: string): Promise<void> {
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
      };
      this.worker.postMessage(request);
      this.initializeTimeoutId = window.setTimeout(() => {
        this.fail(new Error("The pose engine took too long to start."));
      }, 30_000);
    });
    return this.initializePromise;
  }

  public estimate(frame: ImageBitmap, capturedAtMs: number, sequence: number): Promise<PosePacket> {
    if (this.closed || this.pendingEstimate !== null || this.failedError !== null) {
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
    this.worker.terminate();
  }

  private handleMessage(message: PoseWorkerResponse): void {
    if (this.closed) {
      return;
    }
    if (message.type === "ready") {
      this.clearInitializeTimeout();
      this.initializeResolve?.();
      this.initializeResolve = null;
      this.initializeReject = null;
      return;
    }
    if (message.type === "error") {
      this.fail(new Error(message.message));
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
    this.clearInitializeTimeout();
    this.initializeReject?.(error);
    this.initializeResolve = null;
    this.initializeReject = null;
    this.pendingEstimate?.reject(error);
    this.pendingEstimate = null;
  }

  private clearInitializeTimeout(): void {
    if (this.initializeTimeoutId !== null) {
      window.clearTimeout(this.initializeTimeoutId);
      this.initializeTimeoutId = null;
    }
  }
}

import type { Sensing } from "@jojixplay/game-sdk";
import type { CameraFrame, CameraRotation } from "../domain/camera";
import { parseSensedPacket, type SensedPacket } from "../domain/sensed-packet";
import type { PoseLimit } from "../domain/pose-limit";
import type { PoseWorkerRequest, PoseWorkerResponse } from "./worker-protocol";

/** The pose worker failed, stalled or broke its protocol. The estimator is unusable afterwards. */
export class PoseEngineError extends Error {}

type Reply = Exclude<PoseWorkerResponse, { type: "error" }>;

interface PendingRequest {
  expects: Reply["type"];
  resolve: (reply: Reply) => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

const START_TIMEOUT_MS = 30_000;
const RECONFIGURE_TIMEOUT_MS = 10_000;
const ESTIMATE_TIMEOUT_MS = 5_000;
/** The GPU compiles its kernels on the first inference after the graph is built or rebuilt. */
const WARM_UP_TIMEOUT_MS = 30_000;

/**
 * Owns one sensing worker and allows exactly one request in flight. A worker senses one kind for
 * its whole life: the vendor runtime cannot build a second task in the same module worker.
 */
export class PoseEstimator {
  private readonly worker = new Worker(new URL("./pose.worker.ts", import.meta.url), {
    type: "module",
    name: "jojixplay-pose",
  });
  private initialization: Promise<void> | null = null;
  private pending: PendingRequest | null = null;
  private failure: PoseEngineError | null = null;
  private ready = false;
  private warmedUp = false;
  private closed = false;

  public constructor() {
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event) => {
      event.preventDefault();
      this.fail(new PoseEngineError("The pose worker stopped unexpectedly."));
    };
  }

  public initialize(
    wasmBaseUrl: string,
    sensing: Sensing,
    modelUrl: string,
    poseLimit: PoseLimit,
  ): Promise<void> {
    this.initialization ??= this.request(
      { type: "initialize", wasmBaseUrl, sensing, modelUrl, poseLimit },
      "ready",
      START_TIMEOUT_MS,
      "The pose engine took too long to start.",
    ).then(() => {
      this.ready = true;
    });
    return this.initialization;
  }

  public async setPoseLimit(poseLimit: PoseLimit): Promise<void> {
    const reply = await this.request(
      { type: "set-pose-limit", poseLimit },
      "pose-limit-set",
      RECONFIGURE_TIMEOUT_MS,
      "The pose engine took too long to change player mode.",
    );
    if (reply.poseLimit !== poseLimit) {
      const error = new PoseEngineError("The pose worker acknowledged an unexpected player mode.");
      this.fail(error);
      throw error;
    }
    this.warmedUp = false;
  }

  public async resetTracking(): Promise<void> {
    await this.request(
      { type: "reset-tracking" },
      "tracking-reset",
      RECONFIGURE_TIMEOUT_MS,
      "The pose engine took too long to reset tracking.",
    );
    this.warmedUp = false;
  }

  /** Takes ownership of `frame`: it is transferred to the worker or closed. */
  public async estimate(
    frame: ImageBitmap,
    capturedAtMs: number,
    sequence: number,
    cameraFrame: CameraFrame,
    rotation: CameraRotation,
  ): Promise<SensedPacket> {
    const reply = await this.request(
      { type: "estimate", frame, capturedAtMs, sequence, cameraFrame, rotation },
      "result",
      this.warmedUp ? ESTIMATE_TIMEOUT_MS : WARM_UP_TIMEOUT_MS,
      "Body tracking stopped responding.",
      frame,
    );
    const parsed = parseSensedPacket(reply.packet);
    if (!parsed.ok) {
      throw new PoseEngineError("The pose worker returned invalid data.");
    }
    this.warmedUp = true;
    return parsed.value;
  }

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.settle()?.reject(new PoseEngineError("The pose estimator was stopped."));
    this.worker.terminate();
  }

  private request<T extends Reply["type"]>(
    message: PoseWorkerRequest,
    expects: T,
    timeoutMs: number,
    timeoutMessage: string,
    transfer?: ImageBitmap,
  ): Promise<Extract<Reply, { type: T }>> {
    return new Promise<Reply>((resolve, reject) => {
      if (this.closed || this.failure !== null || this.pending !== null) {
        transfer?.close();
        reject(this.failure ?? new PoseEngineError("The pose estimator is busy or stopped."));
        return;
      }
      if (!this.ready && expects !== "ready") {
        transfer?.close();
        reject(new PoseEngineError("The pose estimator is not initialized."));
        return;
      }
      try {
        if (transfer) this.worker.postMessage(message, [transfer]);
        else this.worker.postMessage(message);
      } catch (cause) {
        transfer?.close();
        reject(new PoseEngineError("The pose worker rejected a request.", { cause }));
        return;
      }
      this.pending = {
        expects,
        resolve,
        reject,
        timeoutId: window.setTimeout(() => {
          this.fail(new PoseEngineError(timeoutMessage));
        }, timeoutMs),
      };
    }) as Promise<Extract<Reply, { type: T }>>;
  }

  private handleMessage(message: PoseWorkerResponse): void {
    if (this.closed) {
      return;
    }
    if (message?.type === "error") {
      this.fail(new PoseEngineError(String(message.message)));
      return;
    }
    if (this.pending === null || this.pending.expects !== message?.type) {
      this.fail(new PoseEngineError("The pose worker sent an unexpected reply."));
      return;
    }
    this.settle()?.resolve(message);
  }

  private fail(error: PoseEngineError): void {
    this.failure ??= error;
    this.ready = false;
    this.settle()?.reject(error);
  }

  private settle(): PendingRequest | null {
    const pending = this.pending;
    this.pending = null;
    if (pending !== null) {
      window.clearTimeout(pending.timeoutId);
    }
    return pending;
  }
}

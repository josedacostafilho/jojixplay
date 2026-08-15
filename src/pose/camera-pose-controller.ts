import {
  type CameraFrameNormalization,
  type CameraLayout,
  parseScreenCameraOrientation,
  resolveCameraFrameNormalization,
  sameCameraFrameNormalization,
} from "../domain/camera";
import type { PosePacket } from "../domain/pose";
import type { PoseLimit } from "../domain/pose-limit";
import {
  POSE_DIAGNOSTICS_PUBLISH_INTERVAL_MS,
  PoseDiagnosticsMonitor,
  type PoseDiagnosticsSnapshot,
} from "./pose-diagnostics";
import { PoseEstimator } from "./pose-estimator";
import { POSE_MODEL } from "./pose-model";

interface CameraPoseControllerOptions {
  video: HTMLVideoElement;
  initialPoseLimit: PoseLimit;
  onPacket: (packet: PosePacket) => void;
  onDiagnostics: (diagnostics: PoseDiagnosticsSnapshot) => void;
  onCameraFrame: (frame: CameraFrameNormalization | null) => void;
  onRequestedCameraLayout: (layout: CameraLayout | null) => void;
  onError: (message: string) => void;
}

interface PendingFrameNormalization {
  normalization: CameraFrameNormalization;
  observedAtMs: number;
}

interface PendingFrameNormalizationError {
  message: string;
  observedAtMs: number;
}

interface PendingCameraLayoutRequest {
  layout: CameraLayout;
  resolve: () => void;
  reject: (error: Error) => void;
  timeoutId: number;
}

export const CAMERA_FRAME_STABILITY_MS = 400;
export const CAMERA_FRAME_INVALID_TIMEOUT_MS = 1_500;
export const CAMERA_LAYOUT_REQUEST_TIMEOUT_MS = 30_000;

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("The pose")) {
    return error.message;
  }
  if (
    error instanceof Error &&
    (error.message.startsWith("Screen orientation") ||
      error.message.startsWith("Camera frame") ||
      error.message.startsWith("Camera pixels") ||
      error.message.startsWith("Camera rotation") ||
      error.message.startsWith("Pose tracking") ||
      error.message.startsWith("Square camera"))
  ) {
    return `${error.message} Keep screen rotation enabled and restart body tracking.`;
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "Camera access was denied. Allow camera access and try again.";
    }
    if (error.name === "NotFoundError") {
      return "No usable camera was found on this device.";
    }
    if (error.name === "NotReadableError") {
      return "The camera is busy or could not be opened.";
    }
  }
  return "Camera and pose tracking could not start on this device.";
}

export class CameraPoseController {
  private readonly estimator = new PoseEstimator();
  private readonly diagnostics = new PoseDiagnosticsMonitor();
  private stream: MediaStream | null = null;
  private frameCallbackId: number | null = null;
  private sequence = 0;
  private processingPromise: Promise<void> | null = null;
  private changingPoseLimit = false;
  private poseLimit: PoseLimit;
  private active = false;
  private lastDiagnosticsPublishedAtMs: number | null = null;
  private activeNormalization: CameraFrameNormalization | null = null;
  private pendingNormalization: PendingFrameNormalization | null = null;
  private pendingNormalizationError: PendingFrameNormalizationError | null = null;
  private pendingLayoutRequest: PendingCameraLayoutRequest | null = null;

  public constructor(private readonly options: CameraPoseControllerOptions) {
    this.poseLimit = options.initialPoseLimit;
  }

  public async start(): Promise<void> {
    if (this.active) {
      return;
    }
    this.active = true;
    this.diagnostics.reset();
    this.lastDiagnosticsPublishedAtMs = null;
    this.activeNormalization = null;
    this.pendingNormalization = null;
    this.pendingNormalizationError = null;
    this.options.onCameraFrame(null);

    try {
      const streamPromise = navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
        })
        .then((stream) => {
          if (!this.active) {
            for (const track of stream.getTracks()) {
              track.stop();
            }
          }
          return stream;
        });
      const [stream] = await Promise.all([
        streamPromise,
        this.estimator.initialize(
          assetUrl("mediapipe/tasks-vision-1.0.1/wasm"),
          assetUrl(POSE_MODEL.assetPath),
          this.poseLimit,
        ),
      ]);

      if (!this.active) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
        return;
      }

      this.stream = stream;
      this.options.video.srcObject = stream;
      await this.options.video.play();
      this.scheduleFrame();
    } catch (error) {
      this.stop();
      throw new Error(cameraErrorMessage(error));
    }
  }

  public async setPoseLimit(poseLimit: PoseLimit): Promise<void> {
    if (!this.active) {
      throw new Error("Body tracking is not active.");
    }
    if (this.changingPoseLimit) {
      throw new Error("Player mode is already changing.");
    }
    if (poseLimit === this.poseLimit) {
      return;
    }

    this.changingPoseLimit = true;
    try {
      await this.processingPromise;
      if (!this.active) {
        throw new Error("Body tracking stopped before player mode changed.");
      }
      await this.estimator.setPoseLimit(poseLimit);
      this.poseLimit = poseLimit;
      this.diagnostics.reset();
      if (this.activeNormalization !== null) {
        this.diagnostics.recordCameraNormalization(this.activeNormalization);
      }
      this.lastDiagnosticsPublishedAtMs = null;
    } catch {
      if (this.active) {
        this.options.onError("Player mode could not be changed. Restart body tracking to retry.");
        this.stop();
      }
      throw new Error("Player mode could not be changed.");
    } finally {
      this.changingPoseLimit = false;
    }
  }

  public requestCameraLayout(layout: CameraLayout): Promise<void> {
    if (!this.active) {
      return Promise.reject(new Error("Body tracking is not active."));
    }
    if (this.pendingLayoutRequest !== null) {
      return Promise.reject(new Error("A camera-layout request is already active."));
    }
    if (this.activeNormalization?.frame.layout === layout) {
      return Promise.resolve();
    }

    this.options.onRequestedCameraLayout(layout);
    return new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (this.pendingLayoutRequest?.layout !== layout) {
          return;
        }
        this.pendingLayoutRequest = null;
        this.options.onRequestedCameraLayout(null);
        reject(new Error(`The phone was not rotated to ${layout} in time.`));
      }, CAMERA_LAYOUT_REQUEST_TIMEOUT_MS);
      this.pendingLayoutRequest = { layout, resolve, reject, timeoutId };
    });
  }

  public stop(): void {
    this.active = false;
    if (this.frameCallbackId !== null) {
      this.options.video.cancelVideoFrameCallback(this.frameCallbackId);
      this.frameCallbackId = null;
    }
    for (const track of this.stream?.getTracks() ?? []) {
      track.stop();
    }
    this.stream = null;
    this.options.video.pause();
    this.options.video.srcObject = null;
    this.estimator.close();
    this.rejectPendingLayoutRequest(new Error("Body tracking stopped before layout changed."));
    this.diagnostics.reset();
    this.lastDiagnosticsPublishedAtMs = null;
    this.activeNormalization = null;
    this.pendingNormalization = null;
    this.pendingNormalizationError = null;
    this.options.onCameraFrame(null);
    this.options.onRequestedCameraLayout(null);
  }

  private scheduleFrame(): void {
    if (!this.active) {
      return;
    }
    this.frameCallbackId = this.options.video.requestVideoFrameCallback((now) => {
      this.frameCallbackId = null;
      if (!this.active) {
        return;
      }
      this.scheduleFrame();
      this.diagnostics.recordCameraFrame(now);
      if (
        this.processingPromise !== null ||
        this.changingPoseLimit ||
        this.options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        this.publishDiagnostics(now);
        return;
      }
      this.publishDiagnostics(now);
      const processingPromise = this.processFrame(now);
      this.processingPromise = processingPromise;
      void processingPromise.finally(() => {
        if (this.processingPromise === processingPromise) {
          this.processingPromise = null;
        }
      });
    });
  }

  private async processFrame(capturedAtMs: number): Promise<void> {
    let ownedFrame: ImageBitmap | null = null;
    try {
      const frame = await createImageBitmap(this.options.video);
      ownedFrame = frame;
      if (!this.active) {
        return;
      }
      const normalization = await this.resolveFrameNormalization(frame, capturedAtMs);
      if (normalization === null) {
        return;
      }
      this.diagnostics.recordInferenceSubmission(capturedAtMs);
      const estimate = this.estimator.estimate(
        frame,
        capturedAtMs,
        this.sequence++,
        normalization.frame,
        normalization.rotation,
      );
      ownedFrame = null;
      const packet = await estimate;
      if (this.active) {
        const completedAtMs = performance.now();
        this.diagnostics.recordInferenceCompletion(packet, completedAtMs, this.poseLimit);
        this.publishDiagnostics(completedAtMs);
        this.options.onPacket(packet);
      }
    } catch (error) {
      if (this.active) {
        this.options.onError(cameraErrorMessage(error));
        this.stop();
      }
    } finally {
      ownedFrame?.close();
    }
  }

  private async resolveFrameNormalization(
    frame: ImageBitmap,
    observedAtMs: number,
  ): Promise<CameraFrameNormalization | null> {
    let candidate: CameraFrameNormalization;
    try {
      const parsedScreen = parseScreenCameraOrientation(
        window.screen.orientation.type,
        window.screen.orientation.angle,
      );
      if (!parsedScreen.ok) {
        throw new Error(parsedScreen.error);
      }
      const nextEpoch =
        this.activeNormalization === null ? 0 : this.activeNormalization.frame.epoch + 1;
      candidate = resolveCameraFrameNormalization(
        frame.width,
        frame.height,
        parsedScreen.value,
        nextEpoch,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Camera orientation is invalid.";
      this.pendingNormalization = null;
      if (this.pendingNormalizationError === null) {
        this.pendingNormalizationError = { message, observedAtMs };
        return null;
      }
      this.pendingNormalizationError.message = message;
      if (
        observedAtMs - this.pendingNormalizationError.observedAtMs <
        CAMERA_FRAME_INVALID_TIMEOUT_MS
      ) {
        return null;
      }
      throw new Error(message);
    }
    this.pendingNormalizationError = null;

    if (this.activeNormalization === null) {
      return this.commitFrameNormalization(candidate);
    }
    if (sameCameraFrameNormalization(this.activeNormalization, candidate)) {
      this.pendingNormalization = null;
      const current = {
        ...candidate,
        frame: { ...candidate.frame, epoch: this.activeNormalization.frame.epoch },
      };
      this.activeNormalization = current;
      this.diagnostics.recordCameraNormalization(current);
      return current;
    }

    if (
      this.pendingNormalization === null ||
      !sameCameraFrameNormalization(this.pendingNormalization.normalization, candidate)
    ) {
      this.pendingNormalization = { normalization: candidate, observedAtMs };
      return null;
    }
    if (observedAtMs - this.pendingNormalization.observedAtMs < CAMERA_FRAME_STABILITY_MS) {
      return null;
    }
    await this.estimator.resetTracking();
    if (!this.active) {
      return null;
    }
    return this.commitFrameNormalization(candidate);
  }

  private commitFrameNormalization(
    normalization: CameraFrameNormalization,
  ): CameraFrameNormalization {
    this.activeNormalization = normalization;
    this.pendingNormalization = null;
    this.diagnostics.reset();
    this.diagnostics.recordCameraNormalization(normalization);
    this.lastDiagnosticsPublishedAtMs = null;
    this.options.onCameraFrame(normalization);

    const request = this.pendingLayoutRequest;
    if (request !== null && request.layout === normalization.frame.layout) {
      window.clearTimeout(request.timeoutId);
      this.pendingLayoutRequest = null;
      this.options.onRequestedCameraLayout(null);
      request.resolve();
    }
    return normalization;
  }

  private rejectPendingLayoutRequest(error: Error): void {
    const request = this.pendingLayoutRequest;
    if (request === null) {
      return;
    }
    window.clearTimeout(request.timeoutId);
    this.pendingLayoutRequest = null;
    this.options.onRequestedCameraLayout(null);
    request.reject(error);
  }

  private publishDiagnostics(nowMs: number): void {
    if (
      this.lastDiagnosticsPublishedAtMs !== null &&
      nowMs - this.lastDiagnosticsPublishedAtMs < POSE_DIAGNOSTICS_PUBLISH_INTERVAL_MS
    ) {
      return;
    }
    this.lastDiagnosticsPublishedAtMs = nowMs;
    this.options.onDiagnostics(this.diagnostics.snapshot(nowMs));
  }
}

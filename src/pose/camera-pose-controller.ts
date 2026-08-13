import type { PosePacket } from "../domain/pose";
import { PoseEstimator } from "./pose-estimator";

interface CameraPoseControllerOptions {
  video: HTMLVideoElement;
  onPacket: (packet: PosePacket) => void;
  onError: (message: string) => void;
}

const MIN_FRAME_INTERVAL_MS = 1000 / 15;

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("The pose")) {
    return error.message;
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
  private stream: MediaStream | null = null;
  private frameCallbackId: number | null = null;
  private sequence = 0;
  private lastSampleAt = Number.NEGATIVE_INFINITY;
  private processing = false;
  private active = false;

  public constructor(private readonly options: CameraPoseControllerOptions) {}

  public async start(): Promise<void> {
    if (this.active) {
      return;
    }
    this.active = true;

    try {
      const streamPromise = navigator.mediaDevices
        .getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
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
          assetUrl("mediapipe/pose-landmarker-lite-float16-1/pose_landmarker_lite.task"),
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
  }

  private scheduleFrame(): void {
    if (!this.active) {
      return;
    }
    this.frameCallbackId = this.options.video.requestVideoFrameCallback((now) => {
      this.frameCallbackId = null;
      this.scheduleFrame();
      if (
        !this.active ||
        this.processing ||
        now - this.lastSampleAt < MIN_FRAME_INTERVAL_MS ||
        this.options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }
      this.lastSampleAt = now;
      this.processing = true;
      void this.processFrame(now).finally(() => {
        this.processing = false;
      });
    });
  }

  private async processFrame(capturedAtMs: number): Promise<void> {
    try {
      const frame = await createImageBitmap(this.options.video);
      if (!this.active) {
        frame.close();
        return;
      }
      const packet = await this.estimator.estimate(frame, capturedAtMs, this.sequence++);
      if (this.active) {
        this.options.onPacket(packet);
      }
    } catch {
      if (this.active) {
        this.options.onError("Pose tracking stopped unexpectedly. Start a new session to retry.");
        this.stop();
      }
    }
  }
}

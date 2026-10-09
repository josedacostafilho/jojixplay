import type { Sensing } from "@jojixplay/game-sdk";
import {
  type CameraFrameNormalization,
  CameraGeometryError,
  parseScreenCameraOrientation,
  resolveCameraFrameNormalization,
  sameCameraFrameNormalization,
} from "../domain/camera";
import type { SensedPacket } from "../domain/sensed-packet";
import type { PoseLimit } from "../domain/pose-limit";
import { PoseEngineError, PoseEstimator } from "./pose-estimator";
import { SENSING_MODELS } from "./models";

interface CameraPoseControllerOptions {
  video: HTMLVideoElement;
  initialPoseLimit: PoseLimit;
  onPacket: (packet: SensedPacket, sensing: Sensing) => void;
  onCameraFrame: (frame: CameraFrameNormalization | null) => void;
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

export const CAMERA_FRAME_STABILITY_MS = 400;
export const CAMERA_FRAME_INVALID_TIMEOUT_MS = 1_500;

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).toString();
}

function cameraErrorMessage(error: unknown): string {
  if (error instanceof PoseEngineError) {
    return "O reconhecimento de movimentos parou. Tente novamente.";
  }
  if (error instanceof CameraGeometryError) {
    return "Não foi possível ajustar a câmera. Deixe o celular deitado, ative a rotação automática e tente novamente.";
  }
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      return "O acesso à câmera foi negado. Permita o acesso e tente novamente.";
    }
    if (error.name === "NotFoundError") {
      return "Não encontramos uma câmera disponível neste aparelho.";
    }
    if (error.name === "NotReadableError") {
      return "A câmera está sendo usada ou não pôde ser aberta. Feche outros aplicativos e tente novamente.";
    }
  }
  return "Não foi possível iniciar a câmera e o reconhecimento de movimentos. Tente novamente.";
}

export class CameraPoseController {
  private estimator = new PoseEstimator();
  private stream: MediaStream | null = null;
  private frameCallbackId: number | null = null;
  private sequence = 0;
  private processingPromise: Promise<void> | null = null;
  /** Set while the worker rebuilds its graph; no frame is estimated meanwhile. */
  private reconfiguring = false;
  private sensingChange: Promise<void> = Promise.resolve();
  private poseLimit: PoseLimit;
  private sensing: Sensing = "body";
  private active = false;
  private activeNormalization: CameraFrameNormalization | null = null;
  private pendingNormalization: PendingFrameNormalization | null = null;
  private pendingNormalizationError: PendingFrameNormalizationError | null = null;

  public constructor(private readonly options: CameraPoseControllerOptions) {
    this.poseLimit = options.initialPoseLimit;
  }

  public async start(): Promise<void> {
    if (this.active) {
      return;
    }
    this.active = true;
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
      const [stream] = await Promise.all([streamPromise, this.initializeEstimator()]);

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
      throw new Error("O reconhecimento de movimentos não está ativo.");
    }
    if (this.reconfiguring) {
      throw new Error("A mudança de pessoas já está em andamento.");
    }
    if (poseLimit === this.poseLimit) {
      return;
    }

    this.reconfiguring = true;
    try {
      await this.processingPromise;
      if (!this.active) {
        throw new Error("O reconhecimento parou antes da mudança de pessoas.");
      }
      await this.estimator.setPoseLimit(poseLimit);
      this.poseLimit = poseLimit;
    } catch {
      if (this.active) {
        this.options.onError("Não foi possível mudar o número de pessoas. Tente novamente.");
        this.stop();
      }
      throw new Error("Não foi possível mudar o número de pessoas.");
    } finally {
      this.reconfiguring = false;
    }
  }

  /** Requests apply in the order they were made, so the last one asked for is what remains. */
  public setSensing(sensing: Sensing): Promise<void> {
    const change = this.sensingChange.then(() => this.applySensing(sensing));
    this.sensingChange = change.catch(() => {});
    return change;
  }

  private async applySensing(sensing: Sensing): Promise<void> {
    if (!this.active) {
      throw new Error("O reconhecimento de movimentos não está ativo.");
    }
    if (sensing === this.sensing) {
      return;
    }
    if (this.reconfiguring) {
      throw new Error("Outra mudança já está em andamento.");
    }

    this.reconfiguring = true;
    try {
      await this.processingPromise;
      if (!this.active) {
        throw new Error("O reconhecimento parou antes da mudança.");
      }
      // The camera keeps running; only the worker and its one model are replaced.
      this.estimator.close();
      this.estimator = new PoseEstimator();
      this.sensing = sensing;
      await this.initializeEstimator();
      if (!this.active) {
        throw new Error("O reconhecimento parou antes da mudança.");
      }
      // What the previous model saw must not be read as the new model's output.
      if (this.activeNormalization !== null) {
        this.commitFrameNormalization({
          ...this.activeNormalization,
          frame: {
            ...this.activeNormalization.frame,
            epoch: this.activeNormalization.frame.epoch + 1,
          },
        });
      }
    } catch {
      if (this.active) {
        this.options.onError("Não foi possível mudar o reconhecimento. Tente novamente.");
        this.stop();
      }
      throw new Error("Não foi possível mudar o reconhecimento.");
    } finally {
      this.reconfiguring = false;
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
    this.activeNormalization = null;
    this.pendingNormalization = null;
    this.pendingNormalizationError = null;
    this.options.onCameraFrame(null);
  }

  private initializeEstimator(): Promise<void> {
    return this.estimator.initialize(
      assetUrl("mediapipe/tasks-vision-1.0.1/wasm"),
      this.sensing,
      assetUrl(SENSING_MODELS[this.sensing]),
      this.poseLimit,
    );
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
      if (
        this.processingPromise !== null ||
        this.reconfiguring ||
        this.options.video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
      ) {
        return;
      }
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
        this.options.onPacket(packet, this.sensing);
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
        throw new CameraGeometryError(parsedScreen.error);
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
      throw new CameraGeometryError(message);
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
    this.options.onCameraFrame(normalization);

    return normalization;
  }
}

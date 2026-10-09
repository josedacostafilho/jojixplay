import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { CameraFrameNormalization } from "../domain/camera";
import { DEFAULT_POSE_LIMIT, type PoseLimit } from "../domain/pose-limit";
import { toBodyFrame } from "./body-frame";
import { BodyFrameChannel, type BodyFrameSource } from "./body-frame-source";
import { CameraPoseController } from "./camera-pose-controller";

export type CameraTrackingState = "idle" | "starting" | "tracking" | "error";

export interface CameraPoseLifecycle {
  videoRef: preact.RefObject<HTMLVideoElement>;
  state: CameraTrackingState;
  frames: BodyFrameSource;
  normalization: CameraFrameNormalization | null;
  poseLimit: PoseLimit;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => void;
  setPoseLimit: (poseLimit: PoseLimit) => Promise<void>;
}

export function useCameraPose(): CameraPoseLifecycle {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraController = useRef<CameraPoseController | null>(null);
  const mounted = useRef(true);
  const poseLimitRef = useRef<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [state, setState] = useState<CameraTrackingState>("idle");
  const [normalization, setNormalization] = useState<CameraFrameNormalization | null>(null);
  const [frames] = useState(() => new BodyFrameChannel());
  const [poseLimit, setPoseLimitState] = useState<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    const controller = cameraController.current;
    cameraController.current = null;
    controller?.stop();
    if (!mounted.current) {
      return;
    }
    frames.publish(null);
    setNormalization(null);
    setState("idle");
    setErrorMessage(null);
    poseLimitRef.current = DEFAULT_POSE_LIMIT;
    setPoseLimitState(DEFAULT_POSE_LIMIT);
  }, [frames]);

  const start = useCallback(async (): Promise<void> => {
    const video = videoRef.current;
    if (video === null || cameraController.current !== null) {
      return;
    }
    setState("starting");
    setErrorMessage(null);
    frames.publish(null);
    setNormalization(null);

    let controller: CameraPoseController | null = null;
    controller = new CameraPoseController({
      video,
      initialPoseLimit: poseLimitRef.current,
      onPacket: (nextPacket) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        frames.publish(toBodyFrame(nextPacket));
      },
      onCameraFrame: (nextFrame) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        setNormalization(nextFrame);
        // Observations from another camera basis must not outlive it.
        if (frames.latest()?.epoch !== nextFrame?.frame.epoch) {
          frames.publish(null);
        }
      },
      onError: (message) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        cameraController.current = null;
        frames.publish(null);
        setNormalization(null);
        setErrorMessage(message);
        setState("error");
      },
    });
    cameraController.current = controller;

    try {
      await controller.start();
      if (mounted.current && cameraController.current === controller) {
        setState("tracking");
      }
    } catch (error) {
      if (mounted.current && cameraController.current === controller) {
        cameraController.current = null;
        setState("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o reconhecimento de movimentos.",
        );
      }
    }
  }, [frames]);

  const setPoseLimit = useCallback(async (nextPoseLimit: PoseLimit): Promise<void> => {
    const controller = cameraController.current;
    if (controller === null) {
      throw new Error("O reconhecimento de movimentos não está ativo.");
    }
    await controller.setPoseLimit(nextPoseLimit);
    if (cameraController.current !== controller) {
      throw new Error("O reconhecimento parou antes da mudança de pessoas.");
    }
    poseLimitRef.current = nextPoseLimit;
    setPoseLimitState(nextPoseLimit);
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const controller = cameraController.current;
      cameraController.current = null;
      controller?.stop();
    };
  }, []);

  return {
    videoRef,
    state,
    frames,
    normalization,
    poseLimit,
    errorMessage,
    start,
    stop,
    setPoseLimit,
  };
}

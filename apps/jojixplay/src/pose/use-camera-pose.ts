import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { DEFAULT_POSE_LIMIT, type PoseLimit } from "../domain/pose-limit";
import { CameraPoseController } from "./camera-pose-controller";

export type CameraTrackingState = "idle" | "starting" | "tracking" | "error";

export interface CameraPoseLifecycle {
  videoRef: preact.RefObject<HTMLVideoElement>;
  state: CameraTrackingState;
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: () => void;
  setPoseLimit: (poseLimit: PoseLimit) => Promise<void>;
}

export function useCameraPose(): CameraPoseLifecycle {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraController = useRef<CameraPoseController | null>(null);
  const mounted = useRef(true);
  const poseLimitRef = useRef<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [state, setState] = useState<CameraTrackingState>("idle");
  const [packet, setPacket] = useState<PosePacket | null>(null);
  const [poseLimit, setPoseLimitState] = useState<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    const controller = cameraController.current;
    cameraController.current = null;
    controller?.stop();
    if (!mounted.current) {
      return;
    }
    setPacket(null);
    setState("idle");
    setErrorMessage(null);
    poseLimitRef.current = DEFAULT_POSE_LIMIT;
    setPoseLimitState(DEFAULT_POSE_LIMIT);
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    if (video === null || cameraController.current !== null) {
      return false;
    }
    setState("starting");
    setErrorMessage(null);
    setPacket(null);

    let controller: CameraPoseController | null = null;
    controller = new CameraPoseController({
      video,
      initialPoseLimit: poseLimitRef.current,
      onPacket: (nextPacket) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        setPacket(nextPacket);
      },
      onCameraFrame: (nextFrame) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        setPacket((current) =>
          nextFrame !== null && current?.frame.epoch === nextFrame.frame.epoch ? current : null,
        );
      },
      onError: (message) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        cameraController.current = null;
        setPacket(null);
        setErrorMessage(message);
        setState("error");
      },
    });
    cameraController.current = controller;

    try {
      await controller.start();
      if (!mounted.current || cameraController.current !== controller) {
        return false;
      }
      setState("tracking");
      return true;
    } catch (error) {
      if (mounted.current && cameraController.current === controller) {
        cameraController.current = null;
        setState("error");
        setErrorMessage(error instanceof Error ? error.message : "Body tracking could not start.");
      }
      return false;
    }
  }, []);

  const setPoseLimit = useCallback(async (nextPoseLimit: PoseLimit): Promise<void> => {
    const controller = cameraController.current;
    if (controller === null) {
      throw new Error("Body tracking is not active.");
    }
    await controller.setPoseLimit(nextPoseLimit);
    if (cameraController.current !== controller) {
      throw new Error("Body tracking stopped before player mode changed.");
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
    packet,
    poseLimit,
    errorMessage,
    start,
    stop,
    setPoseLimit,
  };
}

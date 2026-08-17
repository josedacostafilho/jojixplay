import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { CameraFrameNormalization, CameraLayout } from "../domain/camera";
import type { PosePacket } from "../domain/pose";
import { DEFAULT_POSE_LIMIT, type PoseLimit } from "../domain/pose-limit";
import { CameraPoseController } from "./camera-pose-controller";
import type { PoseDiagnosticsSnapshot } from "./pose-diagnostics";

export type CameraTrackingState = "idle" | "starting" | "tracking" | "error";

interface CameraPoseOptions {
  onPacket?: (packet: PosePacket) => void;
}

interface StopCameraPoseOptions {
  resetPoseLimit: boolean;
}

export interface CameraPoseLifecycle {
  videoRef: preact.RefObject<HTMLVideoElement>;
  state: CameraTrackingState;
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  cameraFrame: CameraFrameNormalization | null;
  requestedCameraLayout: CameraLayout | null;
  diagnostics: PoseDiagnosticsSnapshot | null;
  errorMessage: string | null;
  start: () => Promise<boolean>;
  stop: (options: StopCameraPoseOptions) => void;
  setPoseLimit: (poseLimit: PoseLimit) => Promise<void>;
  requestCameraLayout: (layout: CameraLayout) => Promise<void>;
}

export function useCameraPose(options: CameraPoseOptions = {}): CameraPoseLifecycle {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraController = useRef<CameraPoseController | null>(null);
  const mounted = useRef(true);
  const onPacket = useRef(options.onPacket);
  onPacket.current = options.onPacket;
  const poseLimitRef = useRef<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [state, setState] = useState<CameraTrackingState>("idle");
  const [packet, setPacket] = useState<PosePacket | null>(null);
  const [poseLimit, setPoseLimitState] = useState<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [cameraFrame, setCameraFrame] = useState<CameraFrameNormalization | null>(null);
  const [requestedCameraLayout, setRequestedCameraLayout] = useState<CameraLayout | null>(null);
  const [diagnostics, setDiagnostics] = useState<PoseDiagnosticsSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const clearDerivedState = useCallback(() => {
    setPacket(null);
    setDiagnostics(null);
    setCameraFrame(null);
    setRequestedCameraLayout(null);
  }, []);

  const stop = useCallback(
    ({ resetPoseLimit }: StopCameraPoseOptions) => {
      const controller = cameraController.current;
      cameraController.current = null;
      controller?.stop();
      if (!mounted.current) {
        return;
      }
      clearDerivedState();
      setState("idle");
      setErrorMessage(null);
      if (resetPoseLimit) {
        poseLimitRef.current = DEFAULT_POSE_LIMIT;
        setPoseLimitState(DEFAULT_POSE_LIMIT);
      }
    },
    [clearDerivedState],
  );

  const start = useCallback(async (): Promise<boolean> => {
    const video = videoRef.current;
    if (video === null || cameraController.current !== null) {
      return false;
    }
    setState("starting");
    setErrorMessage(null);
    clearDerivedState();

    let controller: CameraPoseController | null = null;
    controller = new CameraPoseController({
      video,
      initialPoseLimit: poseLimitRef.current,
      onPacket: (nextPacket) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        setPacket(nextPacket);
        onPacket.current?.(nextPacket);
      },
      onDiagnostics: (nextDiagnostics) => {
        if (mounted.current && cameraController.current === controller) {
          setDiagnostics(nextDiagnostics);
        }
      },
      onCameraFrame: (nextFrame) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        setCameraFrame(nextFrame);
        setPacket((current) =>
          nextFrame !== null && current?.frame.epoch === nextFrame.frame.epoch ? current : null,
        );
      },
      onRequestedCameraLayout: (layout) => {
        if (mounted.current && cameraController.current === controller) {
          setRequestedCameraLayout(layout);
        }
      },
      onError: (message) => {
        if (!mounted.current || cameraController.current !== controller) {
          return;
        }
        cameraController.current = null;
        clearDerivedState();
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
  }, [clearDerivedState]);

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

  const requestCameraLayout = useCallback(async (layout: CameraLayout): Promise<void> => {
    const controller = cameraController.current;
    if (controller === null) {
      throw new Error("Body tracking is not active.");
    }
    await controller.requestCameraLayout(layout);
    if (cameraController.current !== controller) {
      throw new Error("Body tracking stopped before camera layout changed.");
    }
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
    cameraFrame,
    requestedCameraLayout,
    diagnostics,
    errorMessage,
    start,
    stop,
    setPoseLimit,
    requestCameraLayout,
  };
}

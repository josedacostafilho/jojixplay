import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { BodyPlayfield } from "../components/body-playfield";
import { StatusPill } from "../components/status-pill";
import { UnsupportedPanel } from "../components/unsupported-panel";
import type { CameraLayout } from "../domain/camera";
import type { PoseLimit } from "../domain/pose-limit";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { applicationModeUrl } from "../platform/application-mode";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import { useCameraPose } from "../pose/use-camera-pose";

const STALE_AFTER_MS = 1_000;

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const [immersiveSession] = useState(() => new LocalImmersiveSession());
  const camera = useCameraPose();
  const {
    start: startCamera,
    stop: stopCamera,
    setPoseLimit: setCameraPoseLimit,
    requestCameraLayout: requestCameraLayoutFromController,
  } = camera;
  const startRequested = useRef(false);
  const poseLimitRequestActive = useRef(false);
  const cameraLayoutRequestActive = useRef(false);
  const [poseLimitPending, setPoseLimitPending] = useState(false);
  const [cameraLayoutPending, setCameraLayoutPending] = useState(false);
  const [stale, setStale] = useState(true);

  useEffect(() => {
    if (camera.state !== "tracking" || camera.packet === null) {
      setStale(true);
      return;
    }
    setStale(false);
    const timeoutId = window.setTimeout(() => setStale(true), STALE_AFTER_MS);
    return () => window.clearTimeout(timeoutId);
  }, [camera.packet, camera.state]);

  useEffect(() => {
    if (camera.state === "error") {
      void immersiveSession.stop();
    }
  }, [camera.state, immersiveSession]);

  useEffect(
    () => () => {
      void immersiveSession.stop();
    },
    [immersiveSession],
  );

  const startLocalPlay = useCallback(() => {
    if (startRequested.current || !capabilities.supported) {
      return;
    }
    startRequested.current = true;
    if (camera.state === "error") {
      stopCamera({ resetPoseLimit: true });
    }
    immersiveSession.start();
    void startCamera().then((started) => {
      startRequested.current = false;
      if (!started) {
        void immersiveSession.stop();
      }
    });
  }, [camera.state, capabilities.supported, immersiveSession, startCamera, stopCamera]);

  const stopLocalPlay = useCallback(() => {
    poseLimitRequestActive.current = false;
    cameraLayoutRequestActive.current = false;
    setPoseLimitPending(false);
    setCameraLayoutPending(false);
    setStale(true);
    stopCamera({ resetPoseLimit: true });
    void immersiveSession.stop();
  }, [immersiveSession, stopCamera]);

  const requestPoseLimit = useCallback(
    async (poseLimit: PoseLimit) => {
      if (poseLimitRequestActive.current) {
        throw new Error("Player mode is already changing.");
      }
      poseLimitRequestActive.current = true;
      setPoseLimitPending(true);
      try {
        await setCameraPoseLimit(poseLimit);
      } finally {
        poseLimitRequestActive.current = false;
        setPoseLimitPending(false);
      }
    },
    [setCameraPoseLimit],
  );

  const requestCameraLayout = useCallback(
    async (layout: CameraLayout) => {
      if (cameraLayoutRequestActive.current) {
        throw new Error("Camera layout is already changing.");
      }
      cameraLayoutRequestActive.current = true;
      setCameraLayoutPending(true);
      try {
        await requestCameraLayoutFromController(layout);
      } finally {
        cameraLayoutRequestActive.current = false;
        setCameraLayoutPending(false);
      }
    },
    [requestCameraLayoutFromController],
  );

  if (!capabilities.supported) {
    return <UnsupportedPanel device="phone" missing={capabilities.missing} />;
  }

  const livePacket = stale ? null : camera.packet;
  const active = camera.state === "tracking";
  const statusLabel =
    camera.requestedCameraLayout !== null
      ? `Rotate to ${camera.requestedCameraLayout}`
      : !active
        ? camera.state === "starting"
          ? "Starting camera"
          : "Ready for local play"
        : stale || camera.packet === null
          ? "Looking for body"
          : camera.packet.poses.length === 0
            ? "Step into frame"
            : `${camera.packet.poses.length} ${camera.packet.poses.length === 1 ? "player" : "players"} visible`;

  return (
    <main class={`local-play-page${active ? " local-play-page--active" : ""}`}>
      <video
        ref={camera.videoRef}
        class="local-camera-source"
        muted
        playsInline
        aria-hidden="true"
        tabIndex={-1}
      />

      <header class="local-play-header">
        <a class="brand" href={applicationModeUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <div class="local-play-header__actions">
          <StatusPill tone={active ? (stale ? "warning" : "active") : "neutral"}>
            {statusLabel}
          </StatusPill>
          {active ? (
            <button
              class="local-stop-button"
              type="button"
              aria-label="Stop local play"
              onClick={stopLocalPlay}
            >
              Stop
            </button>
          ) : null}
        </div>
      </header>

      {active ? (
        <section class="local-play-stage" aria-label="Local body-control playground">
          <BodyPlayfield
            packet={livePacket}
            poseLimit={camera.poseLimit}
            poseLimitPending={poseLimitPending}
            cameraLayoutPending={cameraLayoutPending}
            onPoseLimitRequest={requestPoseLimit}
            onCameraLayoutRequest={requestCameraLayout}
          />
        </section>
      ) : (
        <section class="local-play-setup" aria-labelledby="local-play-title">
          <div>
            <p class="eyebrow">All-in-one mode</p>
            <h1 id="local-play-title">Play right here on your phone.</h1>
            <p>
              Prop up this phone so the selfie camera can see your full body. JojixPlay will run
              tracking and the complete games here; you can mirror this screen with your device
              settings if you want a larger display.
            </p>
            <p>Camera pixels stay on this device and are never shown, sent, recorded, or stored.</p>
            {camera.errorMessage === null ? null : (
              <p class="inline-error local-play-error" role="alert">
                {camera.errorMessage}
              </p>
            )}
            <button
              class="button button--primary local-play-start"
              type="button"
              onClick={startLocalPlay}
              disabled={camera.state === "starting"}
            >
              {camera.state === "starting" ? "Starting local play…" : "Start local play"}
            </button>
            <span class="local-play-setup__hint">
              Fullscreen and keeping the display awake are used when your browser permits them.
            </span>
          </div>
        </section>
      )}
    </main>
  );
}

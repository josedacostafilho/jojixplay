import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AppAudioEngine, type AudioRuntimeState } from "../audio/audio-engine";
import { BodyPlayfield } from "../components/body-playfield";
import { StatusPill } from "../components/status-pill";
import { UnsupportedPanel } from "../components/unsupported-panel";
import type { PoseLimit } from "../domain/pose-limit";
import { inspectLocalPlayCapabilities } from "../platform/capabilities";
import { LocalImmersiveSession } from "../platform/local-immersive-session";
import { useCameraPose } from "../pose/use-camera-pose";

const STALE_AFTER_MS = 1_000;

export function LocalPlayPage() {
  const capabilities = useMemo(inspectLocalPlayCapabilities, []);
  const [immersiveSession] = useState(() => new LocalImmersiveSession());
  const [audioState, setAudioState] = useState<AudioRuntimeState>("idle");
  const [audio] = useState(() => new AppAudioEngine(setAudioState));
  const camera = useCameraPose();
  const { start: startCamera, stop: stopCamera, setPoseLimit: setCameraPoseLimit } = camera;
  const startRequested = useRef(false);
  const poseLimitRequestActive = useRef(false);
  const [poseLimitPending, setPoseLimitPending] = useState(false);
  const [stale, setStale] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);

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
      startRequested.current = false;
      setSessionActive(false);
      void immersiveSession.stop();
      void audio.stop();
    }
  }, [audio, camera.state, immersiveSession]);

  useEffect(
    () => () => {
      void immersiveSession.stop();
      void audio.stop();
    },
    [audio, immersiveSession],
  );

  const startLocalPlay = useCallback(() => {
    if (startRequested.current || !capabilities.supported) {
      return;
    }
    startRequested.current = true;
    setStartupError(null);
    if (camera.state === "error") {
      stopCamera();
    }
    immersiveSession.start();
    const audioStart = audio.start();
    void Promise.all([audioStart, startCamera()])
      .then(([, cameraStarted]) => {
        if (!cameraStarted) {
          throw new Error("The camera did not start.");
        }
        setSessionActive(true);
        audio.playCue({ type: "ui-success" });
      })
      .catch(() => {
        setSessionActive(false);
        stopCamera();
        void immersiveSession.stop();
        void audio.stop();
        setStartupError(
          "Play could not start its camera and sound. Check browser permissions and try again.",
        );
      })
      .finally(() => {
        startRequested.current = false;
      });
  }, [audio, camera.state, capabilities.supported, immersiveSession, startCamera, stopCamera]);

  const stopLocalPlay = useCallback(() => {
    poseLimitRequestActive.current = false;
    setPoseLimitPending(false);
    setStale(true);
    setSessionActive(false);
    setStartupError(null);
    stopCamera();
    void immersiveSession.stop();
    void audio.stop();
  }, [audio, immersiveSession, stopCamera]);

  const resumeAudio = useCallback(() => {
    setStartupError(null);
    void audio.resume().catch(() => {
      setStartupError("Sound is suspended. Press Resume sound and allow audio playback.");
    });
  }, [audio]);

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

  if (!capabilities.supported) {
    return <UnsupportedPanel missing={capabilities.missing} />;
  }

  const livePacket = stale ? null : camera.packet;
  const active = sessionActive && camera.state === "tracking";
  const statusLabel = !active
    ? camera.state === "starting"
      ? "Starting camera"
      : "Ready to play"
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
        <a class="brand" href={import.meta.env.BASE_URL} aria-label="Jojixplay home">
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
            <>
              {audioState === "suspended" || audioState === "error" ? (
                <button class="text-button" type="button" onClick={resumeAudio}>
                  Resume sound
                </button>
              ) : null}
              <button
                class="local-stop-button"
                type="button"
                aria-label="Stop playing"
                onClick={stopLocalPlay}
              >
                Stop
              </button>
            </>
          ) : null}
        </div>
      </header>

      {active ? (
        <section class="local-play-stage" aria-label="Body-control playground">
          <BodyPlayfield
            audio={audio}
            packet={livePacket}
            poseLimit={camera.poseLimit}
            poseLimitPending={poseLimitPending}
            onPoseLimitRequest={requestPoseLimit}
          />
        </section>
      ) : (
        <section class="local-play-setup" aria-labelledby="local-play-title">
          <div>
            <p class="eyebrow">Your phone is the playground</p>
            <h1 id="local-play-title">Play right here on your phone.</h1>
            <p>
              Mirror this screen to your TV using your phone settings or a cable. Prop up the phone
              so the selfie camera can see your full body. The games run entirely on your phone.
            </p>
            <p>Camera pixels stay on this device and are never shown, sent, recorded, or stored.</p>
            {camera.errorMessage === null && startupError === null ? null : (
              <p class="inline-error local-play-error" role="alert">
                {camera.errorMessage ?? startupError}
              </p>
            )}
            <button
              class="button button--primary local-play-start"
              type="button"
              onClick={startLocalPlay}
              disabled={camera.state === "starting" || audioState === "starting"}
            >
              {camera.state === "starting" || audioState === "starting"
                ? "Starting play…"
                : "Start playing"}
            </button>
            <span class="local-play-setup__hint">
              Sound starts with this button. Fullscreen and keeping the display awake are used when
              your browser permits them.
            </span>
          </div>
        </section>
      )}
    </main>
  );
}

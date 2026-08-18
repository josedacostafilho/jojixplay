import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { AppAudioEngine, type AudioRuntimeState } from "../audio/audio-engine";
import { StatusPill } from "../components/status-pill";
import { BodyPlayfield } from "../components/body-playfield";
import { UnsupportedPanel } from "../components/unsupported-panel";
import type { CameraLayout } from "../domain/camera";
import { acceptIncreasingSequence, type PosePacket } from "../domain/pose";
import { DEFAULT_POSE_LIMIT, type PoseLimit } from "../domain/pose-limit";
import { inspectTvDisplayCapabilities } from "../platform/capabilities";
import { applicationModeUrl } from "../platform/application-mode";
import {
  buildPhonePairingUrl,
  createPairingKey,
  deriveSessionCredentials,
  formatPairingKey,
  type PairingKey,
  type SessionCredentials,
} from "../session/credentials";
import {
  connectPeerRoom,
  type PeerConnectionState,
  type PosePeerRoom,
} from "../transport/peer-room";

const STALE_AFTER_MS = 1_000;
type TvModeState = "ready" | "starting" | "started";

function connectionLabel(state: PeerConnectionState): string {
  switch (state) {
    case "connecting":
      return "Opening session";
    case "waiting":
      return "Waiting for phone";
    case "connected":
      return "Phone connected";
    case "disconnected":
      return "Phone disconnected";
    case "error":
      return "Connection failed";
  }
}

export function TvDisplay() {
  const capabilities = useMemo(inspectTvDisplayCapabilities, []);
  const [audioState, setAudioState] = useState<AudioRuntimeState>("idle");
  const [audio] = useState(() => new AppAudioEngine(setAudioState));
  const [audioError, setAudioError] = useState<string | null>(null);
  const [tvMode, setTvMode] = useState<TvModeState>("ready");
  const [pairingKey, setPairingKey] = useState<PairingKey | null>(null);
  const pairingUrl = useMemo(
    () => (pairingKey === null ? null : buildPhonePairingUrl(window.location.href, pairingKey)),
    [pairingKey],
  );
  const [credentials, setCredentials] = useState<SessionCredentials | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [connection, setConnection] = useState<PeerConnectionState>("connecting");
  const [packet, setPacket] = useState<PosePacket | null>(null);
  const [stale, setStale] = useState(true);
  const [poseLimit, setPoseLimit] = useState<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [poseLimitPending, setPoseLimitPending] = useState(false);
  const [cameraLayoutPending, setCameraLayoutPending] = useState(false);
  const newestSequence = useRef(-1);
  const peerRoomRef = useRef<PosePeerRoom | null>(null);
  const poseLimitRequestTokenRef = useRef<symbol | null>(null);
  const cameraLayoutRequestTokenRef = useRef<symbol | null>(null);
  const startRequested = useRef(false);
  const previousConnectionRef = useRef<PeerConnectionState>("connecting");

  const startTvMode = useCallback(() => {
    if (startRequested.current || !capabilities.supported) {
      return;
    }
    startRequested.current = true;
    setTvMode("starting");
    setAudioError(null);

    const beginPairing = () => {
      audio.playCue({ type: "ui-success" });
      setPairingKey(createPairingKey());
      setTvMode("started");
    };
    const audioStart = audio.start();
    const requestFullscreen = document.documentElement.requestFullscreen;
    let fullscreenAttempt = Promise.resolve();
    if (!document.fullscreenElement && typeof requestFullscreen === "function") {
      try {
        fullscreenAttempt = Promise.resolve(
          requestFullscreen.call(document.documentElement, { navigationUI: "hide" }),
        ).catch(() => undefined);
      } catch {
        fullscreenAttempt = Promise.resolve();
      }
    }
    void Promise.all([audioStart, fullscreenAttempt])
      .then(beginPairing)
      .catch(() => {
        startRequested.current = false;
        setTvMode("ready");
        setAudioError("TV mode could not start sound. Allow audio playback and try again.");
        void audio.stop();
      });
  }, [audio, capabilities.supported]);

  const resumeAudio = useCallback(() => {
    setAudioError(null);
    void audio.resume().catch(() => {
      setAudioError("Sound is suspended. Press Resume sound and allow audio playback.");
    });
  }, [audio]);

  useEffect(
    () => () => {
      void audio.stop();
    },
    [audio],
  );

  useEffect(() => {
    const previousConnection = previousConnectionRef.current;
    previousConnectionRef.current = connection;
    if (connection === "connected" && previousConnection !== "connected") {
      audio.playCue({ type: "ui-success" });
    } else if (connection === "error" && previousConnection !== "error") {
      audio.playCue({ type: "ui-error" });
    }
  }, [audio, connection]);

  useEffect(() => {
    if (tvMode !== "ready") {
      return;
    }
    const handleRemoteActivation = (event: KeyboardEvent) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      startTvMode();
    };
    window.addEventListener("keydown", handleRemoteActivation);
    return () => window.removeEventListener("keydown", handleRemoteActivation);
  }, [tvMode, startTvMode]);

  useEffect(() => {
    if (!capabilities.supported || pairingKey === null) {
      return;
    }
    let active = true;
    void deriveSessionCredentials(pairingKey)
      .then((nextCredentials) => {
        if (active) {
          setCredentials(nextCredentials);
        }
      })
      .catch(() => {
        if (active) {
          setConnection("error");
        }
      });
    return () => {
      active = false;
    };
  }, [capabilities.supported, pairingKey]);

  useEffect(() => {
    if (!capabilities.supported || pairingUrl === null) {
      return;
    }
    let active = true;
    void import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(pairingUrl, {
          width: 420,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#111827", light: "#f8fafc" },
        }),
      )
      .then((dataUrl) => {
        if (active) {
          setQrCode(dataUrl);
        }
      })
      .catch(() => {
        if (active) {
          setQrError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [capabilities.supported, pairingUrl]);

  useEffect(() => {
    if (!capabilities.supported || credentials === null) {
      return;
    }
    let peerRoom: PosePeerRoom;
    try {
      peerRoom = connectPeerRoom({
        role: "tv",
        credentials,
        onStateChange: (state) => {
          setConnection(state);
          if (state !== "connected") {
            poseLimitRequestTokenRef.current = null;
            cameraLayoutRequestTokenRef.current = null;
            newestSequence.current = -1;
            setPacket(null);
            setStale(true);
            setPoseLimit(DEFAULT_POSE_LIMIT);
            setPoseLimitPending(false);
            setCameraLayoutPending(false);
          }
        },
        onPosePacket: (nextPacket) => {
          const acceptedSequence = acceptIncreasingSequence(
            newestSequence.current,
            nextPacket.sequence,
          );
          if (acceptedSequence === null) {
            return;
          }
          newestSequence.current = acceptedSequence;
          setPacket(nextPacket);
          setStale(false);
        },
      });
    } catch {
      setConnection("error");
      return;
    }
    peerRoomRef.current = peerRoom;
    return () => {
      peerRoomRef.current = null;
      void peerRoom.close();
    };
  }, [capabilities.supported, credentials]);

  useEffect(() => {
    if (packet === null || connection !== "connected") {
      return;
    }
    const timeoutId = window.setTimeout(() => setStale(true), STALE_AFTER_MS);
    return () => window.clearTimeout(timeoutId);
  }, [packet, connection]);

  const requestPoseLimit = useCallback(async (requestedPoseLimit: PoseLimit) => {
    const room = peerRoomRef.current;
    if (room === null) {
      throw new Error("The phone is not connected.");
    }
    if (poseLimitRequestTokenRef.current !== null) {
      throw new Error("Player mode is already changing.");
    }
    const requestToken = Symbol("pose-limit-request");
    poseLimitRequestTokenRef.current = requestToken;
    setPoseLimitPending(true);
    try {
      const appliedPoseLimit = await room.requestPoseLimit(requestedPoseLimit);
      if (poseLimitRequestTokenRef.current !== requestToken || peerRoomRef.current !== room) {
        throw new Error("The phone disconnected before player mode changed.");
      }
      setPoseLimit(appliedPoseLimit);
    } finally {
      if (poseLimitRequestTokenRef.current === requestToken) {
        poseLimitRequestTokenRef.current = null;
        setPoseLimitPending(false);
      }
    }
  }, []);

  const requestCameraLayout = useCallback(async (requestedLayout: CameraLayout) => {
    const room = peerRoomRef.current;
    if (room === null) {
      throw new Error("The phone is not connected.");
    }
    if (cameraLayoutRequestTokenRef.current !== null) {
      throw new Error("Camera layout is already changing.");
    }
    const requestToken = Symbol("camera-layout-request");
    cameraLayoutRequestTokenRef.current = requestToken;
    setCameraLayoutPending(true);
    try {
      const appliedLayout = await room.requestCameraLayout(requestedLayout);
      if (cameraLayoutRequestTokenRef.current !== requestToken || peerRoomRef.current !== room) {
        throw new Error("The phone disconnected before camera layout changed.");
      }
      if (appliedLayout !== requestedLayout) {
        throw new Error("The phone acknowledged an unexpected camera layout.");
      }
    } finally {
      if (cameraLayoutRequestTokenRef.current === requestToken) {
        cameraLayoutRequestTokenRef.current = null;
        setCameraLayoutPending(false);
      }
    }
  }, []);

  if (!capabilities.supported) {
    return <UnsupportedPanel device="television" missing={capabilities.missing} />;
  }

  const isLive = connection === "connected" && packet !== null && !stale;
  const showPairing = tvMode === "started" && connection !== "connected";
  const tone =
    tvMode !== "started"
      ? "neutral"
      : connection === "connected"
        ? "active"
        : connection === "error"
          ? "danger"
          : "neutral";
  const statusLabel =
    tvMode === "ready"
      ? "Ready for TV mode"
      : tvMode === "starting"
        ? "Entering TV mode"
        : connectionLabel(connection);

  return (
    <main class="tv-page">
      <header class="app-header app-header--tv">
        <a class="brand" href={applicationModeUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <div class="app-header__actions">
          {tvMode === "started" && (audioState === "suspended" || audioState === "error") ? (
            <button class="text-button" type="button" onClick={resumeAudio}>
              Resume sound
            </button>
          ) : null}
          <StatusPill tone={tone}>{statusLabel}</StatusPill>
        </div>
      </header>

      <section class="tv-stage" aria-labelledby="tv-title">
        {connection === "connected" ? (
          <BodyPlayfield
            audio={audio}
            packet={isLive ? packet : null}
            poseLimit={poseLimit}
            poseLimitPending={poseLimitPending}
            cameraLayoutPending={cameraLayoutPending}
            onPoseLimitRequest={requestPoseLimit}
            onCameraLayoutRequest={requestCameraLayout}
          />
        ) : null}

        {tvMode !== "started" ? (
          <div class="tv-start-card">
            <p class="eyebrow">Television display</p>
            <h1 id="tv-title">Make this screen the playground.</h1>
            <p>
              Use the TV remote once to start sound, enter fullscreen, and begin pairing. After your
              phone connects, your body controls the on-screen actions.
            </p>
            {audioError === null ? null : (
              <p class="inline-error" role="alert">
                {audioError}
              </p>
            )}
            <button
              class="button button--primary tv-start-card__button"
              type="button"
              onClick={startTvMode}
              disabled={tvMode === "starting"}
            >
              {tvMode === "starting" ? "Starting TV mode…" : "Start TV mode"}
            </button>
            <span>Sound starts with this button. Fullscreen is used when supported.</span>
          </div>
        ) : showPairing ? (
          <div class="pairing-card">
            <div class="pairing-card__copy">
              <p class="eyebrow">Pair your controller</p>
              <h1 id="tv-title">Connect your phone</h1>
              <ol class="pairing-steps">
                <li>Scan the QR code, or open Jojixplay on your phone.</li>
                <li>If scanning fails, choose Open on the phone and enter the key below.</li>
                <li>Connect, then start body tracking.</li>
                <li>Step back until your full body is visible.</li>
              </ol>
              {pairingKey !== null ? (
                <div class="pairing-key">
                  <span>TV pairing key</span>
                  <output aria-label="TV pairing key">{formatPairingKey(pairingKey)}</output>
                </div>
              ) : null}
              {connection === "error" ? (
                <p class="inline-error" role="alert">
                  The session could not continue. Check the network and create a new session.
                </p>
              ) : null}
              <button class="text-button" type="button" onClick={() => window.location.reload()}>
                Create a new session
              </button>
            </div>
            <div class="qr-frame" aria-busy={qrCode === null && !qrError}>
              {qrError ? (
                <span class="qr-loading" role="alert">
                  QR creation failed. Enter the TV pairing key instead.
                </span>
              ) : qrCode === null ? (
                <span class="qr-loading">Preparing secure QR…</span>
              ) : (
                <img src={qrCode} alt="Phone pairing QR code" width="420" height="420" />
              )}
            </div>
          </div>
        ) : connection === "connected" ? (
          <div class="live-hud">
            <div>
              <p class="eyebrow">Live pose</p>
              <h1 id="tv-title">
                {packet === null
                  ? "Start tracking on your phone"
                  : stale
                    ? "Signal paused"
                    : packet.poses.length === 0
                      ? "Step into frame"
                      : "Move around"}
              </h1>
            </div>
            <div class="live-hud__metric" aria-live="polite">
              <strong>{stale ? "—" : (packet?.poses.length ?? 0)}</strong>
              <span>
                {packet === null
                  ? "waiting for pose"
                  : stale
                    ? "signal is stale"
                    : packet.poses.length === 0
                      ? "no people visible"
                      : packet.poses.length === 1
                        ? "person visible"
                        : "people visible"}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      <footer class="tv-footer">
        <span>Only pose landmarks are received.</span>
        <span>Camera pixels never leave the phone.</span>
      </footer>
    </main>
  );
}

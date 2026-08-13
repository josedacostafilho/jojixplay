import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { StatusPill } from "../components/status-pill";
import { TvPlayfield } from "../components/tv-playfield";
import { roleUrl, UnsupportedPanel } from "../components/unsupported-panel";
import { acceptIncreasingSequence, type PosePacket } from "../domain/pose";
import { inspectTvCapabilities } from "../platform/capabilities";
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
  const capabilities = useMemo(inspectTvCapabilities, []);
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
  const newestSequence = useRef(-1);
  const startRequested = useRef(false);

  const startTvMode = useCallback(() => {
    if (startRequested.current || !capabilities.supported) {
      return;
    }
    startRequested.current = true;
    setTvMode("starting");

    const beginPairing = () => {
      setPairingKey(createPairingKey());
      setTvMode("started");
    };
    const requestFullscreen = document.documentElement.requestFullscreen;
    if (document.fullscreenElement || typeof requestFullscreen !== "function") {
      beginPairing();
      return;
    }
    try {
      void Promise.resolve(
        requestFullscreen.call(document.documentElement, { navigationUI: "hide" }),
      ).then(beginPairing, beginPairing);
    } catch {
      beginPairing();
    }
  }, [capabilities.supported]);

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
            newestSequence.current = -1;
            setPacket(null);
            setStale(true);
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
    return () => {
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
        <a class="brand" href={roleUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <StatusPill tone={tone}>{statusLabel}</StatusPill>
      </header>

      <section class="tv-stage" aria-labelledby="tv-title">
        {connection === "connected" ? <TvPlayfield packet={isLive ? packet : null} /> : null}

        {tvMode !== "started" ? (
          <div class="tv-start-card">
            <p class="eyebrow">Television display</p>
            <h1 id="tv-title">Make this screen the playground.</h1>
            <p>
              Use the TV remote once to enter fullscreen and begin pairing. After your phone
              connects, your body controls the on-screen actions.
            </p>
            <button
              class="button button--primary tv-start-card__button"
              type="button"
              onClick={startTvMode}
              disabled={tvMode === "starting"}
            >
              {tvMode === "starting" ? "Starting TV mode…" : "Start TV mode"}
            </button>
            <span>Fullscreen is used when this television browser permits it.</span>
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

import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { SkeletonCanvas } from "../components/skeleton-canvas";
import { StatusPill } from "../components/status-pill";
import { roleUrl, UnsupportedPanel } from "../components/unsupported-panel";
import { acceptIncreasingSequence, type PosePacket } from "../domain/pose";
import { inspectTvCapabilities } from "../platform/capabilities";
import {
  buildPhonePairingUrl,
  createPairingKey,
  deriveSessionCredentials,
  formatPairingKey,
  type SessionCredentials,
} from "../session/credentials";
import {
  connectPeerRoom,
  type PeerConnectionState,
  type PosePeerRoom,
} from "../transport/peer-room";

const STALE_AFTER_MS = 1_000;

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
  const pairingKey = useMemo(
    () => (capabilities.supported ? createPairingKey() : null),
    [capabilities.supported],
  );
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
  const showPairing = connection !== "connected";
  const tone =
    connection === "connected" ? "active" : connection === "error" ? "danger" : "neutral";

  return (
    <main class="tv-page">
      <header class="app-header app-header--tv">
        <a class="brand" href={roleUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <StatusPill tone={tone}>{connectionLabel(connection)}</StatusPill>
      </header>

      <section class="tv-stage" aria-labelledby="tv-title">
        <SkeletonCanvas
          packet={isLive ? packet : null}
          label="Live body skeleton from the paired phone"
          className="skeleton-canvas skeleton-canvas--tv"
        />

        {showPairing ? (
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
        ) : (
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
                    : packet.poses.length === 1
                      ? "person visible"
                      : "people visible"}
              </span>
            </div>
          </div>
        )}
      </section>

      <footer class="tv-footer">
        <span>Only pose landmarks are received.</span>
        <span>Camera pixels never leave the phone.</span>
      </footer>
    </main>
  );
}

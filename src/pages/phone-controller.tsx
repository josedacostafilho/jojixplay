import { useEffect, useRef, useState } from "preact/hooks";
import { AvatarCanvas } from "../components/avatar-canvas";
import { PoseDiagnosticsPanel } from "../components/pose-diagnostics-panel";
import { StatusPill } from "../components/status-pill";
import type { PosePacket } from "../domain/pose";
import { useCameraPose } from "../pose/use-camera-pose";
import { applicationModeUrl } from "../platform/application-mode";
import type { SessionCredentials } from "../session/credentials";
import { LatestOnlySender } from "../transport/latest-sender";
import {
  connectPeerRoom,
  type PeerConnectionState,
  type PosePeerRoom,
} from "../transport/peer-room";

interface PhoneControllerProps {
  credentials: SessionCredentials;
}

const PAIRING_TIMEOUT_MS = 30_000;

function peerLabel(state: PeerConnectionState): string {
  switch (state) {
    case "connecting":
      return "Finding TV";
    case "waiting":
      return "Waiting for TV";
    case "connected":
      return "TV connected";
    case "disconnected":
      return "TV disconnected";
    case "error":
      return "Connection failed";
  }
}

export function PhoneController({ credentials }: PhoneControllerProps) {
  const peerRoom = useRef<PosePeerRoom | null>(null);
  const sender = useRef<LatestOnlySender<PosePacket> | null>(null);
  const peerStateRef = useRef<PeerConnectionState>("connecting");
  const [connection, setConnection] = useState<PeerConnectionState>("connecting");
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const {
    videoRef,
    state: camera,
    packet,
    poseLimit,
    cameraFrame,
    requestedCameraLayout,
    diagnostics,
    errorMessage: cameraError,
    start: startTracking,
    stop: stopCamera,
    setPoseLimit,
    requestCameraLayout,
  } = useCameraPose({
    onPacket: (nextPacket) => {
      if (peerStateRef.current === "connected") {
        sender.current?.push(nextPacket);
      }
    },
  });

  useEffect(() => {
    let pairingTimeoutId: number | null = null;
    const clearPairingTimeout = () => {
      if (pairingTimeoutId !== null) {
        window.clearTimeout(pairingTimeoutId);
        pairingTimeoutId = null;
      }
    };
    const stopCameraAfterSessionEnd = () => {
      stopCamera({ resetPoseLimit: true });
    };
    let room: PosePeerRoom;
    try {
      room = connectPeerRoom({
        role: "phone",
        credentials,
        onStateChange: (state) => {
          peerStateRef.current = state;
          setConnection(state);
          if (state === "connected" || state === "error") {
            clearPairingTimeout();
          }
          if (state === "error" || state === "disconnected") {
            stopCameraAfterSessionEnd();
          }
        },
        onPoseLimitRequest: async (requestedPoseLimit) => {
          await setPoseLimit(requestedPoseLimit);
          return requestedPoseLimit;
        },
        onCameraLayoutRequest: async (requestedLayout) => {
          await requestCameraLayout(requestedLayout);
          return requestedLayout;
        },
      });
    } catch {
      peerStateRef.current = "error";
      setConnection("error");
      return;
    }
    peerRoom.current = room;
    sender.current = new LatestOnlySender(
      (nextPacket) => room.sendPose(nextPacket),
      () => {
        if (peerStateRef.current === "connected") {
          setDeliveryError("Pose delivery failed. Check the connection and retry the session.");
        }
      },
    );
    pairingTimeoutId = window.setTimeout(() => {
      if (peerStateRef.current !== "connecting" && peerStateRef.current !== "waiting") {
        return;
      }
      peerStateRef.current = "error";
      setConnection("error");
      stopCameraAfterSessionEnd();
      sender.current?.dispose();
      void room.close();
    }, PAIRING_TIMEOUT_MS);

    return () => {
      clearPairingTimeout();
      sender.current?.dispose();
      sender.current = null;
      peerRoom.current = null;
      void room.close();
    };
  }, [credentials, requestCameraLayout, setPoseLimit, stopCamera]);

  const peerTone =
    connection === "connected" ? "active" : connection === "error" ? "danger" : "neutral";
  const cameraQuarterTurn = cameraFrame?.rotation === 90 || cameraFrame?.rotation === 270;
  const cameraStageStyle =
    cameraFrame === null
      ? undefined
      : `aspect-ratio: ${cameraFrame.frame.width} / ${cameraFrame.frame.height}; --camera-preview-rotation: ${cameraFrame.rotation}deg; --camera-canonical-aspect: ${cameraFrame.frame.width / cameraFrame.frame.height}`;

  return (
    <main class="phone-page">
      <header class="app-header">
        <a class="brand" href={applicationModeUrl(null)} aria-label="Jojixplay home">
          <span class="brand__mark" aria-hidden="true">
            J
          </span>
          <span>jojixplay</span>
        </a>
        <StatusPill tone={peerTone}>{peerLabel(connection)}</StatusPill>
      </header>

      <section class="phone-content" aria-labelledby="phone-title">
        <div class="phone-copy">
          <p class="eyebrow">Phone controller</p>
          <h1 id="phone-title">
            {camera === "tracking"
              ? "Keep your full body in view."
              : "Ready to track your movement?"}
          </h1>
          <p>
            Tracking runs on this phone. The TV receives landmarks—not video—and nothing is
            recorded.
          </p>
        </div>

        <div
          class={`camera-stage camera-stage--${camera}`}
          data-camera-quarter-turn={cameraQuarterTurn ? "true" : "false"}
          style={cameraStageStyle}
        >
          <video ref={videoRef} muted playsInline aria-label="Live camera preview" />
          <AvatarCanvas
            packet={camera === "tracking" ? packet : null}
            label="Your locally detected body avatar"
            className="avatar-canvas avatar-canvas--camera"
            appearance="camera"
          />
          {camera !== "tracking" ? (
            <div class="camera-placeholder" aria-hidden="true">
              <span class="camera-placeholder__figure">
                ●<br />
                ╱│╲
                <br />╱ ╲
              </span>
              <span>Hold the phone upright or sideways. A game will ask if it needs one.</span>
            </div>
          ) : null}
          {requestedCameraLayout === null ? null : (
            <div class="camera-orientation-prompt" role="status" aria-live="assertive">
              <strong>Rotate phone to {requestedCameraLayout}</strong>
              <span>Tracking resumes automatically when the camera is stable.</span>
            </div>
          )}
          <div class="camera-badge">
            {camera === "tracking"
              ? packet === null
                ? "Scanning…"
                : `${packet.poses.length} of ${poseLimit} ${poseLimit === 1 ? "player" : "players"} visible · ${packet.frame.layout}`
              : "Camera off"}
          </div>
        </div>

        {cameraError !== null ? (
          <p class="inline-error" role="alert">
            {cameraError}
          </p>
        ) : null}
        {deliveryError !== null ? (
          <p class="inline-error" role="alert">
            {deliveryError}
          </p>
        ) : null}
        {connection === "error" ? (
          <p class="inline-error" role="alert">
            The TV could not be reached. Return to the TV, create a new session, and use its new
            pairing key or QR code.
          </p>
        ) : null}

        <div class="phone-actions">
          {camera === "tracking" ? (
            <button
              class="button button--danger"
              type="button"
              onClick={() => stopCamera({ resetPoseLimit: false })}
            >
              Stop tracking
            </button>
          ) : (
            <button
              class="button button--primary"
              type="button"
              onClick={() => {
                setDeliveryError(null);
                void startTracking();
              }}
              disabled={camera === "starting" || connection === "error"}
            >
              {camera === "starting" ? "Starting camera…" : "Start body tracking"}
            </button>
          )}
        </div>

        {camera === "tracking" ? (
          <PoseDiagnosticsPanel diagnostics={diagnostics} poseLimit={poseLimit} />
        ) : null}

        <ul class="privacy-list" aria-label="Privacy summary">
          <li>
            <span aria-hidden="true">✓</span> No audio
          </li>
          <li>
            <span aria-hidden="true">✓</span> No pixels sent
          </li>
          <li>
            <span aria-hidden="true">✓</span> No account
          </li>
        </ul>
      </section>
    </main>
  );
}

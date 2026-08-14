import { useEffect, useRef, useState } from "preact/hooks";
import { AvatarCanvas } from "../components/avatar-canvas";
import { PoseDiagnosticsPanel } from "../components/pose-diagnostics-panel";
import { StatusPill } from "../components/status-pill";
import { roleUrl } from "../components/unsupported-panel";
import type { PosePacket } from "../domain/pose";
import { DEFAULT_POSE_LIMIT, type PoseLimit } from "../domain/pose-limit";
import { CameraPoseController } from "../pose/camera-pose-controller";
import type { PoseDiagnosticsSnapshot } from "../pose/pose-diagnostics";
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

type CameraState = "idle" | "starting" | "tracking" | "error";
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraController = useRef<CameraPoseController | null>(null);
  const peerRoom = useRef<PosePeerRoom | null>(null);
  const sender = useRef<LatestOnlySender<PosePacket> | null>(null);
  const peerStateRef = useRef<PeerConnectionState>("connecting");
  const poseLimitRef = useRef<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [connection, setConnection] = useState<PeerConnectionState>("connecting");
  const [camera, setCamera] = useState<CameraState>("idle");
  const [packet, setPacket] = useState<PosePacket | null>(null);
  const [poseLimit, setPoseLimit] = useState<PoseLimit>(DEFAULT_POSE_LIMIT);
  const [diagnostics, setDiagnostics] = useState<PoseDiagnosticsSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let pairingTimeoutId: number | null = null;
    const clearPairingTimeout = () => {
      if (pairingTimeoutId !== null) {
        window.clearTimeout(pairingTimeoutId);
        pairingTimeoutId = null;
      }
    };
    const stopCameraAfterSessionEnd = () => {
      cameraController.current?.stop();
      cameraController.current = null;
      setPacket(null);
      setDiagnostics(null);
      setCamera("idle");
      poseLimitRef.current = DEFAULT_POSE_LIMIT;
      setPoseLimit(DEFAULT_POSE_LIMIT);
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
          const controller = cameraController.current;
          if (controller === null) {
            throw new Error("Body tracking is not active.");
          }
          await controller.setPoseLimit(requestedPoseLimit);
          poseLimitRef.current = requestedPoseLimit;
          setPoseLimit(requestedPoseLimit);
          return requestedPoseLimit;
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
          setErrorMessage("Pose delivery failed. Check the connection and retry the session.");
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
      cameraController.current?.stop();
      cameraController.current = null;
      sender.current?.dispose();
      sender.current = null;
      peerRoom.current = null;
      void room.close();
    };
  }, [credentials]);

  const startTracking = async () => {
    const video = videoRef.current;
    if (video === null || camera === "starting" || camera === "tracking") {
      return;
    }
    setCamera("starting");
    setErrorMessage(null);
    setDiagnostics(null);
    const controller = new CameraPoseController({
      video,
      initialPoseLimit: poseLimitRef.current,
      onPacket: (nextPacket) => {
        setPacket(nextPacket);
        if (peerStateRef.current === "connected") {
          sender.current?.push(nextPacket);
        }
      },
      onDiagnostics: setDiagnostics,
      onError: (message) => {
        setErrorMessage(message);
        setCamera("error");
        setDiagnostics(null);
      },
    });
    cameraController.current = controller;
    try {
      await controller.start();
      if (cameraController.current === controller) {
        setCamera("tracking");
      }
    } catch (error) {
      if (cameraController.current === controller) {
        cameraController.current = null;
        setCamera("error");
        setErrorMessage(error instanceof Error ? error.message : "Body tracking could not start.");
      }
    }
  };

  const stopTracking = () => {
    cameraController.current?.stop();
    cameraController.current = null;
    setPacket(null);
    setDiagnostics(null);
    setCamera("idle");
    setErrorMessage(null);
  };

  const peerTone =
    connection === "connected" ? "active" : connection === "error" ? "danger" : "neutral";

  return (
    <main class="phone-page">
      <header class="app-header">
        <a class="brand" href={roleUrl(null)} aria-label="Jojixplay home">
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

        <div class={`camera-stage camera-stage--${camera}`}>
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
              <span>Place the phone near the TV in landscape if possible.</span>
            </div>
          ) : null}
          <div class="camera-badge">
            {camera === "tracking"
              ? packet === null
                ? "Scanning…"
                : `${packet.poses.length} of ${poseLimit} ${poseLimit === 1 ? "player" : "players"} visible`
              : "Camera off"}
          </div>
        </div>

        {errorMessage !== null ? (
          <p class="inline-error" role="alert">
            {errorMessage}
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
            <button class="button button--danger" type="button" onClick={stopTracking}>
              Stop tracking
            </button>
          ) : (
            <button
              class="button button--primary"
              type="button"
              onClick={() => void startTracking()}
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

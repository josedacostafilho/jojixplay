import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { SkeletonCanvas } from "../components/skeleton-canvas";
import { StatusPill } from "../components/status-pill";
import { roleUrl, UnsupportedPanel } from "../components/unsupported-panel";
import type { PosePacket } from "../domain/pose";
import { inspectPhoneCapabilities } from "../platform/capabilities";
import { CameraPoseController } from "../pose/camera-pose-controller";
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
  const capabilities = useMemo(inspectPhoneCapabilities, []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraController = useRef<CameraPoseController | null>(null);
  const peerRoom = useRef<PosePeerRoom | null>(null);
  const sender = useRef<LatestOnlySender<PosePacket> | null>(null);
  const peerStateRef = useRef<PeerConnectionState>("connecting");
  const [connection, setConnection] = useState<PeerConnectionState>("connecting");
  const [camera, setCamera] = useState<CameraState>("idle");
  const [packet, setPacket] = useState<PosePacket | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (window.location.hash === "") {
      return;
    }
    const scrubbedUrl = new URL(window.location.href);
    scrubbedUrl.hash = "";
    window.history.replaceState(null, "", scrubbedUrl);
  }, []);

  useEffect(() => {
    if (!capabilities.supported) {
      return;
    }
    let pairingTimeoutId: number | null = null;
    const clearPairingTimeout = () => {
      if (pairingTimeoutId !== null) {
        window.clearTimeout(pairingTimeoutId);
        pairingTimeoutId = null;
      }
    };
    const stopCameraAfterPeerFailure = () => {
      cameraController.current?.stop();
      cameraController.current = null;
      setPacket(null);
      setCamera("idle");
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
          if (state === "error") {
            stopCameraAfterPeerFailure();
          }
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
      stopCameraAfterPeerFailure();
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
  }, [capabilities.supported, credentials]);

  if (!capabilities.supported) {
    return <UnsupportedPanel device="phone" missing={capabilities.missing} />;
  }

  const startTracking = async () => {
    const video = videoRef.current;
    if (video === null || camera === "starting" || camera === "tracking") {
      return;
    }
    setCamera("starting");
    setErrorMessage(null);
    const controller = new CameraPoseController({
      video,
      onPacket: (nextPacket) => {
        setPacket(nextPacket);
        if (peerStateRef.current === "connected") {
          sender.current?.push(nextPacket);
        }
      },
      onError: (message) => {
        setErrorMessage(message);
        setCamera("error");
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
          <SkeletonCanvas
            packet={camera === "tracking" ? packet : null}
            label="Your locally detected body skeleton"
            className="skeleton-canvas skeleton-canvas--camera"
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
                : `${packet.poses.length} visible`
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
            The TV could not be reached. Return to the TV, create a new session, and scan its new QR
            code.
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

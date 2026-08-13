import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { type PoseLimit, MAX_POSE_LIMIT } from "../domain/pose-limit";
import {
  type PoseControlAction,
  PoseControlSession,
  type PoseControlSnapshot,
  type PoseControlUpdate,
} from "../interaction/pose-controls";
import type { Size } from "../render/geometry";
import { type CircleBurst, SKELETON_PALETTE } from "../render/skeleton";
import { SkeletonCanvas } from "./skeleton-canvas";

interface TvPlayfieldProps {
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  poseLimitPending: boolean;
  onPoseLimitRequest: (poseLimit: PoseLimit) => Promise<void>;
}

type BackgroundTheme = "navy" | "plum";

const EMPTY_SNAPSHOT: PoseControlSnapshot = {
  phase: "no-pose",
  visiblePeople: 0,
  requiresBothHands: false,
  claimProgress: 0,
  targets: [],
  pointer: null,
  hoveredAction: null,
  dwellProgress: 0,
  controllerPoseIndex: null,
};

function sameSnapshot(left: PoseControlSnapshot, right: PoseControlSnapshot): boolean {
  return (
    left.phase === right.phase &&
    left.visiblePeople === right.visiblePeople &&
    left.requiresBothHands === right.requiresBothHands &&
    Math.abs(left.claimProgress - right.claimProgress) < 0.01 &&
    (left.targets === right.targets || (left.targets.length === 0 && right.targets.length === 0)) &&
    left.pointer?.x === right.pointer?.x &&
    left.pointer?.y === right.pointer?.y &&
    left.hoveredAction === right.hoveredAction &&
    Math.abs(left.dwellProgress - right.dwellProgress) < 0.01 &&
    left.controllerPoseIndex === right.controllerPoseIndex
  );
}

function controlInstruction(snapshot: PoseControlSnapshot): string {
  switch (snapshot.phase) {
    case "no-pose":
      return "Step back until your full body is visible";
    case "ready":
      return snapshot.requiresBothHands
        ? "One person: raise both hands to take control"
        : "Raise either hand to take control";
    case "claiming":
      return snapshot.requiresBothHands ? "Keep both hands raised" : "Keep your hand raised";
    case "active":
      return "Move your hand onto a button and hold";
  }
}

function createCircleBurst(nowMs: number, frame: Size): CircleBurst {
  const minimumFrameDimension = Math.min(frame.width, frame.height);
  return {
    createdAtMs: nowMs,
    frame: { ...frame },
    circles: Array.from({ length: 12 }, (_, index) => {
      const radius = 0.025 + Math.random() * 0.055;
      const horizontalRadius = (radius * minimumFrameDimension) / frame.width;
      const verticalRadius = (radius * minimumFrameDimension) / frame.height;
      return {
        x: horizontalRadius + Math.random() * (1 - horizontalRadius * 2),
        y: verticalRadius + Math.random() * (1 - verticalRadius * 2),
        radius,
        colorIndex: (index % 2) as 0 | 1,
      };
    }),
  };
}

export function TvPlayfield({
  packet,
  poseLimit,
  poseLimitPending,
  onPoseLimitRequest,
}: TvPlayfieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlSessionRef = useRef<PoseControlSession | null>(null);
  const latestFrameRef = useRef<Size | null>(null);
  const playerModeRequestActiveRef = useRef(false);
  controlSessionRef.current ??= new PoseControlSession();
  if (packet !== null) {
    latestFrameRef.current = packet.frame;
  }
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [snapshot, setSnapshot] = useState<PoseControlSnapshot>(EMPTY_SNAPSHOT);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("navy");
  const [circleBurst, setCircleBurst] = useState<CircleBurst | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const palette = SKELETON_PALETTE;

  const activateAction = useCallback(
    (action: PoseControlAction) => {
      if (poseLimitPending || playerModeRequestActiveRef.current) {
        return;
      }
      switch (action) {
        case "background":
          setBackgroundTheme((current) => (current === "navy" ? "plum" : "navy"));
          setAnnouncement("Background theme changed.");
          break;
        case "players": {
          const nextPoseLimit: PoseLimit = poseLimit === 1 ? MAX_POSE_LIMIT : 1;
          playerModeRequestActiveRef.current = true;
          setAnnouncement(`Switching to ${nextPoseLimit}-player mode.`);
          void onPoseLimitRequest(nextPoseLimit)
            .then(() => setAnnouncement(`${nextPoseLimit}-player mode is active.`))
            .catch(() => {
              setAnnouncement(
                `Player mode could not be changed. ${poseLimit}-player mode remains active. Check the phone and restart body tracking if needed.`,
              );
            })
            .finally(() => {
              playerModeRequestActiveRef.current = false;
            });
          break;
        }
        case "circles":
          if (latestFrameRef.current !== null) {
            setCircleBurst(createCircleBurst(performance.now(), latestFrameRef.current));
            setAnnouncement("Circle burst created.");
          }
          break;
      }
    },
    [onPoseLimitRequest, poseLimit, poseLimitPending],
  );

  const applyUpdate = useCallback(
    (update: PoseControlUpdate) => {
      setSnapshot((current) =>
        sameSnapshot(current, update.snapshot) ? current : update.snapshot,
      );
      if (update.activated !== null && !poseLimitPending) {
        activateAction(update.activated);
      }
    },
    [activateAction, poseLimitPending],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return;
      }
      setSize({
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) {
      return;
    }
    const session = controlSessionRef.current;
    if (session !== null) {
      applyUpdate(session.updatePacket(packet, performance.now(), size));
    }
  }, [packet, size, applyUpdate]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const session = controlSessionRef.current;
      if (session !== null) {
        applyUpdate(session.tick(performance.now()));
      }
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [applyUpdate]);

  useEffect(() => {
    if (announcement === "" || announcement.startsWith("Switching")) {
      return;
    }
    const timeoutId = window.setTimeout(() => setAnnouncement(""), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [announcement]);

  const pointerColor = palette[snapshot.controllerPoseIndex ?? 0] ?? palette[0];
  const instruction = controlInstruction(snapshot);

  return (
    <div
      ref={containerRef}
      class={`tv-playfield tv-playfield--${backgroundTheme}`}
      data-background-theme={backgroundTheme}
    >
      <SkeletonCanvas
        packet={packet}
        label="Mirrored live body skeleton from the paired phone"
        className="skeleton-canvas skeleton-canvas--tv"
        mirrored
        palette={palette}
        circleBurst={circleBurst}
      />

      {packet !== null ? (
        <p class={`pose-control-hint pose-control-hint--${snapshot.phase}`} aria-live="polite">
          {instruction}
          {snapshot.phase === "claiming" ? (
            <span class="pose-control-hint__progress" aria-hidden="true">
              <span style={`width: ${Math.round(snapshot.claimProgress * 100)}%`} />
            </span>
          ) : null}
        </p>
      ) : null}

      {packet !== null && snapshot.phase === "active" ? (
        <fieldset class="pose-control-targets">
          <legend class="visually-hidden">Body-controlled actions</legend>
          {snapshot.targets.map((target) => {
            const hovered = snapshot.hoveredAction === target.action;
            const dwellProgress = hovered ? snapshot.dwellProgress : 0;
            const label = target.action === "players" ? `Players: ${poseLimit}` : target.label;
            const accessibleLabel =
              target.action === "players"
                ? `Switch to ${poseLimit === 1 ? 2 : 1}-player mode`
                : target.label;
            return (
              <button
                key={target.action}
                class={`pose-control-button${hovered ? " pose-control-button--hovered" : ""}`}
                type="button"
                aria-label={accessibleLabel}
                onClick={() => activateAction(target.action)}
                disabled={poseLimitPending}
                style={`left: ${target.rect.x}px; top: ${target.rect.y}px; width: ${target.rect.width}px; height: ${target.rect.height}px`}
              >
                <span>{label}</span>
                <span
                  class="pose-control-button__progress"
                  aria-hidden="true"
                  style={`width: ${Math.round(dwellProgress * 100)}%`}
                />
              </button>
            );
          })}
        </fieldset>
      ) : null}

      {packet !== null && snapshot.pointer !== null ? (
        <span
          class="pose-cursor"
          aria-hidden="true"
          style={`left: ${snapshot.pointer.x}px; top: ${snapshot.pointer.y}px; --pose-cursor-color: ${pointerColor}`}
        />
      ) : null}

      {announcement === "" ? null : (
        <p class="pose-action-status" role="status">
          {announcement}
        </p>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import {
  type PoseControlAction,
  PoseControlSession,
  type PoseControlSnapshot,
  type PoseControlUpdate,
} from "../interaction/pose-controls";
import type { Size } from "../render/geometry";
import { type CircleBurst, type SkeletonPalette, SKELETON_PALETTES } from "../render/skeleton";
import { SkeletonCanvas } from "./skeleton-canvas";

interface TvPlayfieldProps {
  packet: PosePacket | null;
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

export function TvPlayfield({ packet }: TvPlayfieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlSessionRef = useRef<PoseControlSession | null>(null);
  const latestFrameRef = useRef<Size | null>(null);
  controlSessionRef.current ??= new PoseControlSession();
  if (packet !== null) {
    latestFrameRef.current = packet.frame;
  }
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [snapshot, setSnapshot] = useState<PoseControlSnapshot>(EMPTY_SNAPSHOT);
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("navy");
  const [paletteIndex, setPaletteIndex] = useState<0 | 1>(0);
  const [circleBurst, setCircleBurst] = useState<CircleBurst | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const palette: SkeletonPalette = SKELETON_PALETTES[paletteIndex];

  const activateAction = useCallback((action: PoseControlAction) => {
    switch (action) {
      case "background":
        setBackgroundTheme((current) => (current === "navy" ? "plum" : "navy"));
        setAnnouncement("Background theme changed.");
        break;
      case "skeleton":
        setPaletteIndex((current) => (current === 0 ? 1 : 0));
        setAnnouncement("Skeleton colors changed.");
        break;
      case "circles":
        if (latestFrameRef.current !== null) {
          setCircleBurst(createCircleBurst(performance.now(), latestFrameRef.current));
          setAnnouncement("Circle burst created.");
        }
        break;
    }
  }, []);

  const applyUpdate = useCallback(
    (update: PoseControlUpdate) => {
      setSnapshot((current) =>
        sameSnapshot(current, update.snapshot) ? current : update.snapshot,
      );
      if (update.activated !== null) {
        activateAction(update.activated);
      }
    },
    [activateAction],
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
            return (
              <button
                key={target.action}
                class={`pose-control-button${hovered ? " pose-control-button--hovered" : ""}`}
                type="button"
                onClick={() => activateAction(target.action)}
                style={`left: ${target.rect.x}px; top: ${target.rect.y}px; width: ${target.rect.width}px; height: ${target.rect.height}px`}
              >
                <span>{target.label}</span>
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

      <span class="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}

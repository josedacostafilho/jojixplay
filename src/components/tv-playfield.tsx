import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { PosePacket } from "../domain/pose";
import { type PoseLimit, MAX_POSE_LIMIT } from "../domain/pose-limit";
import { DrawCanvas } from "../games/draw/draw-canvas";
import {
  DRAW_ERASER_WIDTH,
  DrawSession,
  type DrawSnapshot,
  type DrawTool,
  type DrawToolSnapshot,
} from "../games/draw/draw-session";
import {
  type PoseControlActionDefinition,
  PoseControlSession,
  type PoseControlSnapshot,
  type PoseControlUpdate,
} from "../interaction/pose-controls";
import {
  createPoseProjection,
  type Point,
  projectedFrameBounds,
  projectNormalizedPoint,
  type Rectangle,
  type Size,
} from "../render/geometry";
import { SKELETON_PALETTE } from "../render/skeleton";
import { SkeletonCanvas } from "./skeleton-canvas";

interface TvPlayfieldProps {
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  poseLimitPending: boolean;
  onPoseLimitRequest: (poseLimit: PoseLimit) => Promise<void>;
}

type BackgroundTheme = "navy" | "plum";
type PlayfieldView = "main" | "games" | "draw";
type PlayfieldAction =
  | "background"
  | "players"
  | "open-games"
  | "open-draw"
  | "return-main"
  | "draw-color"
  | "draw-clear"
  | "draw-exit";

const MAIN_ACTIONS = [
  { action: "background", label: "Background" },
  { action: "players", label: "Players" },
  { action: "open-games", label: "Games" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const GAMES_ACTIONS = [
  { action: "open-draw", label: "Draw" },
  { action: "return-main", label: "Return" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const DRAW_ACTIONS = [
  { action: "draw-color", label: "Color" },
  { action: "draw-clear", label: "Clear", dwellMs: 1_500 },
  { action: "draw-exit", label: "Exit" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const EMPTY_SNAPSHOT: PoseControlSnapshot<PlayfieldAction> = {
  phase: "no-pose",
  visiblePeople: 0,
  requiresBothHands: false,
  claimProgress: 0,
  targets: [],
  pointer: null,
  hands: null,
  controlsArmed: false,
  hoveredAction: null,
  dwellProgress: 0,
  controllerPoseIndex: null,
};

function actionsForView(
  view: PlayfieldView,
): readonly PoseControlActionDefinition<PlayfieldAction>[] {
  switch (view) {
    case "main":
      return MAIN_ACTIONS;
    case "games":
      return GAMES_ACTIONS;
    case "draw":
      return DRAW_ACTIONS;
  }
}

function viewLabel(view: PlayfieldView): string {
  switch (view) {
    case "main":
      return "Main Menu";
    case "games":
      return "Games";
    case "draw":
      return "Draw";
  }
}

function samePoint(left: Point | null, right: Point | null): boolean {
  return left?.x === right?.x && left?.y === right?.y;
}

function sameSnapshot(
  left: PoseControlSnapshot<PlayfieldAction>,
  right: PoseControlSnapshot<PlayfieldAction>,
): boolean {
  return (
    left.phase === right.phase &&
    left.visiblePeople === right.visiblePeople &&
    left.requiresBothHands === right.requiresBothHands &&
    Math.abs(left.claimProgress - right.claimProgress) < 0.01 &&
    (left.targets === right.targets || (left.targets.length === 0 && right.targets.length === 0)) &&
    samePoint(left.pointer, right.pointer) &&
    left.hands?.selected === right.hands?.selected &&
    samePoint(left.hands?.left ?? null, right.hands?.left ?? null) &&
    samePoint(left.hands?.right ?? null, right.hands?.right ?? null) &&
    left.controlsArmed === right.controlsArmed &&
    left.hoveredAction === right.hoveredAction &&
    Math.abs(left.dwellProgress - right.dwellProgress) < 0.01 &&
    left.controllerPoseIndex === right.controllerPoseIndex
  );
}

function sameDrawTool(left: DrawToolSnapshot, right: DrawToolSnapshot): boolean {
  return (
    left.phase === right.phase &&
    samePoint(left.point, right.point) &&
    Math.abs(left.dwellProgress - right.dwellProgress) < 0.01
  );
}

function sameDrawing(left: DrawSnapshot, right: DrawSnapshot): boolean {
  return (
    left.colorIndex === right.colorIndex &&
    left.generation === right.generation &&
    left.revision === right.revision &&
    left.activeTool === right.activeTool &&
    sameDrawTool(left.brush, right.brush) &&
    sameDrawTool(left.eraser, right.eraser)
  );
}

function drawInstruction(drawing: DrawSnapshot): string {
  const progressingTool: DrawTool | null =
    drawing.brush.phase === "arming" || drawing.brush.phase === "lifting"
      ? "brush"
      : drawing.eraser.phase === "arming" || drawing.eraser.phase === "lifting"
        ? "eraser"
        : null;
  if (progressingTool !== null) {
    const phase = progressingTool === "brush" ? drawing.brush.phase : drawing.eraser.phase;
    return phase === "lifting"
      ? `Keep your ${progressingTool} hand still to lift`
      : `Keep your ${progressingTool} hand still to engage`;
  }
  if (drawing.activeTool !== null) {
    return `Move to ${drawing.activeTool === "brush" ? "draw" : "erase"}, then hold still to lift`;
  }
  return "Hold either hand still on the white board to draw or erase";
}

function controlInstruction(
  snapshot: PoseControlSnapshot<PlayfieldAction>,
  drawing: DrawSnapshot,
  view: PlayfieldView,
): string {
  switch (snapshot.phase) {
    case "no-pose":
      return "Step back until your full body is visible";
    case "needs-headroom":
      return "Step back and leave clear space above your head";
    case "ready":
      return snapshot.requiresBothHands
        ? "One person: raise both hands and keep one whole hand visible"
        : "Raise either hand and keep your whole hand visible";
    case "claiming":
      return snapshot.requiresBothHands ? "Keep both hands raised" : "Keep your hand raised";
    case "active":
      if (snapshot.pointer === null) {
        return "Keep your whole controlling hand visible";
      }
      if (!snapshot.controlsArmed) {
        return view === "draw"
          ? "Move your brush hand clear of the toolbar to arm it"
          : "Move your hand clear of the buttons to arm them";
      }
      return view === "draw" ? drawInstruction(drawing) : "Move your hand onto a button and hold";
  }
}

function accessibleActionLabel(
  action: PlayfieldAction,
  poseLimit: PoseLimit,
  drawing: DrawSnapshot,
): string {
  switch (action) {
    case "players":
      return `Switch to ${poseLimit === 1 ? 2 : 1}-player mode`;
    case "draw-color":
      return `Change drawing color; current color ${drawing.color}`;
    case "background":
      return "Background";
    case "open-games":
      return "Games";
    case "open-draw":
      return "Draw";
    case "return-main":
      return "Return to Main Menu";
    case "draw-clear":
      return "Clear drawing";
    case "draw-exit":
      return "Exit Draw";
  }
}

function actionLabel(action: PlayfieldAction, fallback: string, poseLimit: PoseLimit): string {
  return action === "players" ? `Players: ${poseLimit}` : fallback;
}

function toolScreenPoint(point: Point | null, frame: Size | null, viewport: Size): Point | null {
  if (point === null || frame === null || viewport.width === 0 || viewport.height === 0) {
    return null;
  }
  return projectNormalizedPoint(
    point.x,
    point.y,
    createPoseProjection(frame.width, frame.height, viewport.width, viewport.height, true),
  );
}

export function TvPlayfield({
  packet,
  poseLimit,
  poseLimitPending,
  onPoseLimitRequest,
}: TvPlayfieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlSession] = useState(() => new PoseControlSession<PlayfieldAction>(MAIN_ACTIONS));
  const [drawSession] = useState(() => new DrawSession());
  const latestFrameRef = useRef<Size | null>(null);
  const viewportRef = useRef<Size>({ width: 0, height: 0 });
  const viewRef = useRef<PlayfieldView>("main");
  const playerModeRequestActiveRef = useRef(false);
  const activateActionRef = useRef<(action: PlayfieldAction) => void>(() => undefined);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<PlayfieldView>("main");
  const [snapshot, setSnapshot] = useState<PoseControlSnapshot<PlayfieldAction>>(EMPTY_SNAPSHOT);
  const [drawing, setDrawing] = useState<DrawSnapshot>(() => drawSession.tick(0));
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("navy");
  const [announcement, setAnnouncement] = useState("");
  const palette = SKELETON_PALETTE;

  if (packet !== null) {
    latestFrameRef.current = packet.frame;
  }

  const applyDrawing = useCallback((next: DrawSnapshot) => {
    setDrawing((current) => (sameDrawing(current, next) ? current : next));
  }, []);

  const transitionTo = useCallback(
    (nextView: PlayfieldView) => {
      const nowMs = performance.now();
      viewRef.current = nextView;
      setView(nextView);
      const controlUpdate = controlSession.setActions(actionsForView(nextView), nowMs);
      setSnapshot(controlUpdate.snapshot);
      applyDrawing(drawSession.setEnabled(nextView === "draw", nowMs));
    },
    [applyDrawing, controlSession, drawSession],
  );

  const activateAction = useCallback(
    (action: PlayfieldAction) => {
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
        case "open-games":
          transitionTo("games");
          break;
        case "open-draw":
          transitionTo("draw");
          break;
        case "return-main":
          transitionTo("main");
          break;
        case "draw-color":
          applyDrawing(drawSession.cycleColor(performance.now()));
          setAnnouncement("Drawing color changed.");
          break;
        case "draw-clear":
          applyDrawing(drawSession.clear(performance.now()));
          setAnnouncement("Drawing cleared.");
          break;
        case "draw-exit":
          transitionTo("games");
          break;
      }
    },
    [applyDrawing, drawSession, onPoseLimitRequest, poseLimit, poseLimitPending, transitionTo],
  );
  activateActionRef.current = activateAction;

  const applyPoseUpdate = useCallback(
    (update: PoseControlUpdate<PlayfieldAction>, nowMs: number, freshFrame: Size | null) => {
      setSnapshot((current) =>
        sameSnapshot(current, update.snapshot) ? current : update.snapshot,
      );
      if (viewRef.current === "draw") {
        const frame = freshFrame ?? latestFrameRef.current;
        const viewport = viewportRef.current;
        if (freshFrame !== null && frame !== null && viewport.width > 0 && viewport.height > 0) {
          applyDrawing(
            drawSession.update({
              hands: update.snapshot.hands,
              frame,
              viewport,
              targets: update.snapshot.targets,
              nowMs,
            }),
          );
        } else {
          applyDrawing(drawSession.tick(nowMs));
        }
      }
      if (update.activated !== null && !poseLimitPending) {
        activateActionRef.current(update.activated);
      }
    },
    [applyDrawing, drawSession, poseLimitPending],
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
      const nextSize = {
        width: Math.max(1, Math.round(entry.contentRect.width)),
        height: Math.max(1, Math.round(entry.contentRect.height)),
      };
      viewportRef.current = nextSize;
      setSize(nextSize);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (size.width === 0 || size.height === 0) {
      return;
    }
    const nowMs = performance.now();
    applyPoseUpdate(controlSession.updatePacket(packet, nowMs, size), nowMs, packet?.frame ?? null);
  }, [packet, size, applyPoseUpdate, controlSession]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nowMs = performance.now();
      applyPoseUpdate(controlSession.tick(nowMs), nowMs, null);
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [applyPoseUpdate, controlSession]);

  useEffect(() => {
    if (announcement === "" || announcement.startsWith("Switching")) {
      return;
    }
    const timeoutId = window.setTimeout(() => setAnnouncement(""), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [announcement]);

  const pointerColor = palette[snapshot.controllerPoseIndex ?? 0] ?? palette[0];
  const instruction = controlInstruction(snapshot, drawing, view);
  const frame = latestFrameRef.current;
  const projection =
    frame === null || size.width === 0 || size.height === 0
      ? null
      : createPoseProjection(frame.width, frame.height, size.width, size.height, true);
  const drawBounds: Rectangle | null =
    projection === null ? null : projectedFrameBounds(projection);
  const brushPoint = toolScreenPoint(drawing.brush.point, frame, size);
  const eraserPoint = toolScreenPoint(drawing.eraser.point, frame, size);
  const eraserDiameter =
    drawBounds === null ? 0 : Math.min(drawBounds.width, drawBounds.height) * DRAW_ERASER_WIDTH;

  return (
    <div
      ref={containerRef}
      class={`tv-playfield tv-playfield--${backgroundTheme}${view === "draw" ? " tv-playfield--draw" : ""}`}
      data-background-theme={backgroundTheme}
      data-playfield-view={view}
    >
      {view === "draw" && drawBounds !== null ? (
        <div
          class="draw-board"
          data-testid="draw-board"
          style={`left: ${drawBounds.x}px; top: ${drawBounds.y}px; width: ${drawBounds.width}px; height: ${drawBounds.height}px`}
        >
          <DrawCanvas drawing={drawing} />
        </div>
      ) : null}

      <SkeletonCanvas
        packet={packet}
        label="Mirrored live body skeleton from the paired phone"
        className="skeleton-canvas skeleton-canvas--tv"
        mirrored
        palette={palette}
        opacity={view === "draw" ? 0.28 : 1}
      />

      <div class="playfield-view-label" aria-live="polite">
        <span>{viewLabel(view)}</span>
        {view === "draw" ? (
          <>
            <span
              class="playfield-view-label__swatch"
              style={`--draw-color: ${drawing.color}`}
              aria-hidden="true"
            />
            <span class="visually-hidden">Current drawing color {drawing.color}</span>
          </>
        ) : null}
      </div>

      {packet !== null && announcement === "" ? (
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
          <legend class="visually-hidden">{viewLabel(view)} body-controlled actions</legend>
          {snapshot.targets.map((target) => {
            const hovered = snapshot.hoveredAction === target.action;
            const dwellProgress = hovered ? snapshot.dwellProgress : 0;
            return (
              <button
                key={target.action}
                class={`pose-control-button${hovered ? " pose-control-button--hovered" : ""}`}
                type="button"
                aria-label={accessibleActionLabel(target.action, poseLimit, drawing)}
                onClick={() => activateAction(target.action)}
                disabled={poseLimitPending}
                style={`left: ${target.rect.x}px; top: ${target.rect.y}px; width: ${target.rect.width}px; height: ${target.rect.height}px`}
              >
                <span class="pose-control-button__label">
                  {actionLabel(target.action, target.label, poseLimit)}
                  {target.action === "draw-color" ? (
                    <span
                      class="pose-control-button__swatch"
                      style={`--draw-color: ${drawing.color}`}
                      aria-hidden="true"
                    />
                  ) : null}
                </span>
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

      {view !== "draw" && packet !== null && snapshot.pointer !== null ? (
        <span
          class="pose-cursor"
          aria-hidden="true"
          style={`left: ${snapshot.pointer.x}px; top: ${snapshot.pointer.y}px; --pose-cursor-color: ${pointerColor}`}
        />
      ) : null}

      {view === "draw" && brushPoint !== null ? (
        <span
          class={`draw-tool-cursor draw-tool-cursor--brush draw-tool-cursor--${drawing.brush.phase}`}
          aria-hidden="true"
          style={`left: ${brushPoint.x}px; top: ${brushPoint.y}px; --draw-tool-color: ${drawing.color}; --draw-tool-progress: ${Math.round(drawing.brush.dwellProgress * 360)}deg`}
        />
      ) : null}
      {view === "draw" && eraserPoint !== null ? (
        <span
          class={`draw-tool-cursor draw-tool-cursor--eraser draw-tool-cursor--${drawing.eraser.phase}`}
          aria-hidden="true"
          style={`left: ${eraserPoint.x}px; top: ${eraserPoint.y}px; width: ${eraserDiameter}px; height: ${eraserDiameter}px; --draw-tool-progress: ${Math.round(drawing.eraser.dwellProgress * 360)}deg`}
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

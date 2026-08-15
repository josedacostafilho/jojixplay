import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { CameraFrame, CameraLayout } from "../domain/camera";
import type { PosePacket } from "../domain/pose";
import { type PoseLimit, MAX_POSE_LIMIT } from "../domain/pose-limit";
import { type GameId, gameSupportsCameraLayout, requiredCameraLayout } from "../games/catalog";
import { BubblesCanvas } from "../games/bubbles/bubbles-canvas";
import {
  bubblesPlayersFromPosePacket,
  type BubblesResult,
  BubblesSession,
  type BubblesSnapshot,
} from "../games/bubbles/bubbles-session";
import { DrawCanvas } from "../games/draw/draw-canvas";
import { DRAW_ERASER_WIDTH, DrawSession, type DrawSnapshot } from "../games/draw/draw-session";
import {
  type PoseControlActionDefinition,
  type PoseControlPlacement,
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
import { AVATAR_ACCENT_PALETTE } from "../render/avatar";
import { AvatarCanvas } from "./avatar-canvas";

interface TvPlayfieldProps {
  packet: PosePacket | null;
  poseLimit: PoseLimit;
  poseLimitPending: boolean;
  cameraLayoutPending: boolean;
  onPoseLimitRequest: (poseLimit: PoseLimit) => Promise<void>;
  onCameraLayoutRequest: (layout: CameraLayout) => Promise<void>;
}

type BackgroundTheme = "navy" | "plum";
type PlayfieldView = "main" | "games" | "draw" | "bubbles";
type PlayfieldAction =
  | "background"
  | "players"
  | "open-games"
  | "open-draw"
  | "open-bubbles"
  | "return-main"
  | "draw-tool"
  | "draw-color"
  | "draw-clear"
  | "draw-exit"
  | "bubbles-start"
  | "bubbles-restart"
  | "bubbles-exit";

const MAIN_ACTIONS = [
  { action: "background", label: "Background" },
  { action: "players", label: "Players" },
  { action: "open-games", label: "Games" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const GAMES_ACTIONS = [
  { action: "open-draw", label: "Draw" },
  { action: "open-bubbles", label: "Bubbles" },
  { action: "return-main", label: "Return" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const DRAW_ACTIONS = [
  { action: "draw-tool", label: "Pencil" },
  { action: "draw-color", label: "Color" },
  { action: "draw-clear", label: "Clear", dwellMs: 1_500 },
  { action: "draw-exit", label: "Exit" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const BUBBLES_READY_ACTIONS = [
  { action: "bubbles-start", label: "Start" },
  { action: "bubbles-exit", label: "Exit" },
] as const satisfies readonly PoseControlActionDefinition<PlayfieldAction>[];

const BUBBLES_RESULT_ACTIONS = [
  { action: "bubbles-restart", label: "Play Again" },
  { action: "bubbles-exit", label: "Exit" },
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

interface ViewControls {
  actions: readonly PoseControlActionDefinition<PlayfieldAction>[];
  placement: PoseControlPlacement;
}

interface OrientationGate {
  game: GameId;
  view: "draw" | "bubbles";
  requiredLayout: CameraLayout;
}

function controlsForView(view: PlayfieldView, layout: CameraLayout | null): ViewControls {
  switch (view) {
    case "main":
      return {
        actions: MAIN_ACTIONS,
        placement: layout === "landscape" ? "left-column" : "overhead-row",
      };
    case "games":
      return {
        actions: GAMES_ACTIONS,
        placement: layout === "landscape" ? "left-column" : "overhead-row",
      };
    case "draw":
      return { actions: DRAW_ACTIONS, placement: "left-column" };
    case "bubbles":
      return { actions: BUBBLES_READY_ACTIONS, placement: "left-column" };
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
    case "bubbles":
      return "Bubbles";
  }
}

function formatBubblesTime(remainingMs: number): string {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function bubblesResultMessage(result: BubblesResult | null): string {
  if (result === null) {
    return "Round complete.";
  }
  if (result.type === "score") {
    return `Final score: ${result.score}.`;
  }
  if (result.winner === "tie") {
    return `Tie game: ${result.leftScore} to ${result.rightScore}.`;
  }
  const winner = result.winner === "left" ? "Left" : "Right";
  return `${winner} player wins — Left ${result.leftScore}, Right ${result.rightScore}.`;
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
    left.hands?.shoulderSpan === right.hands?.shoulderSpan &&
    left.controlsArmed === right.controlsArmed &&
    left.hoveredAction === right.hoveredAction &&
    Math.abs(left.dwellProgress - right.dwellProgress) < 0.01 &&
    left.controllerPoseIndex === right.controllerPoseIndex
  );
}

function sameDrawing(left: DrawSnapshot, right: DrawSnapshot): boolean {
  return (
    left.colorIndex === right.colorIndex &&
    left.selectedTool === right.selectedTool &&
    left.gripActive === right.gripActive &&
    left.generation === right.generation &&
    left.revision === right.revision &&
    left.cursor.phase === right.cursor.phase &&
    samePoint(left.cursor.point, right.cursor.point)
  );
}

function drawInstruction(drawing: DrawSnapshot): string {
  const tool = drawing.selectedTool === "pencil" ? "pencil" : "eraser";
  if (drawing.gripActive) {
    return `${tool === "pencil" ? "Pencil" : "Eraser"} active — spread both hands wide to stop`;
  }
  return `Bring both hands together to start the ${tool}`;
}

function controlInstruction(
  snapshot: PoseControlSnapshot<PlayfieldAction>,
  drawing: DrawSnapshot,
  bubbles: BubblesSnapshot,
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
          ? "Move your drawing hand clear of the toolbar to arm it"
          : "Move your hand clear of the buttons to arm them";
      }
      if (view === "draw") {
        return drawInstruction(drawing);
      }
      if (view === "bubbles" && !bubbles.readyToStart) {
        return bubbles.playerCount === 1
          ? "Waiting for one visible player"
          : `Waiting for two visible players — ${bubbles.visiblePlayers} visible`;
      }
      return "Move your hand onto a button and hold";
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
    case "draw-tool":
      return `Switch to ${drawing.selectedTool === "pencil" ? "Eraser" : "Pencil"}; current tool ${drawing.selectedTool === "pencil" ? "Pencil" : "Eraser"}`;
    case "background":
      return "Background";
    case "open-games":
      return "Games";
    case "open-draw":
      return "Draw";
    case "open-bubbles":
      return "Bubbles";
    case "return-main":
      return "Return to Main Menu";
    case "draw-clear":
      return "Clear drawing";
    case "draw-exit":
      return "Exit Draw";
    case "bubbles-start":
      return "Start Bubbles";
    case "bubbles-restart":
      return "Play Bubbles again";
    case "bubbles-exit":
      return "Exit Bubbles";
  }
}

function actionLabel(
  action: PlayfieldAction,
  fallback: string,
  poseLimit: PoseLimit,
  drawing: DrawSnapshot,
): string {
  if (action === "players") {
    return `Players: ${poseLimit}`;
  }
  if (action === "draw-tool") {
    return drawing.selectedTool === "pencil" ? "Pencil" : "Eraser";
  }
  return fallback;
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
  cameraLayoutPending,
  onPoseLimitRequest,
  onCameraLayoutRequest,
}: TvPlayfieldProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlSession] = useState(
    () => new PoseControlSession<PlayfieldAction>(MAIN_ACTIONS, "overhead-row"),
  );
  const [drawSession] = useState(() => new DrawSession());
  const [bubblesSession] = useState(() => new BubblesSession());
  const latestFrameRef = useRef<CameraFrame | null>(null);
  const latestPacketRef = useRef<PosePacket | null>(packet);
  const viewportRef = useRef<Size>({ width: 0, height: 0 });
  const viewRef = useRef<PlayfieldView>("main");
  const bubblesPlayerCountRef = useRef<PoseLimit>(poseLimit);
  const playerModeRequestActiveRef = useRef(false);
  const orientationReturnRequestActiveRef = useRef(false);
  const orientationMismatchRef = useRef(false);
  const activeGameLayoutRef = useRef<CameraLayout | null>(null);
  const drawLayoutRef = useRef<CameraLayout | null>(null);
  const activateActionRef = useRef<(action: PlayfieldAction) => void>(() => undefined);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [view, setView] = useState<PlayfieldView>("main");
  const [controlPlacement, setControlPlacement] = useState<PoseControlPlacement>("overhead-row");
  const [activeGameLayout, setActiveGameLayout] = useState<CameraLayout | null>(null);
  const [orientationGate, setOrientationGate] = useState<OrientationGate | null>(null);
  const [snapshot, setSnapshot] = useState<PoseControlSnapshot<PlayfieldAction>>(EMPTY_SNAPSHOT);
  const [drawing, setDrawing] = useState<DrawSnapshot>(() => drawSession.tick(0));
  const [bubbles, setBubbles] = useState<BubblesSnapshot>(() =>
    bubblesSession.setEnabled(false, poseLimit, 0),
  );
  const [backgroundTheme, setBackgroundTheme] = useState<BackgroundTheme>("navy");
  const [announcement, setAnnouncement] = useState("");
  const palette = AVATAR_ACCENT_PALETTE;

  if (activeGameLayout === null) {
    orientationMismatchRef.current = false;
  } else if (packet !== null) {
    orientationMismatchRef.current = packet.frame.layout !== activeGameLayout;
  }
  const orientationMismatch = orientationMismatchRef.current;
  const gamePacket = orientationMismatch ? null : packet;
  latestPacketRef.current = packet;
  if (gamePacket !== null) {
    latestFrameRef.current = gamePacket.frame;
  }

  const applyDrawing = useCallback((next: DrawSnapshot) => {
    setDrawing((current) => (sameDrawing(current, next) ? current : next));
  }, []);

  const transitionTo = useCallback(
    (nextView: PlayfieldView, enteringLayout: CameraLayout | null = null) => {
      const nowMs = performance.now();
      const nextGameLayout = nextView === "draw" || nextView === "bubbles" ? enteringLayout : null;
      if ((nextView === "draw" || nextView === "bubbles") && nextGameLayout === null) {
        throw new Error("A game requires an explicit camera layout on entry.");
      }
      viewRef.current = nextView;
      setView(nextView);
      activeGameLayoutRef.current = nextGameLayout;
      setActiveGameLayout(nextGameLayout);
      setOrientationGate(null);
      controlSession.setControlsEnabled(true, nowMs);
      const controls = controlsForView(
        nextView,
        nextGameLayout ?? latestPacketRef.current?.frame.layout ?? null,
      );
      setControlPlacement(controls.placement);
      const controlUpdate = controlSession.setActions(controls.actions, controls.placement, nowMs);
      setSnapshot(controlUpdate.snapshot);
      if (nextView === "draw" && nextGameLayout !== null) {
        if (drawLayoutRef.current !== null && drawLayoutRef.current !== nextGameLayout) {
          drawSession.clear();
        }
        drawLayoutRef.current = nextGameLayout;
      }
      applyDrawing(drawSession.setEnabled(nextView === "draw"));
      if (nextView === "bubbles") {
        bubblesPlayerCountRef.current = poseLimit;
        let nextBubbles = bubblesSession.setEnabled(true, bubblesPlayerCountRef.current, nowMs);
        const currentPacket = latestPacketRef.current;
        if (currentPacket !== null && currentPacket.frame.layout === nextGameLayout) {
          nextBubbles = bubblesSession.updatePlayers(
            bubblesPlayersFromPosePacket(currentPacket, bubblesPlayerCountRef.current),
            currentPacket.frame,
            currentPacket.capturedAtMs,
            nowMs,
          );
        }
        setBubbles(nextBubbles);
      } else {
        setBubbles(bubblesSession.setEnabled(false, poseLimit, nowMs));
      }
      setAnnouncement("");
    },
    [applyDrawing, bubblesSession, controlSession, drawSession, poseLimit],
  );

  const activateAction = useCallback(
    (action: PlayfieldAction) => {
      if (poseLimitPending || cameraLayoutPending || playerModeRequestActiveRef.current) {
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
        case "open-bubbles": {
          const game: GameId = action === "open-draw" ? "draw" : "bubbles";
          const nextView = game;
          const currentLayout = latestPacketRef.current?.frame.layout ?? null;
          if (currentLayout === null) {
            setAnnouncement("A live camera frame is required before opening a game.");
            break;
          }
          if (gameSupportsCameraLayout(game, poseLimit, currentLayout)) {
            transitionTo(nextView, currentLayout);
            break;
          }
          const requiredLayout = requiredCameraLayout(game, poseLimit);
          if (requiredLayout === null) {
            throw new Error("The selected game has an inconsistent camera-layout policy.");
          }
          const nowMs = performance.now();
          setOrientationGate({ game, view: nextView, requiredLayout });
          setSnapshot(controlSession.setControlsEnabled(false, nowMs).snapshot);
          setAnnouncement("");
          void onCameraLayoutRequest(requiredLayout).catch(() => {
            setOrientationGate(null);
            setSnapshot(controlSession.setControlsEnabled(true, performance.now()).snapshot);
            setAnnouncement(
              `Camera layout did not change. ${viewLabel(viewRef.current)} remains active.`,
            );
          });
          break;
        }
        case "return-main":
          transitionTo("main");
          break;
        case "draw-tool": {
          const nextDrawing = drawSession.cycleTool();
          applyDrawing(nextDrawing);
          setAnnouncement(
            `${nextDrawing.selectedTool === "pencil" ? "Pencil" : "Eraser"} selected.`,
          );
          break;
        }
        case "draw-color":
          applyDrawing(drawSession.cycleColor());
          setAnnouncement("Drawing color changed.");
          break;
        case "draw-clear":
          applyDrawing(drawSession.clear());
          setAnnouncement("Drawing cleared.");
          break;
        case "draw-exit":
          transitionTo("games");
          break;
        case "bubbles-start":
        case "bubbles-restart": {
          const nowMs = performance.now();
          const started = bubblesSession.start(nowMs);
          setBubbles(started.snapshot);
          if (!started.started) {
            setAnnouncement(
              started.reason === "not-ready"
                ? `Waiting for ${bubblesPlayerCountRef.current === 1 ? "one visible player" : "two visible players"}.`
                : "Bubbles could not start. Exit and enter the game again.",
            );
            break;
          }
          const controlUpdate = controlSession.setControlsEnabled(false, nowMs);
          setSnapshot(controlUpdate.snapshot);
          setAnnouncement("");
          break;
        }
        case "bubbles-exit":
          transitionTo("games");
          break;
      }
    },
    [
      applyDrawing,
      bubblesSession,
      cameraLayoutPending,
      controlSession,
      drawSession,
      onCameraLayoutRequest,
      onPoseLimitRequest,
      poseLimit,
      poseLimitPending,
      transitionTo,
    ],
  );
  activateActionRef.current = activateAction;

  useEffect(() => {
    if (
      orientationGate === null ||
      cameraLayoutPending ||
      packet?.frame.layout !== orientationGate.requiredLayout
    ) {
      return;
    }
    transitionTo(orientationGate.view, orientationGate.requiredLayout);
  }, [cameraLayoutPending, orientationGate, packet, transitionTo]);

  useEffect(() => {
    const lockedLayout = activeGameLayoutRef.current;
    if (lockedLayout === null) {
      orientationReturnRequestActiveRef.current = false;
      return;
    }
    const nowMs = performance.now();
    if (orientationMismatch) {
      setSnapshot(controlSession.reset(nowMs).snapshot);
      if (viewRef.current === "draw") {
        applyDrawing(drawSession.suspend());
      } else if (viewRef.current === "bubbles") {
        setBubbles(bubblesSession.setPaused(true, nowMs));
      }
      if (!cameraLayoutPending && !orientationReturnRequestActiveRef.current) {
        orientationReturnRequestActiveRef.current = true;
        void onCameraLayoutRequest(lockedLayout).catch(() => {
          setAnnouncement(`Return the phone to ${lockedLayout} to resume.`);
        });
      }
      return;
    }

    orientationReturnRequestActiveRef.current = false;
    if (viewRef.current === "bubbles") {
      setBubbles(bubblesSession.setPaused(false, nowMs));
    }
  }, [
    applyDrawing,
    bubblesSession,
    cameraLayoutPending,
    controlSession,
    drawSession,
    onCameraLayoutRequest,
    orientationMismatch,
  ]);

  const applyPoseUpdate = useCallback(
    (
      update: PoseControlUpdate<PlayfieldAction>,
      nowMs: number,
      freshPacket: PosePacket | null | undefined,
    ) => {
      setSnapshot((current) =>
        sameSnapshot(current, update.snapshot) ? current : update.snapshot,
      );
      if (viewRef.current === "draw") {
        const frame = freshPacket?.frame ?? latestFrameRef.current;
        const viewport = viewportRef.current;
        if (
          freshPacket !== null &&
          freshPacket !== undefined &&
          frame !== null &&
          viewport.width > 0 &&
          viewport.height > 0
        ) {
          applyDrawing(
            drawSession.update({
              hands: update.snapshot.hands,
              frame,
              viewport,
              targets: update.snapshot.targets,
              sampleAtMs: freshPacket.capturedAtMs,
              receivedAtMs: nowMs,
            }),
          );
        } else {
          applyDrawing(drawSession.tick(nowMs));
        }
      } else if (viewRef.current === "bubbles" && freshPacket !== undefined) {
        setBubbles(
          freshPacket === null
            ? bubblesSession.clearPlayers(nowMs)
            : bubblesSession.updatePlayers(
                bubblesPlayersFromPosePacket(freshPacket, bubblesPlayerCountRef.current),
                freshPacket.frame,
                freshPacket.capturedAtMs,
                nowMs,
              ),
        );
      }
      if (update.activated !== null && !poseLimitPending && !cameraLayoutPending) {
        activateActionRef.current(update.activated);
      }
    },
    [applyDrawing, bubblesSession, cameraLayoutPending, drawSession, poseLimitPending],
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
    if (gamePacket !== null && (viewRef.current === "main" || viewRef.current === "games")) {
      const controls = controlsForView(viewRef.current, gamePacket.frame.layout);
      if (controls.placement !== controlPlacement) {
        controlSession.setActions(controls.actions, controls.placement, nowMs);
        setControlPlacement(controls.placement);
      }
    }
    applyPoseUpdate(controlSession.updatePacket(gamePacket, nowMs, size), nowMs, gamePacket);
  }, [gamePacket, size, applyPoseUpdate, controlPlacement, controlSession]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const nowMs = performance.now();
      applyPoseUpdate(controlSession.tick(nowMs), nowMs, undefined);
    }, 50);
    return () => window.clearInterval(intervalId);
  }, [applyPoseUpdate, controlSession]);

  useEffect(() => {
    if (
      view !== "bubbles" ||
      bubbles.paused ||
      (bubbles.phase !== "starting" && bubbles.phase !== "playing")
    ) {
      return;
    }
    let animationFrameId: number | null = null;
    const animate = (nowMs: number) => {
      const nextBubbles = bubblesSession.tick(nowMs);
      setBubbles(nextBubbles);
      if (nextBubbles.phase === "finished") {
        controlSession.setActions(BUBBLES_RESULT_ACTIONS, "left-column", nowMs);
        const controlUpdate = controlSession.setControlsEnabled(true, nowMs);
        setSnapshot(controlUpdate.snapshot);
        setAnnouncement("");
        return;
      }
      animationFrameId = window.requestAnimationFrame(animate);
    };
    animationFrameId = window.requestAnimationFrame(animate);
    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [bubbles.paused, bubbles.phase, bubblesSession, controlSession, view]);

  useEffect(() => {
    if (announcement === "" || announcement.startsWith("Switching")) {
      return;
    }
    const timeoutId = window.setTimeout(() => setAnnouncement(""), 4_000);
    return () => window.clearTimeout(timeoutId);
  }, [announcement]);

  const pointerColor = palette[snapshot.controllerPoseIndex ?? 0] ?? palette[0];
  const instruction = controlInstruction(snapshot, drawing, bubbles, view);
  const bubblesControlsVisible =
    view !== "bubbles" || bubbles.phase === "ready" || bubbles.phase === "finished";
  const frame = latestFrameRef.current;
  const projection =
    frame === null || size.width === 0 || size.height === 0
      ? null
      : createPoseProjection(frame.width, frame.height, size.width, size.height, true);
  const projectedBounds: Rectangle | null =
    projection === null ? null : projectedFrameBounds(projection);
  const toolPoint = toolScreenPoint(drawing.cursor.point, frame, size);
  const toolDiameter =
    projectedBounds === null
      ? 0
      : Math.min(projectedBounds.width, projectedBounds.height) * DRAW_ERASER_WIDTH;
  const rightScorePulsing =
    bubbles.lastPopAtMs.right !== null && bubbles.nowMs - bubbles.lastPopAtMs.right <= 320;
  const leftScorePulsing =
    bubbles.lastPopAtMs.left !== null && bubbles.nowMs - bubbles.lastPopAtMs.left <= 320;
  const orientationInstructionLayout =
    orientationGate?.requiredLayout ?? (orientationMismatch ? activeGameLayout : null);

  return (
    <div
      ref={containerRef}
      class={`tv-playfield tv-playfield--${backgroundTheme}${view === "draw" ? " tv-playfield--draw" : ""}${view === "bubbles" ? " tv-playfield--bubbles" : ""}`}
      data-background-theme={backgroundTheme}
      data-playfield-view={view}
      data-camera-layout={frame?.layout ?? "none"}
    >
      {view === "draw" && projectedBounds !== null ? (
        <div
          class="draw-board"
          data-testid="draw-board"
          style={`left: ${projectedBounds.x}px; top: ${projectedBounds.y}px; width: ${projectedBounds.width}px; height: ${projectedBounds.height}px`}
        >
          <DrawCanvas drawing={drawing} />
        </div>
      ) : null}

      {view === "bubbles" && projectedBounds !== null ? (
        <div
          class="bubbles-board"
          data-testid="bubbles-board"
          data-bubbles-phase={bubbles.phase}
          style={`left: ${projectedBounds.x}px; top: ${projectedBounds.y}px; width: ${projectedBounds.width}px; height: ${projectedBounds.height}px`}
        >
          <BubblesCanvas snapshot={bubbles} />
        </div>
      ) : null}

      <AvatarCanvas
        packet={gamePacket}
        label="Mirrored live body avatar from the paired phone"
        className="avatar-canvas avatar-canvas--tv"
        mirrored
        appearance={view === "draw" ? "draw" : view === "bubbles" ? "bubbles" : "stage"}
      />

      {orientationInstructionLayout === null ? null : (
        <section class="camera-layout-gate" role="status" aria-live="assertive">
          <p class="eyebrow">Camera layout</p>
          <h2>Rotate phone to {orientationInstructionLayout}</h2>
          <p>
            {orientationMismatch
              ? `${viewLabel(view)} is paused. Return the phone to its starting layout to resume.`
              : `${orientationGate?.game === "bubbles" ? "Two-player Bubbles" : "This game"} needs a ${orientationInstructionLayout} camera.`}
          </p>
        </section>
      )}

      {view === "bubbles" ? null : (
        <div class="playfield-view-label" aria-live="polite">
          <span>{viewLabel(view)}</span>
          {view === "draw" ? (
            <>
              <span>{drawing.selectedTool === "pencil" ? "Pencil" : "Eraser"}</span>
              <span
                class="playfield-view-label__swatch"
                style={`--draw-color: ${drawing.color}`}
                aria-hidden="true"
              />
              <span class="visually-hidden">Current drawing color {drawing.color}</span>
            </>
          ) : null}
        </div>
      )}

      {view === "bubbles" ? (
        <div class="bubbles-hud">
          {bubbles.playerCount === 2 ? (
            <output
              key={`left-score-${bubbles.lastPopAtMs.left ?? "idle"}`}
              class={`bubbles-score bubbles-score--left${leftScorePulsing ? " bubbles-score--popped" : ""}`}
              aria-label="Left player score"
            >
              <span>Left</span>
              <strong>{bubbles.scores.left}</strong>
            </output>
          ) : null}
          <output
            key={`right-score-${bubbles.lastPopAtMs.right ?? "idle"}`}
            class={`bubbles-score bubbles-score--right${bubbles.playerCount === 1 ? " bubbles-score--single" : ""}${rightScorePulsing ? " bubbles-score--popped" : ""}`}
            aria-label={bubbles.playerCount === 1 ? "Score" : "Right player score"}
          >
            <span>{bubbles.playerCount === 1 ? "Score" : "Right"}</span>
            <strong>{bubbles.scores.right}</strong>
          </output>
          <time
            class="bubbles-timer"
            dateTime={`PT${Math.ceil(bubbles.roundRemainingMs / 1_000)}S`}
          >
            <span class="visually-hidden">Bubbles time remaining: </span>
            {formatBubblesTime(bubbles.roundRemainingMs)}
          </time>
        </div>
      ) : null}

      {view === "bubbles" && bubbles.phase === "ready" ? (
        <section class="bubbles-round-message" aria-live="polite">
          <h2>Bubbles</h2>
          <p>
            {bubbles.readyToStart
              ? `${bubbles.playerCount === 1 ? "Player" : "Both players"} ready`
              : `Waiting for ${bubbles.playerCount === 1 ? "one player" : `two players — ${bubbles.visiblePlayers} visible`}`}
          </p>
        </section>
      ) : null}
      {view === "bubbles" && bubbles.phase === "starting" ? (
        <div class="bubbles-countdown" role="status" aria-live="assertive">
          {Math.max(1, Math.ceil(bubbles.startingRemainingMs / 1_000))}
        </div>
      ) : null}
      {view === "bubbles" && bubbles.phase === "playing" && bubbles.roundElapsedMs < 600 ? (
        <div class="bubbles-countdown bubbles-countdown--go" role="status">
          Go!
        </div>
      ) : null}
      {view === "bubbles" && bubbles.phase === "finished" ? (
        <section class="bubbles-round-message bubbles-round-message--result" role="status">
          <h2>Time!</h2>
          <p>{bubblesResultMessage(bubbles.result)}</p>
        </section>
      ) : null}

      {gamePacket !== null &&
      orientationGate === null &&
      !orientationMismatch &&
      announcement === "" &&
      bubblesControlsVisible ? (
        <p class={`pose-control-hint pose-control-hint--${snapshot.phase}`} aria-live="polite">
          {instruction}
          {snapshot.phase === "claiming" ? (
            <span class="pose-control-hint__progress" aria-hidden="true">
              <span style={`width: ${Math.round(snapshot.claimProgress * 100)}%`} />
            </span>
          ) : null}
        </p>
      ) : null}

      {gamePacket !== null &&
      orientationGate === null &&
      !orientationMismatch &&
      snapshot.phase === "active" &&
      bubblesControlsVisible ? (
        <fieldset class="pose-control-targets" data-control-placement={controlPlacement}>
          <legend class="visually-hidden">{viewLabel(view)} body-controlled actions</legend>
          {snapshot.targets.map((target) => {
            const hovered = snapshot.hoveredAction === target.action;
            const dwellProgress = hovered ? snapshot.dwellProgress : 0;
            const awaitingBubblesPlayers =
              (target.action === "bubbles-start" || target.action === "bubbles-restart") &&
              !bubbles.readyToStart;
            return (
              <button
                key={target.action}
                class={`pose-control-button${hovered ? " pose-control-button--hovered" : ""}`}
                type="button"
                aria-label={accessibleActionLabel(target.action, poseLimit, drawing)}
                onClick={() => activateAction(target.action)}
                disabled={poseLimitPending || cameraLayoutPending || awaitingBubblesPlayers}
                style={`left: ${target.rect.x}px; top: ${target.rect.y}px; width: ${target.rect.width}px; height: ${target.rect.height}px`}
              >
                <span class="pose-control-button__label">
                  {actionLabel(target.action, target.label, poseLimit, drawing)}
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

      {view !== "draw" &&
      bubblesControlsVisible &&
      gamePacket !== null &&
      !orientationMismatch &&
      snapshot.pointer !== null ? (
        <span
          class="pose-cursor"
          aria-hidden="true"
          style={`left: ${snapshot.pointer.x}px; top: ${snapshot.pointer.y}px; --pose-cursor-color: ${pointerColor}`}
        />
      ) : null}

      {view === "draw" && !orientationMismatch && toolPoint !== null ? (
        <span
          class={`draw-tool-cursor draw-tool-cursor--${drawing.selectedTool} draw-tool-cursor--${drawing.cursor.phase}`}
          aria-hidden="true"
          style={`left: ${toolPoint.x}px; top: ${toolPoint.y}px; --draw-tool-color: ${drawing.color}${drawing.selectedTool === "eraser" ? `; width: ${toolDiameter}px; height: ${toolDiameter}px` : ""}`}
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

import type { PoseControlHands, PoseControlTarget } from "../../interaction/pose-controls";
import { StationaryHoldTracker } from "../../interaction/stationary-hold";
import {
  createPoseProjection,
  type Point,
  projectNormalizedPoint,
  type Size,
} from "../../render/geometry";

export const DRAW_COLORS = ["#111827", "#2563eb", "#dc2626", "#16a34a"] as const;
export const DRAW_TOOL_DWELL_MS = 500;
export const DRAW_BRUSH_WIDTH = 0.012;
export const DRAW_ERASER_WIDTH = 0.07;

export type DrawColor = (typeof DRAW_COLORS)[number];
export type DrawTool = "brush" | "eraser";
export type DrawToolPhase = "unavailable" | "hover" | "arming" | "active" | "lifting";

export interface DrawCommand {
  tool: DrawTool;
  color: DrawColor;
  from: Point;
  to: Point;
}

export interface DrawToolSnapshot {
  point: Point | null;
  phase: DrawToolPhase;
  dwellProgress: number;
}

export interface DrawSnapshot {
  color: DrawColor;
  colorIndex: number;
  commands: readonly DrawCommand[];
  generation: number;
  revision: number;
  activeTool: DrawTool | null;
  brush: DrawToolSnapshot;
  eraser: DrawToolSnapshot;
}

export interface DrawInput<TAction extends string> {
  hands: PoseControlHands | null;
  frame: Size;
  viewport: Size;
  targets: readonly PoseControlTarget<TAction>[];
  sampleAtMs: number;
  receivedAtMs: number;
}

interface ToolState {
  active: boolean;
  blocked: boolean;
  point: Point | null;
  lastRawPoint: Point | null;
  lastSampleAtMs: number | null;
  lastSeenAtMs: number | null;
  hold: StationaryHoldTracker;
}

const HAND_FRESH_MS = 250;
const STATIONARY_RADIUS = 0.012;
const MAXIMUM_HAND_JUMP = 0.12;
const MINIMUM_RETAINED_MOVEMENT = 0.0025;
const SLOW_SMOOTHING_TIME_MS = 100;
const FAST_SMOOTHING_TIME_MS = 25;
const FULL_RESPONSIVENESS_SPEED = 1.5;
const STATIONARY_EXCURSION_GRACE_MS = 100;
const MAXIMUM_STATIONARY_EXCURSION_RATIO = 0.2;

function emptyToolState(): ToolState {
  return {
    active: false,
    blocked: false,
    point: null,
    lastRawPoint: null,
    lastSampleAtMs: null,
    lastSeenAtMs: null,
    hold: new StationaryHoldTracker({
      dwellMs: DRAW_TOOL_DWELL_MS,
      radius: STATIONARY_RADIUS,
      excursionGraceMs: STATIONARY_EXCURSION_GRACE_MS,
      maximumExcursionRatio: MAXIMUM_STATIONARY_EXCURSION_RATIO,
      maximumSampleGapMs: HAND_FRESH_MS,
    }),
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointInsideFrame(point: Point): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function frameDistance(left: Point, right: Point, frame: Size): number {
  const minimumDimension = Math.min(frame.width, frame.height);
  return Math.hypot(
    ((left.x - right.x) * frame.width) / minimumDimension,
    ((left.y - right.y) * frame.height) / minimumDimension,
  );
}

function targetContainsPoint<TAction extends string>(
  targets: readonly PoseControlTarget<TAction>[],
  point: Point,
): boolean {
  return targets.some(
    ({ rect }) =>
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height,
  );
}

function smoothPoint(state: ToolState, point: Point, sampleAtMs: number, frame: Size): Point {
  if (
    state.point === null ||
    state.lastRawPoint === null ||
    state.lastSampleAtMs === null ||
    sampleAtMs <= state.lastSampleAtMs
  ) {
    return { ...point };
  }
  const elapsedMs = sampleAtMs - state.lastSampleAtMs;
  const speed = frameDistance(state.lastRawPoint, point, frame) / (elapsedMs / 1_000);
  const responsiveness = clamp(speed / FULL_RESPONSIVENESS_SPEED, 0, 1);
  const timeConstantMs =
    SLOW_SMOOTHING_TIME_MS - (SLOW_SMOOTHING_TIME_MS - FAST_SMOOTHING_TIME_MS) * responsiveness;
  const alpha = 1 - Math.exp(-elapsedMs / timeConstantMs);
  return {
    x: state.point.x + (point.x - state.point.x) * alpha,
    y: state.point.y + (point.y - state.point.y) * alpha,
  };
}

export class DrawSession {
  private readonly commands: DrawCommand[] = [];
  private readonly brush = emptyToolState();
  private readonly eraser = emptyToolState();
  private enabled = false;
  private colorIndex = 0;
  private generation = 0;
  private revision = 0;
  private frame: Size | null = null;
  private activeTool: DrawTool | null = null;
  private lastCommandPoint: Point | null = null;

  public setEnabled(enabled: boolean): DrawSnapshot {
    this.enabled = enabled;
    this.liftAll(true);
    return this.snapshot();
  }

  public cycleColor(): DrawSnapshot {
    this.colorIndex = (this.colorIndex + 1) % DRAW_COLORS.length;
    this.liftAll(false);
    return this.snapshot();
  }

  public clear(): DrawSnapshot {
    this.commands.length = 0;
    this.generation += 1;
    this.revision += 1;
    this.liftAll(false);
    return this.snapshot();
  }

  public update<TAction extends string>(input: DrawInput<TAction>): DrawSnapshot {
    if (!this.enabled || input.hands === null) {
      this.liftAll(true);
      return this.snapshot();
    }

    if (
      this.frame === null ||
      this.frame.width !== input.frame.width ||
      this.frame.height !== input.frame.height
    ) {
      this.frame = { ...input.frame };
      this.liftAll(true);
    }

    const brushPoint = input.hands.selected === "left" ? input.hands.left : input.hands.right;
    const eraserPoint = input.hands.selected === "left" ? input.hands.right : input.hands.left;

    const brushEngaged = this.updateTool("brush", this.brush, brushPoint, input, false);
    if (brushEngaged) {
      this.liftTool("eraser", this.eraser, false);
    }
    const eraserEngaged = this.updateTool("eraser", this.eraser, eraserPoint, input, brushEngaged);
    if (eraserEngaged) {
      this.liftTool("brush", this.brush, false);
    }

    return this.snapshot();
  }

  public tick(nowMs: number): DrawSnapshot {
    for (const [tool, state] of [
      ["brush", this.brush],
      ["eraser", this.eraser],
    ] as const) {
      if (state.lastSeenAtMs !== null && nowMs - state.lastSeenAtMs > HAND_FRESH_MS) {
        this.liftTool(tool, state, true);
      }
    }
    return this.snapshot();
  }

  private updateTool<TAction extends string>(
    tool: DrawTool,
    state: ToolState,
    rawPoint: Point | null,
    input: DrawInput<TAction>,
    preventEngagement: boolean,
  ): boolean {
    if (rawPoint === null || !pointInsideFrame(rawPoint)) {
      this.liftTool(tool, state, true);
      return false;
    }

    const projectedPoint = projectNormalizedPoint(
      rawPoint.x,
      rawPoint.y,
      createPoseProjection(
        input.frame.width,
        input.frame.height,
        input.viewport.width,
        input.viewport.height,
        true,
      ),
    );
    const blocked = targetContainsPoint(input.targets, projectedPoint);
    if (blocked) {
      this.liftTool(tool, state, false);
      state.blocked = true;
      state.point = { ...rawPoint };
      state.lastRawPoint = { ...rawPoint };
      state.lastSampleAtMs = input.sampleAtMs;
      state.lastSeenAtMs = input.receivedAtMs;
      return false;
    }

    state.blocked = false;
    if (
      state.lastSeenAtMs !== null &&
      (input.receivedAtMs - state.lastSeenAtMs > HAND_FRESH_MS ||
        (state.lastRawPoint !== null &&
          frameDistance(state.lastRawPoint, rawPoint, input.frame) > MAXIMUM_HAND_JUMP))
    ) {
      this.liftTool(tool, state, true);
    }

    const filteredPoint = smoothPoint(state, rawPoint, input.sampleAtMs, input.frame);
    const previousPoint = state.point;
    state.point = filteredPoint;
    state.lastSeenAtMs = input.receivedAtMs;
    const holdUpdate = state.hold.update(rawPoint, input.sampleAtMs, input.frame);

    let engagedNow = false;
    if (holdUpdate.completed) {
      if (state.active) {
        state.active = false;
        state.blocked = false;
        if (this.activeTool === tool) {
          this.activeTool = null;
          this.lastCommandPoint = null;
        }
        state.point = filteredPoint;
        state.lastSeenAtMs = input.receivedAtMs;
      } else if (!preventEngagement) {
        this.engageTool(tool, state, filteredPoint);
        engagedNow = true;
      }
    }

    if (
      state.active &&
      !engagedNow &&
      previousPoint !== null &&
      frameDistance(previousPoint, filteredPoint, input.frame) >= MINIMUM_RETAINED_MOVEMENT
    ) {
      this.appendCommand(tool, previousPoint, filteredPoint);
    }

    state.lastRawPoint = { ...rawPoint };
    state.lastSampleAtMs = input.sampleAtMs;
    return engagedNow;
  }

  private engageTool(tool: DrawTool, state: ToolState, point: Point): void {
    state.active = true;
    this.activeTool = tool;
    this.lastCommandPoint = { ...point };
    this.appendCommand(tool, point, point);
  }

  private appendCommand(tool: DrawTool, from: Point, to: Point): void {
    const start = this.lastCommandPoint ?? from;
    this.commands.push({
      tool,
      color: DRAW_COLORS[this.colorIndex] ?? DRAW_COLORS[0],
      from: { ...start },
      to: { ...to },
    });
    this.lastCommandPoint = { ...to };
    this.revision += 1;
  }

  private liftAll(clearPoints: boolean): void {
    this.liftTool("brush", this.brush, clearPoints);
    this.liftTool("eraser", this.eraser, clearPoints);
  }

  private liftTool(tool: DrawTool, state: ToolState, clearPoint: boolean): void {
    state.active = false;
    state.hold.reset();
    state.blocked = false;
    if (this.activeTool === tool) {
      this.activeTool = null;
      this.lastCommandPoint = null;
    }
    if (clearPoint) {
      state.point = null;
      state.lastRawPoint = null;
      state.lastSampleAtMs = null;
      state.lastSeenAtMs = null;
    }
  }

  private toolSnapshot(state: ToolState): DrawToolSnapshot {
    if (state.point === null) {
      return { point: null, phase: "unavailable", dwellProgress: 0 };
    }
    if (state.blocked || state.hold.latched || !state.hold.hasCandidate) {
      return {
        point: state.point,
        phase: state.active ? "active" : "hover",
        dwellProgress: 0,
      };
    }
    const dwellProgress = state.hold.progress;
    return {
      point: state.point,
      phase: state.active ? (dwellProgress > 0 ? "lifting" : "active") : "arming",
      dwellProgress,
    };
  }

  private snapshot(): DrawSnapshot {
    return {
      color: DRAW_COLORS[this.colorIndex] ?? DRAW_COLORS[0],
      colorIndex: this.colorIndex,
      commands: this.commands,
      generation: this.generation,
      revision: this.revision,
      activeTool: this.activeTool,
      brush: this.toolSnapshot(this.brush),
      eraser: this.toolSnapshot(this.eraser),
    };
  }
}

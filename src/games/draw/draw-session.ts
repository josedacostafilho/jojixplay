import type { PoseControlHands, PoseControlTarget } from "../../interaction/pose-controls";
import {
  createPoseProjection,
  frameNormalizedDistance,
  type Point,
  projectNormalizedPoint,
  type Size,
} from "../../render/geometry";

export const DRAW_COLORS = ["#111827", "#2563eb", "#dc2626", "#16a34a"] as const;
export const DRAW_PENCIL_WIDTH = 0.012;
export const DRAW_ERASER_WIDTH = 0.07;
export const DRAW_GRIP_ENGAGE_SHOULDER_RATIO = 0.75;
export const DRAW_GRIP_RELEASE_SHOULDER_RATIO = 1.25;

export type DrawColor = (typeof DRAW_COLORS)[number];
export type DrawTool = "pencil" | "eraser";
export type DrawCursorPhase = "unavailable" | "ready" | "active";

export interface DrawCommand {
  tool: DrawTool;
  color: DrawColor;
  from: Point;
  to: Point;
}

export interface DrawCursorSnapshot {
  point: Point | null;
  phase: DrawCursorPhase;
}

export interface DrawSnapshot {
  color: DrawColor;
  colorIndex: number;
  selectedTool: DrawTool;
  gripActive: boolean;
  commands: readonly DrawCommand[];
  generation: number;
  revision: number;
  cursor: DrawCursorSnapshot;
}

export interface DrawInput<TAction extends string> {
  hands: PoseControlHands | null;
  frame: Size;
  viewport: Size;
  targets: readonly PoseControlTarget<TAction>[];
  sampleAtMs: number;
  receivedAtMs: number;
}

interface CursorState {
  point: Point | null;
  lastRawPoint: Point | null;
  lastSampleAtMs: number | null;
  lastSeenAtMs: number | null;
}

const HAND_FRESH_MS = 250;
const MAXIMUM_HAND_JUMP = 0.12;
const MINIMUM_RETAINED_MOVEMENT = 0.0025;
const SLOW_SMOOTHING_TIME_MS = 100;
const FAST_SMOOTHING_TIME_MS = 25;
const FULL_RESPONSIVENESS_SPEED = 1.5;
const SEPARATION_RATIO_EPSILON = 1e-6;

function emptyCursorState(): CursorState {
  return {
    point: null,
    lastRawPoint: null,
    lastSampleAtMs: null,
    lastSeenAtMs: null,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointInsideFrame(point: Point): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
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

function smoothPoint(state: CursorState, point: Point, sampleAtMs: number, frame: Size): Point {
  if (
    state.point === null ||
    state.lastRawPoint === null ||
    state.lastSampleAtMs === null ||
    sampleAtMs <= state.lastSampleAtMs
  ) {
    return { ...point };
  }
  const elapsedMs = sampleAtMs - state.lastSampleAtMs;
  const speed = frameNormalizedDistance(state.lastRawPoint, point, frame) / (elapsedMs / 1_000);
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
  private readonly cursor = emptyCursorState();
  private enabled = false;
  private colorIndex = 0;
  private selectedTool: DrawTool = "pencil";
  private gripActive = false;
  private generation = 0;
  private revision = 0;
  private frame: Size | null = null;
  private lastCommandPoint: Point | null = null;

  public setEnabled(enabled: boolean): DrawSnapshot {
    this.enabled = enabled;
    this.resetInteraction(true);
    return this.snapshot();
  }

  public cycleTool(): DrawSnapshot {
    this.selectedTool = this.selectedTool === "pencil" ? "eraser" : "pencil";
    this.breakPath();
    return this.snapshot();
  }

  public cycleColor(): DrawSnapshot {
    this.colorIndex = (this.colorIndex + 1) % DRAW_COLORS.length;
    this.breakPath();
    return this.snapshot();
  }

  public clear(): DrawSnapshot {
    this.commands.length = 0;
    this.generation += 1;
    this.revision += 1;
    this.breakPath();
    return this.snapshot();
  }

  public update<TAction extends string>(input: DrawInput<TAction>): DrawSnapshot {
    if (!this.enabled) {
      this.resetInteraction(true);
      return this.snapshot();
    }

    if (
      this.frame === null ||
      this.frame.width !== input.frame.width ||
      this.frame.height !== input.frame.height
    ) {
      const firstFrame = this.frame === null;
      this.frame = { ...input.frame };
      this.resetInteraction(true);
      if (!firstFrame) {
        return this.snapshot();
      }
    }

    const hands = input.hands;
    if (hands === null) {
      this.handleUnavailable(input.receivedAtMs);
      return this.snapshot();
    }

    const rawPoint = hands.selected === "left" ? hands.left : hands.right;
    const supportingPoint = hands.selected === "left" ? hands.right : hands.left;
    if (
      this.cursor.lastSeenAtMs !== null &&
      input.receivedAtMs - this.cursor.lastSeenAtMs > HAND_FRESH_MS
    ) {
      this.resetInteraction(true);
    }

    if (
      rawPoint !== null &&
      supportingPoint !== null &&
      Number.isFinite(hands.shoulderSpan) &&
      hands.shoulderSpan > 0
    ) {
      const separationRatio =
        frameNormalizedDistance(rawPoint, supportingPoint, input.frame) / hands.shoulderSpan;
      if (this.gripActive) {
        if (separationRatio >= DRAW_GRIP_RELEASE_SHOULDER_RATIO - SEPARATION_RATIO_EPSILON) {
          this.gripActive = false;
          this.breakPath();
        }
      } else if (separationRatio <= DRAW_GRIP_ENGAGE_SHOULDER_RATIO + SEPARATION_RATIO_EPSILON) {
        this.gripActive = true;
        this.breakPath();
      }
    }

    if (rawPoint === null) {
      this.handleUnavailable(input.receivedAtMs);
      return this.snapshot();
    }
    this.cursor.lastSeenAtMs = input.receivedAtMs;
    if (!pointInsideFrame(rawPoint)) {
      this.clearCursorPoint();
      return this.snapshot();
    }

    if (
      this.cursor.lastRawPoint !== null &&
      frameNormalizedDistance(this.cursor.lastRawPoint, rawPoint, input.frame) > MAXIMUM_HAND_JUMP
    ) {
      this.breakPath();
      this.cursor.point = { ...rawPoint };
      this.cursor.lastRawPoint = { ...rawPoint };
      this.cursor.lastSampleAtMs = input.sampleAtMs;
      return this.snapshot();
    }

    const filteredPoint = smoothPoint(this.cursor, rawPoint, input.sampleAtMs, input.frame);
    const previousPoint = this.cursor.point;
    this.cursor.point = filteredPoint;
    this.cursor.lastRawPoint = { ...rawPoint };
    this.cursor.lastSampleAtMs = input.sampleAtMs;

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
    if (targetContainsPoint(input.targets, projectedPoint)) {
      this.breakPath();
      return this.snapshot();
    }

    if (!this.gripActive) {
      this.breakPath();
      return this.snapshot();
    }
    if (this.lastCommandPoint === null) {
      this.appendCommand(filteredPoint, filteredPoint);
    } else if (
      previousPoint !== null &&
      frameNormalizedDistance(previousPoint, filteredPoint, input.frame) >=
        MINIMUM_RETAINED_MOVEMENT
    ) {
      this.appendCommand(previousPoint, filteredPoint);
    }

    return this.snapshot();
  }

  public tick(nowMs: number): DrawSnapshot {
    if (this.cursor.lastSeenAtMs !== null && nowMs - this.cursor.lastSeenAtMs > HAND_FRESH_MS) {
      this.resetInteraction(true);
    }
    return this.snapshot();
  }

  private appendCommand(from: Point, to: Point): void {
    const start = this.lastCommandPoint ?? from;
    this.commands.push({
      tool: this.selectedTool,
      color: DRAW_COLORS[this.colorIndex] ?? DRAW_COLORS[0],
      from: { ...start },
      to: { ...to },
    });
    this.lastCommandPoint = { ...to };
    this.revision += 1;
  }

  private handleUnavailable(nowMs: number): void {
    this.clearCursorPoint();
    if (this.cursor.lastSeenAtMs !== null && nowMs - this.cursor.lastSeenAtMs > HAND_FRESH_MS) {
      this.gripActive = false;
      this.cursor.lastSeenAtMs = null;
    }
  }

  private clearCursorPoint(): void {
    this.cursor.point = null;
    this.cursor.lastRawPoint = null;
    this.cursor.lastSampleAtMs = null;
    this.breakPath();
  }

  private breakPath(): void {
    this.lastCommandPoint = null;
  }

  private resetInteraction(clearPoint: boolean): void {
    this.gripActive = false;
    this.breakPath();
    if (clearPoint) {
      this.cursor.point = null;
      this.cursor.lastRawPoint = null;
      this.cursor.lastSampleAtMs = null;
      this.cursor.lastSeenAtMs = null;
    }
  }

  private snapshot(): DrawSnapshot {
    return {
      color: DRAW_COLORS[this.colorIndex] ?? DRAW_COLORS[0],
      colorIndex: this.colorIndex,
      selectedTool: this.selectedTool,
      gripActive: this.gripActive,
      commands: this.commands,
      generation: this.generation,
      revision: this.revision,
      cursor: {
        point: this.cursor.point,
        phase: this.cursor.point === null ? "unavailable" : this.gripActive ? "active" : "ready",
      },
    };
  }
}

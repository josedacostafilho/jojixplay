import { type CameraFrame, sameCameraFrameBasis } from "../../domain/camera";
import type { DetectedPose, PosePacket } from "../../domain/pose";
import { coarseHand, usablePoseLandmark } from "../../domain/pose-features";
import type { PoseLimit } from "../../domain/pose-limit";
import { frameNormalizedDistance, type Point, type Size } from "../../render/geometry";

export const BUBBLES_STARTING_DURATION_MS = 3_000;
export const BUBBLES_ROUND_DURATION_MS = 60_000;
export const BUBBLES_POP_DURATION_MS = 240;
export const BUBBLES_RESPAWN_MIN_MS = 350;
export const BUBBLES_RESPAWN_MAX_MS = 700;
export const BUBBLES_MIN_RADIUS = 0.03;
export const BUBBLES_MAX_RADIUS = 0.07;
export const BUBBLES_MIN_SPEED = 0.025;
export const BUBBLES_MAX_SPEED = 0.055;
export const BUBBLES_HAND_HIT_RADIUS = 0.025;
export const BUBBLES_TARGET_COUNTS = { 1: 6, 2: 8 } as const satisfies Record<PoseLimit, number>;

export type BubblesPhase = "ready" | "starting" | "playing" | "finished";
export type BubblesPlayerSide = "left" | "right";
export type BubblesHand = "left" | "right";
export type BubbleState = "active" | "popping";

export interface BubblesPlayerInput {
  side: BubblesPlayerSide;
  torso: Point;
  hands: Readonly<Record<BubblesHand, Point | null>>;
}

export interface BubblesHandSnapshot {
  side: BubblesPlayerSide;
  hand: BubblesHand;
  point: Point;
}

export interface BubbleSnapshot {
  id: number;
  point: Point;
  radius: number;
  velocity: Point;
  hue: number;
  shimmerPhase: number;
  spawnedAtMs: number;
  state: BubbleState;
  poppedAtMs: number | null;
  poppedBy: BubblesPlayerSide | null;
}

export type BubblesResult =
  | { type: "score"; score: number }
  | {
      type: "winner";
      winner: BubblesPlayerSide | "tie";
      leftScore: number;
      rightScore: number;
    };

export interface BubblesSnapshot {
  phase: BubblesPhase;
  paused: boolean;
  playerCount: PoseLimit;
  visiblePlayers: number;
  readyToStart: boolean;
  scores: Readonly<Record<BubblesPlayerSide, number>>;
  startingRemainingMs: number;
  roundRemainingMs: number;
  roundElapsedMs: number;
  bubbles: readonly BubbleSnapshot[];
  hands: readonly BubblesHandSnapshot[];
  result: BubblesResult | null;
  lastPopAtMs: Readonly<Record<BubblesPlayerSide, number | null>>;
  nowMs: number;
}

export type BubblesStartResult =
  | { started: true; snapshot: BubblesSnapshot }
  | {
      started: false;
      reason: "disabled" | "paused" | "invalid-phase" | "missing-frame" | "not-ready";
      snapshot: BubblesSnapshot;
    };

interface BubbleStateModel extends BubbleSnapshot {
  targetVelocity: Point;
  retargetAtMs: number;
}

interface HandHistory {
  point: Point;
  sampleAtMs: number;
}

interface CollisionCandidate {
  side: BubblesPlayerSide;
  hand: BubblesHand;
  distance: number;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const HAND_SAMPLE_FRESH_MS = 250;
const MAXIMUM_HAND_SWEEP_DISTANCE = 0.35;
const MAXIMUM_MOVEMENT_DELTA_MS = 100;
const VELOCITY_EASING_MS = 650;
const RETARGET_MIN_MS = 800;
const RETARGET_MAX_MS = 2_000;
const SPAWN_ATTEMPTS = 32;
const SPAWN_SEPARATION = 0.012;
const SPAWN_HAND_CLEARANCE = 0.035;
const EDGE_STEERING_DISTANCE = 0.04;
const BOUNCE_VARIATION_RADIANS = 0.18;
const COLLISION_EPSILON = 1e-9;

type RandomSource = () => number;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointInsideFrame(point: Point): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function usableTorsoCenter(pose: DetectedPose): Point | null {
  const leftShoulder = usablePoseLandmark(pose, LEFT_SHOULDER);
  const rightShoulder = usablePoseLandmark(pose, RIGHT_SHOULDER);
  const leftHip = usablePoseLandmark(pose, LEFT_HIP);
  const rightHip = usablePoseLandmark(pose, RIGHT_HIP);
  if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
    return null;
  }
  return midpoint(midpoint(leftShoulder, rightShoulder), midpoint(leftHip, rightHip));
}

function mirroredPoint(point: Point): Point {
  return { x: 1 - point.x, y: point.y };
}

interface PlayerDescriptor {
  torso: Point;
  hands: Readonly<Record<BubblesHand, Point | null>>;
}

function describePlayer(pose: DetectedPose): PlayerDescriptor | null {
  const torso = usableTorsoCenter(pose);
  if (torso === null) {
    return null;
  }
  const mirroredTorso = mirroredPoint(torso);
  if (!pointInsideFrame(mirroredTorso)) {
    return null;
  }
  const leftHand = coarseHand(pose, "left");
  const rightHand = coarseHand(pose, "right");
  return {
    torso: mirroredTorso,
    hands: {
      left: leftHand === null ? null : mirroredPoint(leftHand.center),
      right: rightHand === null ? null : mirroredPoint(rightHand.center),
    },
  };
}

export function bubblesPlayersFromPosePacket(
  packet: PosePacket | null,
  playerCount: PoseLimit,
): readonly BubblesPlayerInput[] {
  if (packet === null) {
    return [];
  }
  const players = packet.poses
    .map(describePlayer)
    .filter((player): player is PlayerDescriptor => player !== null)
    .sort((left, right) => left.torso.x - right.torso.x);

  if (playerCount === 1) {
    const player = players[0];
    return player === undefined ? [] : [{ ...player, side: "right" }];
  }
  if (players.length >= 2) {
    const left = players[0];
    const right = players.at(-1);
    if (left === undefined || right === undefined) {
      return [];
    }
    return [
      { ...left, side: "left" },
      { ...right, side: "right" },
    ];
  }
  const player = players[0];
  if (player === undefined) {
    return [];
  }
  return [{ ...player, side: player.torso.x < 0.5 ? "left" : "right" }];
}

function radiusAxes(radius: number, frame: Size): Point {
  const minimumDimension = Math.min(frame.width, frame.height);
  return {
    x: (radius * minimumDimension) / frame.width,
    y: (radius * minimumDimension) / frame.height,
  };
}

function normalizedVelocityDelta(velocity: Point, elapsedSeconds: number, frame: Size): Point {
  const minimumDimension = Math.min(frame.width, frame.height);
  return {
    x: (velocity.x * minimumDimension * elapsedSeconds) / frame.width,
    y: (velocity.y * minimumDimension * elapsedSeconds) / frame.height,
  };
}

function arenaPoint(point: Point, frame: Size): Point {
  const minimumDimension = Math.min(frame.width, frame.height);
  return {
    x: (point.x * frame.width) / minimumDimension,
    y: (point.y * frame.height) / minimumDimension,
  };
}

function pointToSegmentDistance(point: Point, from: Point, to: Point): number {
  const segmentX = to.x - from.x;
  const segmentY = to.y - from.y;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - from.x, point.y - from.y);
  }
  const projection = clamp(
    ((point.x - from.x) * segmentX + (point.y - from.y) * segmentY) / lengthSquared,
    0,
    1,
  );
  return Math.hypot(
    point.x - (from.x + projection * segmentX),
    point.y - (from.y + projection * segmentY),
  );
}

function handKey(side: BubblesPlayerSide, hand: BubblesHand): string {
  return `${side}:${hand}`;
}

function candidateComesFirst(left: CollisionCandidate, right: CollisionCandidate): boolean {
  if (left.distance < right.distance - COLLISION_EPSILON) {
    return true;
  }
  if (Math.abs(left.distance - right.distance) > COLLISION_EPSILON) {
    return false;
  }
  if (left.side !== right.side) {
    return left.side === "left";
  }
  return left.hand === "left" && right.hand === "right";
}

export class BubblesSession {
  private readonly bubbles: BubbleStateModel[] = [];
  private readonly respawnAtMs: number[] = [];
  private readonly handHistory = new Map<string, HandHistory>();
  private enabled = false;
  private phase: BubblesPhase = "ready";
  private playerCount: PoseLimit = 1;
  private visiblePlayers = 0;
  private scores: Record<BubblesPlayerSide, number> = { left: 0, right: 0 };
  private latestHands: BubblesHandSnapshot[] = [];
  private frame: CameraFrame | null = null;
  private pausedAtMs: number | null = null;
  private roundStartedAtMs: number | null = null;
  private lastAdvancedAtMs: number | null = null;
  private lastInputSampleAtMs: number | null = null;
  private result: BubblesResult | null = null;
  private lastPopAtMs: Record<BubblesPlayerSide, number | null> = { left: null, right: null };
  private nextBubbleId = 1;

  public constructor(private readonly randomSource: RandomSource = Math.random) {}

  public setEnabled(enabled: boolean, playerCount: PoseLimit, nowMs: number): BubblesSnapshot {
    this.enabled = enabled;
    this.playerCount = playerCount;
    this.phase = "ready";
    this.visiblePlayers = 0;
    this.scores = { left: 0, right: 0 };
    this.latestHands = [];
    this.frame = null;
    this.pausedAtMs = null;
    this.roundStartedAtMs = null;
    this.lastAdvancedAtMs = null;
    this.lastInputSampleAtMs = null;
    this.result = null;
    this.lastPopAtMs = { left: null, right: null };
    this.bubbles.length = 0;
    this.respawnAtMs.length = 0;
    this.handHistory.clear();
    return this.snapshot(nowMs);
  }

  public updatePlayers(
    players: readonly BubblesPlayerInput[],
    frame: CameraFrame,
    sampleAtMs: number,
    receivedAtMs: number,
  ): BubblesSnapshot {
    this.advance(receivedAtMs);
    if (!this.enabled) {
      return this.snapshot(receivedAtMs);
    }
    if (this.pausedAtMs !== null) {
      return this.snapshot(receivedAtMs);
    }

    const frameChanged = this.frame === null || !sameCameraFrameBasis(this.frame, frame);
    this.frame = { ...frame };
    if (frameChanged) {
      this.handHistory.clear();
      this.lastInputSampleAtMs = null;
      this.clampAllBubbles(receivedAtMs);
    }

    this.visiblePlayers = players.length;
    this.latestHands = this.collectHands(players);
    const sampleIncreasing =
      this.lastInputSampleAtMs === null || sampleAtMs > this.lastInputSampleAtMs;
    if (!sampleIncreasing) {
      this.handHistory.clear();
      return this.snapshot(receivedAtMs);
    }
    this.lastInputSampleAtMs = sampleAtMs;

    if (this.phase === "playing") {
      this.resolveCollisions(sampleAtMs, receivedAtMs);
      this.updateHandHistory(sampleAtMs);
    } else {
      this.handHistory.clear();
    }
    return this.snapshot(receivedAtMs);
  }

  public clearPlayers(nowMs: number): BubblesSnapshot {
    this.advance(nowMs);
    this.visiblePlayers = 0;
    this.latestHands = [];
    this.handHistory.clear();
    this.lastInputSampleAtMs = null;
    return this.snapshot(nowMs);
  }

  public start(nowMs: number): BubblesStartResult {
    this.advance(nowMs);
    if (!this.enabled) {
      return { started: false, reason: "disabled", snapshot: this.snapshot(nowMs) };
    }
    if (this.pausedAtMs !== null) {
      return { started: false, reason: "paused", snapshot: this.snapshot(nowMs) };
    }
    if (this.phase !== "ready" && this.phase !== "finished") {
      return { started: false, reason: "invalid-phase", snapshot: this.snapshot(nowMs) };
    }
    if (this.frame === null) {
      return { started: false, reason: "missing-frame", snapshot: this.snapshot(nowMs) };
    }
    if (!this.readyToStart()) {
      return { started: false, reason: "not-ready", snapshot: this.snapshot(nowMs) };
    }

    this.phase = "starting";
    this.scores = { left: 0, right: 0 };
    this.roundStartedAtMs = nowMs + BUBBLES_STARTING_DURATION_MS;
    this.lastAdvancedAtMs = nowMs;
    this.lastInputSampleAtMs = null;
    this.result = null;
    this.lastPopAtMs = { left: null, right: null };
    this.nextBubbleId = 1;
    this.bubbles.length = 0;
    this.respawnAtMs.length = 0;
    this.handHistory.clear();
    const targetCount = BUBBLES_TARGET_COUNTS[this.playerCount];
    for (let index = 0; index < targetCount; index += 1) {
      this.bubbles.push(this.createBubble(nowMs));
    }
    return { started: true, snapshot: this.snapshot(nowMs) };
  }

  public tick(nowMs: number): BubblesSnapshot {
    this.advance(nowMs);
    return this.snapshot(nowMs);
  }

  public setPaused(paused: boolean, nowMs: number): BubblesSnapshot {
    if (!this.enabled) {
      return this.snapshot(nowMs);
    }
    if (paused) {
      if (this.pausedAtMs !== null) {
        return this.snapshot(nowMs);
      }
      this.advance(nowMs);
      this.pausedAtMs = nowMs;
      this.visiblePlayers = 0;
      this.latestHands = [];
      this.handHistory.clear();
      this.lastInputSampleAtMs = null;
      return this.snapshot(nowMs);
    }
    if (this.pausedAtMs === null) {
      return this.snapshot(nowMs);
    }

    const pausedDurationMs = Math.max(0, nowMs - this.pausedAtMs);
    if (this.roundStartedAtMs !== null) {
      this.roundStartedAtMs += pausedDurationMs;
    }
    for (const bubble of this.bubbles) {
      bubble.spawnedAtMs += pausedDurationMs;
      bubble.retargetAtMs += pausedDurationMs;
      if (bubble.poppedAtMs !== null) {
        bubble.poppedAtMs += pausedDurationMs;
      }
    }
    for (let index = 0; index < this.respawnAtMs.length; index += 1) {
      const respawnAtMs = this.respawnAtMs[index];
      if (respawnAtMs !== undefined) {
        this.respawnAtMs[index] = respawnAtMs + pausedDurationMs;
      }
    }
    for (const side of ["left", "right"] as const) {
      const lastPopAtMs = this.lastPopAtMs[side];
      if (lastPopAtMs !== null) {
        this.lastPopAtMs[side] = lastPopAtMs + pausedDurationMs;
      }
    }
    this.pausedAtMs = null;
    this.lastAdvancedAtMs = nowMs;
    this.handHistory.clear();
    this.lastInputSampleAtMs = null;
    return this.snapshot(nowMs);
  }

  private readyToStart(): boolean {
    return (
      this.enabled &&
      this.pausedAtMs === null &&
      this.frame !== null &&
      this.visiblePlayers >= this.playerCount
    );
  }

  private random(): number {
    const value = this.randomSource();
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      throw new Error("Bubbles random source must return a finite value in [0, 1).");
    }
    return value;
  }

  private randomBetween(minimum: number, maximum: number): number {
    return minimum + (maximum - minimum) * this.random();
  }

  private targetVelocity(radius: number): Point {
    const relativeSize = (BUBBLES_MAX_RADIUS - radius) / (BUBBLES_MAX_RADIUS - BUBBLES_MIN_RADIUS);
    const speedRange = BUBBLES_MAX_SPEED - BUBBLES_MIN_SPEED;
    const speed = BUBBLES_MIN_SPEED + speedRange * (relativeSize * 0.65 + this.random() * 0.35);
    let directionX = this.random() * 2 - 1;
    let directionY = this.random() * 1.7 - 1.15;
    let magnitude = Math.hypot(directionX, directionY);
    if (magnitude < 0.1) {
      directionX = 0.35;
      directionY = -0.65;
      magnitude = Math.hypot(directionX, directionY);
    }
    return { x: (directionX / magnitude) * speed, y: (directionY / magnitude) * speed };
  }

  private createBubble(nowMs: number): BubbleStateModel {
    const frame = this.frame;
    if (frame === null) {
      throw new Error("Bubbles require a camera frame before spawning.");
    }
    const radius = this.randomBetween(BUBBLES_MIN_RADIUS, BUBBLES_MAX_RADIUS);
    const axes = radiusAxes(radius, frame);
    let point: Point = { x: 0.5, y: 0.5 };
    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt += 1) {
      const candidate = {
        x: this.randomBetween(axes.x, 1 - axes.x),
        y: this.randomBetween(axes.y, 1 - axes.y),
      };
      point = candidate;
      const overlapsBubble = this.bubbles.some(
        (bubble) =>
          frameNormalizedDistance(candidate, bubble.point, frame) <
          radius + bubble.radius + SPAWN_SEPARATION,
      );
      const overlapsHand = this.latestHands.some(
        (hand) =>
          frameNormalizedDistance(candidate, hand.point, frame) <
          radius + BUBBLES_HAND_HIT_RADIUS + SPAWN_HAND_CLEARANCE,
      );
      if (!overlapsBubble && !overlapsHand) {
        break;
      }
    }
    const velocity = this.targetVelocity(radius);
    return {
      id: this.nextBubbleId++,
      point,
      radius,
      velocity,
      targetVelocity: { ...velocity },
      hue: this.randomBetween(175, 340),
      shimmerPhase: this.randomBetween(0, Math.PI * 2),
      spawnedAtMs: nowMs,
      retargetAtMs: nowMs + this.randomBetween(RETARGET_MIN_MS, RETARGET_MAX_MS),
      state: "active",
      poppedAtMs: null,
      poppedBy: null,
    };
  }

  private collectHands(players: readonly BubblesPlayerInput[]): BubblesHandSnapshot[] {
    const hands: BubblesHandSnapshot[] = [];
    for (const player of players) {
      for (const hand of ["left", "right"] as const) {
        const point = player.hands[hand];
        if (point !== null && pointInsideFrame(point)) {
          hands.push({ side: player.side, hand, point: { ...point } });
        }
      }
    }
    return hands;
  }

  private resolveCollisions(sampleAtMs: number, receivedAtMs: number): void {
    const frame = this.frame;
    if (frame === null) {
      return;
    }
    for (const bubble of this.bubbles) {
      if (bubble.state !== "active") {
        continue;
      }
      const bubblePoint = arenaPoint(bubble.point, frame);
      let winner: CollisionCandidate | null = null;
      for (const hand of this.latestHands) {
        const current = arenaPoint(hand.point, frame);
        const previous = this.handHistory.get(handKey(hand.side, hand.hand));
        let distance = Math.hypot(bubblePoint.x - current.x, bubblePoint.y - current.y);
        if (
          previous !== undefined &&
          sampleAtMs > previous.sampleAtMs &&
          sampleAtMs - previous.sampleAtMs <= HAND_SAMPLE_FRESH_MS &&
          frameNormalizedDistance(previous.point, hand.point, frame) <= MAXIMUM_HAND_SWEEP_DISTANCE
        ) {
          distance = pointToSegmentDistance(
            bubblePoint,
            arenaPoint(previous.point, frame),
            current,
          );
        }
        if (distance > bubble.radius + BUBBLES_HAND_HIT_RADIUS) {
          continue;
        }
        const candidate = { side: hand.side, hand: hand.hand, distance };
        if (winner === null || candidateComesFirst(candidate, winner)) {
          winner = candidate;
        }
      }
      if (winner !== null) {
        this.popBubble(bubble, winner.side, receivedAtMs);
      }
    }
  }

  private updateHandHistory(sampleAtMs: number): void {
    const currentKeys = new Set<string>();
    for (const hand of this.latestHands) {
      const key = handKey(hand.side, hand.hand);
      currentKeys.add(key);
      this.handHistory.set(key, { point: { ...hand.point }, sampleAtMs });
    }
    for (const key of this.handHistory.keys()) {
      if (!currentKeys.has(key)) {
        this.handHistory.delete(key);
      }
    }
  }

  private popBubble(bubble: BubbleStateModel, side: BubblesPlayerSide, nowMs: number): void {
    const scoreSide = this.playerCount === 1 ? "right" : side;
    bubble.state = "popping";
    bubble.poppedAtMs = nowMs;
    bubble.poppedBy = scoreSide;
    this.scores[scoreSide] += 1;
    this.lastPopAtMs[scoreSide] = nowMs;
    this.respawnAtMs.push(
      nowMs + this.randomBetween(BUBBLES_RESPAWN_MIN_MS, BUBBLES_RESPAWN_MAX_MS),
    );
  }

  private advance(nowMs: number): void {
    if (!this.enabled || this.pausedAtMs !== null) {
      return;
    }
    const previousAdvancedAtMs = this.lastAdvancedAtMs;
    this.lastAdvancedAtMs = nowMs;

    if (
      this.phase === "starting" &&
      this.roundStartedAtMs !== null &&
      nowMs >= this.roundStartedAtMs
    ) {
      this.phase = "playing";
      this.handHistory.clear();
      this.lastInputSampleAtMs = null;
    }
    if (
      this.phase === "playing" &&
      this.roundStartedAtMs !== null &&
      nowMs >= this.roundStartedAtMs + BUBBLES_ROUND_DURATION_MS
    ) {
      this.finishRound();
      return;
    }
    if (this.phase !== "starting" && this.phase !== "playing") {
      return;
    }

    const elapsedMs =
      previousAdvancedAtMs === null
        ? 0
        : clamp(nowMs - previousAdvancedAtMs, 0, MAXIMUM_MOVEMENT_DELTA_MS);
    if (elapsedMs > 0) {
      this.moveBubbles(elapsedMs, nowMs);
    }
    if (this.phase === "playing") {
      this.removeCompletedPops(nowMs);
      this.spawnDueReplacements(nowMs);
    }
  }

  private moveBubbles(elapsedMs: number, nowMs: number): void {
    const frame = this.frame;
    if (frame === null) {
      return;
    }
    const elapsedSeconds = elapsedMs / 1_000;
    const velocityAlpha = 1 - Math.exp(-elapsedMs / VELOCITY_EASING_MS);
    for (const bubble of this.bubbles) {
      if (bubble.state !== "active") {
        continue;
      }
      if (nowMs >= bubble.retargetAtMs) {
        bubble.targetVelocity = this.targetVelocity(bubble.radius);
        bubble.retargetAtMs = nowMs + this.randomBetween(RETARGET_MIN_MS, RETARGET_MAX_MS);
      }
      this.applyEdgeSteering(bubble, frame);
      bubble.velocity.x += (bubble.targetVelocity.x - bubble.velocity.x) * velocityAlpha;
      bubble.velocity.y += (bubble.targetVelocity.y - bubble.velocity.y) * velocityAlpha;
      const delta = normalizedVelocityDelta(bubble.velocity, elapsedSeconds, frame);
      bubble.point.x += delta.x;
      bubble.point.y += delta.y;
      this.clampAndReflect(bubble, frame, nowMs);
    }
  }

  private applyEdgeSteering(bubble: BubbleStateModel, frame: Size): void {
    const axes = radiusAxes(bubble.radius, frame);
    const steeringX = (EDGE_STEERING_DISTANCE * Math.min(frame.width, frame.height)) / frame.width;
    const steeringY = (EDGE_STEERING_DISTANCE * Math.min(frame.width, frame.height)) / frame.height;
    if (bubble.point.x - axes.x < steeringX) {
      bubble.targetVelocity.x = Math.abs(bubble.targetVelocity.x);
    } else if (1 - axes.x - bubble.point.x < steeringX) {
      bubble.targetVelocity.x = -Math.abs(bubble.targetVelocity.x);
    }
    if (bubble.point.y - axes.y < steeringY) {
      bubble.targetVelocity.y = Math.abs(bubble.targetVelocity.y);
    } else if (1 - axes.y - bubble.point.y < steeringY) {
      bubble.targetVelocity.y = -Math.abs(bubble.targetVelocity.y);
    }
  }

  private clampAndReflect(bubble: BubbleStateModel, frame: Size, nowMs: number): void {
    const axes = radiusAxes(bubble.radius, frame);
    let horizontalDirection: -1 | 0 | 1 = 0;
    let verticalDirection: -1 | 0 | 1 = 0;
    if (bubble.point.x < axes.x) {
      bubble.point.x = axes.x;
      horizontalDirection = 1;
    } else if (bubble.point.x > 1 - axes.x) {
      bubble.point.x = 1 - axes.x;
      horizontalDirection = -1;
    }
    if (bubble.point.y < axes.y) {
      bubble.point.y = axes.y;
      verticalDirection = 1;
    } else if (bubble.point.y > 1 - axes.y) {
      bubble.point.y = 1 - axes.y;
      verticalDirection = -1;
    }
    if (horizontalDirection === 0 && verticalDirection === 0) {
      return;
    }

    let velocity = {
      x:
        horizontalDirection === 0
          ? bubble.velocity.x
          : Math.abs(bubble.velocity.x) * horizontalDirection,
      y:
        verticalDirection === 0
          ? bubble.velocity.y
          : Math.abs(bubble.velocity.y) * verticalDirection,
    };
    const variation = (this.random() - 0.5) * BOUNCE_VARIATION_RADIANS;
    const cosine = Math.cos(variation);
    const sine = Math.sin(variation);
    velocity = {
      x: velocity.x * cosine - velocity.y * sine,
      y: velocity.x * sine + velocity.y * cosine,
    };
    if (horizontalDirection !== 0) {
      velocity.x = Math.abs(velocity.x) * horizontalDirection;
    }
    if (verticalDirection !== 0) {
      velocity.y = Math.abs(velocity.y) * verticalDirection;
    }
    bubble.velocity = velocity;
    bubble.targetVelocity = { ...velocity };
    bubble.retargetAtMs = nowMs + this.randomBetween(RETARGET_MIN_MS, RETARGET_MAX_MS);
  }

  private clampAllBubbles(nowMs: number): void {
    const frame = this.frame;
    if (frame === null) {
      return;
    }
    for (const bubble of this.bubbles) {
      this.clampAndReflect(bubble, frame, nowMs);
    }
  }

  private removeCompletedPops(nowMs: number): void {
    for (let index = this.bubbles.length - 1; index >= 0; index -= 1) {
      const bubble = this.bubbles[index];
      if (
        bubble?.state === "popping" &&
        bubble.poppedAtMs !== null &&
        nowMs - bubble.poppedAtMs >= BUBBLES_POP_DURATION_MS
      ) {
        this.bubbles.splice(index, 1);
      }
    }
  }

  private spawnDueReplacements(nowMs: number): void {
    this.respawnAtMs.sort((left, right) => left - right);
    while (this.respawnAtMs[0] !== undefined && this.respawnAtMs[0] <= nowMs) {
      this.respawnAtMs.shift();
      this.bubbles.push(this.createBubble(nowMs));
    }
  }

  private finishRound(): void {
    this.phase = "finished";
    this.bubbles.splice(
      0,
      this.bubbles.length,
      ...this.bubbles.filter((bubble) => bubble.state === "active"),
    );
    this.respawnAtMs.length = 0;
    this.handHistory.clear();
    this.lastInputSampleAtMs = null;
    this.result =
      this.playerCount === 1
        ? { type: "score", score: this.scores.right }
        : {
            type: "winner",
            winner:
              this.scores.left === this.scores.right
                ? "tie"
                : this.scores.left > this.scores.right
                  ? "left"
                  : "right",
            leftScore: this.scores.left,
            rightScore: this.scores.right,
          };
  }

  private snapshot(nowMs: number): BubblesSnapshot {
    const effectiveNowMs = this.pausedAtMs ?? nowMs;
    const startingRemainingMs =
      this.phase === "starting" && this.roundStartedAtMs !== null
        ? Math.max(0, this.roundStartedAtMs - effectiveNowMs)
        : 0;
    const roundElapsedMs =
      (this.phase === "playing" || this.phase === "finished") && this.roundStartedAtMs !== null
        ? clamp(effectiveNowMs - this.roundStartedAtMs, 0, BUBBLES_ROUND_DURATION_MS)
        : 0;
    const roundRemainingMs =
      this.phase === "finished"
        ? 0
        : this.phase === "playing"
          ? BUBBLES_ROUND_DURATION_MS - roundElapsedMs
          : BUBBLES_ROUND_DURATION_MS;
    return {
      phase: this.phase,
      paused: this.pausedAtMs !== null,
      playerCount: this.playerCount,
      visiblePlayers: this.visiblePlayers,
      readyToStart: this.readyToStart(),
      scores: { ...this.scores },
      startingRemainingMs,
      roundRemainingMs,
      roundElapsedMs,
      bubbles: this.bubbles.map((bubble) => ({
        id: bubble.id,
        point: { ...bubble.point },
        radius: bubble.radius,
        velocity: { ...bubble.velocity },
        hue: bubble.hue,
        shimmerPhase: bubble.shimmerPhase,
        spawnedAtMs: bubble.spawnedAtMs,
        state: bubble.state,
        poppedAtMs: bubble.poppedAtMs,
        poppedBy: bubble.poppedBy,
      })),
      hands: this.latestHands.map((hand) => ({ ...hand, point: { ...hand.point } })),
      result: this.result,
      lastPopAtMs: { ...this.lastPopAtMs },
      nowMs: effectiveNowMs,
    };
  }
}

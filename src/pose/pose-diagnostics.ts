import type { PosePacket } from "../domain/pose";
import {
  coarseHand,
  COARSE_HAND_LANDMARK_NAMES,
  type CoarseHandLandmarkName,
  type PoseHand,
  type PosePoint,
} from "../domain/pose-features";
import type { PoseLimit } from "../domain/pose-limit";

export const POSE_DIAGNOSTICS_PUBLISH_INTERVAL_MS = 500;
export const POSE_DIAGNOSTICS_WINDOW_MS = 2_000;

export interface HandSpreadDiagnostics {
  sampleCount: number;
  windowMs: number;
  centerP95Px: number;
  worstLandmark: CoarseHandLandmarkName;
  worstLandmarkP95Px: number;
}

export interface PoseDiagnosticsSnapshot {
  frame: { width: number; height: number } | null;
  cameraFramesPerSecond: number | null;
  inferenceSubmissionsPerSecond: number | null;
  inferenceCompletionsPerSecond: number | null;
  processingMedianMs: number | null;
  processingP95Ms: number | null;
  leftHand: HandSpreadDiagnostics | null;
  rightHand: HandSpreadDiagnostics | null;
}

interface TimedValue {
  atMs: number;
  value: number;
}

interface HandSample {
  atMs: number;
  center: PosePoint;
  landmarks: Readonly<Record<CoarseHandLandmarkName, PosePoint>>;
}

const MINIMUM_RATE_WINDOW_MS = 500;
const MINIMUM_SPREAD_SAMPLES = 5;

function trimTimes(values: number[], minimumAtMs: number): void {
  const firstRetained = values.findIndex((value) => value >= minimumAtMs);
  if (firstRetained === -1) {
    values.length = 0;
  } else if (firstRetained > 0) {
    values.splice(0, firstRetained);
  }
}

function trimTimed<T extends { atMs: number }>(values: T[], minimumAtMs: number): void {
  const firstRetained = values.findIndex(({ atMs }) => atMs >= minimumAtMs);
  if (firstRetained === -1) {
    values.length = 0;
  } else if (firstRetained > 0) {
    values.splice(0, firstRetained);
  }
}

function sorted(values: readonly number[]): number[] {
  return [...values].sort((left, right) => left - right);
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const ordered = sorted(values);
  const middle = Math.floor(ordered.length / 2);
  const upper = ordered[middle];
  if (upper === undefined) {
    return null;
  }
  if (ordered.length % 2 === 1) {
    return upper;
  }
  const lower = ordered[middle - 1];
  return lower === undefined ? upper : (lower + upper) / 2;
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const ordered = sorted(values);
  return ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? null;
}

function eventRate(events: readonly number[]): number | null {
  const first = events[0];
  const last = events.at(-1);
  if (first === undefined || last === undefined || events.length < 2) {
    return null;
  }
  const elapsedMs = last - first;
  return elapsedMs >= MINIMUM_RATE_WINDOW_MS ? ((events.length - 1) * 1_000) / elapsedMs : null;
}

function medianPoint(points: readonly PosePoint[]): PosePoint | null {
  const x = median(points.map((point) => point.x));
  const y = median(points.map((point) => point.y));
  return x === null || y === null ? null : { x, y };
}

function pointSpread95Px(
  points: readonly PosePoint[],
  frame: { width: number; height: number },
): number | null {
  const center = medianPoint(points);
  if (center === null) {
    return null;
  }
  return percentile95(
    points.map((point) =>
      Math.hypot((point.x - center.x) * frame.width, (point.y - center.y) * frame.height),
    ),
  );
}

function handSpread(
  samples: readonly HandSample[],
  frame: { width: number; height: number },
): HandSpreadDiagnostics | null {
  const first = samples[0];
  const last = samples.at(-1);
  if (first === undefined || last === undefined || samples.length < MINIMUM_SPREAD_SAMPLES) {
    return null;
  }
  const centerP95Px = pointSpread95Px(
    samples.map((sample) => sample.center),
    frame,
  );
  if (centerP95Px === null) {
    return null;
  }

  let worstLandmark: CoarseHandLandmarkName = "wrist";
  let worstLandmarkP95Px = -1;
  for (const landmarkName of COARSE_HAND_LANDMARK_NAMES) {
    const spread = pointSpread95Px(
      samples.map((sample) => sample.landmarks[landmarkName]),
      frame,
    );
    if (spread !== null && spread > worstLandmarkP95Px) {
      worstLandmark = landmarkName;
      worstLandmarkP95Px = spread;
    }
  }

  return {
    sampleCount: samples.length,
    windowMs: last.atMs - first.atMs,
    centerP95Px,
    worstLandmark,
    worstLandmarkP95Px: Math.max(0, worstLandmarkP95Px),
  };
}

export class PoseDiagnosticsMonitor {
  private readonly cameraFrames: number[] = [];
  private readonly inferenceSubmissions: number[] = [];
  private readonly inferenceCompletions: number[] = [];
  private readonly processingAges: TimedValue[] = [];
  private readonly hands: Record<PoseHand, HandSample[]> = { left: [], right: [] };
  private frame: { width: number; height: number } | null = null;

  public recordCameraFrame(atMs: number): void {
    this.cameraFrames.push(atMs);
    this.trim(atMs);
  }

  public recordInferenceSubmission(atMs: number): void {
    this.inferenceSubmissions.push(atMs);
    this.trim(atMs);
  }

  public recordInferenceCompletion(
    packet: PosePacket,
    completedAtMs: number,
    poseLimit: PoseLimit,
  ): void {
    this.inferenceCompletions.push(completedAtMs);
    this.processingAges.push({
      atMs: completedAtMs,
      value: Math.max(0, completedAtMs - packet.capturedAtMs),
    });

    if (
      this.frame === null ||
      this.frame.width !== packet.frame.width ||
      this.frame.height !== packet.frame.height
    ) {
      this.frame = { ...packet.frame };
      this.clearHands();
    }

    if (poseLimit !== 1 || packet.poses.length !== 1) {
      this.clearHands();
      this.trim(completedAtMs);
      return;
    }

    const pose = packet.poses[0];
    if (pose === undefined) {
      this.clearHands();
      this.trim(completedAtMs);
      return;
    }

    for (const hand of ["left", "right"] as const) {
      const feature = coarseHand(pose, hand);
      if (feature === null) {
        this.hands[hand].length = 0;
        continue;
      }
      this.hands[hand].push({
        atMs: packet.capturedAtMs,
        center: { ...feature.center },
        landmarks: {
          wrist: { x: feature.landmarks.wrist.x, y: feature.landmarks.wrist.y },
          pinky: { x: feature.landmarks.pinky.x, y: feature.landmarks.pinky.y },
          index: { x: feature.landmarks.index.x, y: feature.landmarks.index.y },
          thumb: { x: feature.landmarks.thumb.x, y: feature.landmarks.thumb.y },
        },
      });
    }
    this.trim(completedAtMs);
  }

  public snapshot(nowMs: number): PoseDiagnosticsSnapshot {
    this.trim(nowMs);
    const processingValues = this.processingAges.map(({ value }) => value);
    return {
      frame: this.frame === null ? null : { ...this.frame },
      cameraFramesPerSecond: eventRate(this.cameraFrames),
      inferenceSubmissionsPerSecond: eventRate(this.inferenceSubmissions),
      inferenceCompletionsPerSecond: eventRate(this.inferenceCompletions),
      processingMedianMs: median(processingValues),
      processingP95Ms: percentile95(processingValues),
      leftHand: this.frame === null ? null : handSpread(this.hands.left, this.frame),
      rightHand: this.frame === null ? null : handSpread(this.hands.right, this.frame),
    };
  }

  public reset(): void {
    this.cameraFrames.length = 0;
    this.inferenceSubmissions.length = 0;
    this.inferenceCompletions.length = 0;
    this.processingAges.length = 0;
    this.clearHands();
    this.frame = null;
  }

  private trim(nowMs: number): void {
    const minimumAtMs = nowMs - POSE_DIAGNOSTICS_WINDOW_MS;
    trimTimes(this.cameraFrames, minimumAtMs);
    trimTimes(this.inferenceSubmissions, minimumAtMs);
    trimTimes(this.inferenceCompletions, minimumAtMs);
    trimTimed(this.processingAges, minimumAtMs);
    trimTimed(this.hands.left, minimumAtMs);
    trimTimed(this.hands.right, minimumAtMs);
  }

  private clearHands(): void {
    this.hands.left.length = 0;
    this.hands.right.length = 0;
  }
}

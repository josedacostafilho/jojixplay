import type { Point, Size } from "../render/geometry";

export interface StationaryHoldOptions {
  dwellMs: number;
  radius: number;
  excursionGraceMs: number;
  maximumExcursionRatio: number;
  maximumSampleGapMs: number;
}

export interface StationaryHoldUpdate {
  completed: boolean;
  progress: number;
}

interface Candidate {
  anchor: Point;
  startedAtMs: number;
  lastSampleAtMs: number;
  lastSampleInRegion: boolean;
  excursionDurationMs: number;
}

interface Excursion {
  anchor: Point;
  startedAtMs: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function frameDistance(left: Point, right: Point, frame: Size): number {
  const minimumDimension = Math.min(frame.width, frame.height);
  return Math.hypot(
    ((left.x - right.x) * frame.width) / minimumDimension,
    ((left.y - right.y) * frame.height) / minimumDimension,
  );
}

function validateOptions(options: StationaryHoldOptions): StationaryHoldOptions {
  if (
    !Number.isFinite(options.dwellMs) ||
    options.dwellMs <= 0 ||
    !Number.isFinite(options.radius) ||
    options.radius <= 0 ||
    !Number.isFinite(options.excursionGraceMs) ||
    options.excursionGraceMs <= 0 ||
    options.excursionGraceMs >= options.dwellMs ||
    !Number.isFinite(options.maximumExcursionRatio) ||
    options.maximumExcursionRatio < 0 ||
    options.maximumExcursionRatio >= 1 ||
    !Number.isFinite(options.maximumSampleGapMs) ||
    options.maximumSampleGapMs <= 0
  ) {
    throw new Error("Stationary-hold options are invalid.");
  }
  return { ...options };
}

export class StationaryHoldTracker {
  private readonly options: StationaryHoldOptions;
  private candidate: Candidate | null = null;
  private excursion: Excursion | null = null;
  private latchedValue = false;
  private progressValue = 0;

  public constructor(options: StationaryHoldOptions) {
    this.options = validateOptions(options);
  }

  public get hasCandidate(): boolean {
    return this.candidate !== null;
  }

  public get latched(): boolean {
    return this.latchedValue;
  }

  public get progress(): number {
    return this.progressValue;
  }

  public update(point: Point, sampleAtMs: number, frame: Size): StationaryHoldUpdate {
    const candidate = this.candidate;
    if (
      candidate === null ||
      sampleAtMs <= candidate.lastSampleAtMs ||
      sampleAtMs - candidate.lastSampleAtMs > this.options.maximumSampleGapMs
    ) {
      this.startCandidate(point, sampleAtMs);
      return this.result(false);
    }

    const elapsedSinceLastSample = sampleAtMs - candidate.lastSampleAtMs;
    if (!candidate.lastSampleInRegion) {
      candidate.excursionDurationMs += elapsedSinceLastSample;
    }
    candidate.lastSampleAtMs = sampleAtMs;

    const inCandidateRegion = frameDistance(candidate.anchor, point, frame) <= this.options.radius;
    candidate.lastSampleInRegion = inCandidateRegion;
    if (inCandidateRegion) {
      this.excursion = null;
      return this.evaluateCompletion(sampleAtMs, true);
    }

    if (
      this.excursion === null ||
      frameDistance(this.excursion.anchor, point, frame) > this.options.radius
    ) {
      this.excursion = { anchor: { ...point }, startedAtMs: sampleAtMs };
    } else if (sampleAtMs - this.excursion.startedAtMs >= this.options.excursionGraceMs) {
      const promotedExcursion = this.excursion;
      this.candidate = {
        anchor: { ...promotedExcursion.anchor },
        startedAtMs: promotedExcursion.startedAtMs,
        lastSampleAtMs: sampleAtMs,
        lastSampleInRegion: true,
        excursionDurationMs: 0,
      };
      this.excursion = null;
      this.latchedValue = false;
      return this.evaluateCompletion(sampleAtMs, true);
    }

    this.updateProgress(sampleAtMs, false);
    return this.result(false);
  }

  public reset(): void {
    this.candidate = null;
    this.excursion = null;
    this.latchedValue = false;
    this.progressValue = 0;
  }

  private startCandidate(point: Point, sampleAtMs: number): void {
    this.candidate = {
      anchor: { ...point },
      startedAtMs: sampleAtMs,
      lastSampleAtMs: sampleAtMs,
      lastSampleInRegion: true,
      excursionDurationMs: 0,
    };
    this.excursion = null;
    this.latchedValue = false;
    this.progressValue = 0;
  }

  private evaluateCompletion(
    sampleAtMs: number,
    currentSampleInRegion: boolean,
  ): StationaryHoldUpdate {
    const candidate = this.candidate;
    if (candidate === null || this.latchedValue) {
      this.progressValue = 0;
      return this.result(false);
    }

    const elapsedMs = sampleAtMs - candidate.startedAtMs;
    const excursionRatio = elapsedMs <= 0 ? 0 : candidate.excursionDurationMs / elapsedMs;
    if (elapsedMs >= this.options.dwellMs) {
      if (currentSampleInRegion && excursionRatio <= this.options.maximumExcursionRatio) {
        this.latchedValue = true;
        this.progressValue = 0;
        return this.result(true);
      }
      this.startCandidate(candidate.anchor, sampleAtMs);
      return this.result(false);
    }

    this.updateProgress(sampleAtMs, currentSampleInRegion);
    return this.result(false);
  }

  private updateProgress(sampleAtMs: number, currentSampleInRegion: boolean): void {
    const candidate = this.candidate;
    if (candidate === null || this.latchedValue) {
      this.progressValue = 0;
      return;
    }
    const rawProgress = (sampleAtMs - candidate.startedAtMs) / this.options.dwellMs;
    this.progressValue = currentSampleInRegion
      ? clamp(rawProgress, 0, 1)
      : clamp(rawProgress, 0, 0.99);
  }

  private result(completed: boolean): StationaryHoldUpdate {
    return { completed, progress: this.progressValue };
  }
}

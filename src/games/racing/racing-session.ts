import type {
  RacingDriverObservation,
  RacingInputSnapshot,
  RacingPlayerSlot,
} from "./racing-input";
import { RACING_TRACK, racingTrackCurveAt } from "./racing-track";

export const RACING_COUNTDOWN_MS = 3_000;
export const RACING_FIXED_STEP_MS = 1_000 / 60;
export const RACING_INPUT_GRACE_MS = 150;
export const RACING_STEERING_DEAD_ZONE_RADIANS = (5 * Math.PI) / 180;
export const RACING_FULL_STEERING_RADIANS = (28 * Math.PI) / 180;

const RACING_MAX_CATCH_UP_STEPS = 6;
const RACING_FIXED_STEP_EPSILON_MS = 1e-7;
const RACING_STEERING_TIME_CONSTANT_MS = 80;
const RACING_CENTER_TIME_CONSTANT_MS = 120;
const RACING_MAX_SPEED = 52;
const RACING_OFF_ROAD_MAX_SPEED = 29;
const RACING_ACCELERATION = 13;
const RACING_OFF_ROAD_DECELERATION = 20;
const RACING_STEERING_RATE = 1.15;
const RACING_CURVE_DRIFT = 360;
const RACING_MAX_LATERAL = 1.65;
const RACING_CALIBRATION_INPUT_FRESH_MS = 250;

export type RacingPhase = "ready" | "starting" | "racing" | "paused" | "finished";
export type RacingCalibrationPurpose = "new-race" | "recenter";

export type RacingResult =
  | { type: "time"; elapsedMs: number }
  | {
      type: "winner";
      winner: "left" | "right" | "tie";
      leftTimeMs: number | null;
      rightTimeMs: number | null;
    };

export interface RacingCarSnapshot {
  slot: RacingPlayerSlot;
  distance: number;
  lateral: number;
  speed: number;
  steering: number;
  trackingAvailable: boolean;
  progress: number;
  finishedAtMs: number | null;
}

export interface RacingSnapshot {
  enabled: boolean;
  playerCount: 1 | 2;
  phase: RacingPhase;
  paused: boolean;
  orientationPaused: boolean;
  systemPaused: boolean;
  readyToStart: boolean;
  visibleDrivers: number;
  completeDrivers: number;
  wheelReadyDrivers: number;
  calibrationPurpose: RacingCalibrationPurpose | null;
  startingRemainingMs: number;
  elapsedMs: number;
  trackLength: number;
  cars: readonly RacingCarSnapshot[];
  result: RacingResult | null;
}

interface MutableInput {
  complete: boolean;
  wheelValid: boolean;
  wheelAngleRadians: number | null;
  lastObservedAtMs: number;
  lastValidAtMs: number | null;
  targetSteering: number;
}

interface MutableCar {
  slot: RacingPlayerSlot;
  distance: number;
  lateral: number;
  speed: number;
  steering: number;
  finishedAtMs: number | null;
}

function slotsFor(playerCount: 1 | 2): readonly RacingPlayerSlot[] {
  return playerCount === 1 ? ["solo"] : ["left", "right"];
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function steeringFromAngle(angle: number, neutral: number): number {
  const relative = angle - neutral;
  const magnitude = Math.abs(relative);
  if (magnitude <= RACING_STEERING_DEAD_ZONE_RADIANS) {
    return 0;
  }
  const range = RACING_FULL_STEERING_RADIANS - RACING_STEERING_DEAD_ZONE_RADIANS;
  return Math.sign(relative) * clamp((magnitude - RACING_STEERING_DEAD_ZONE_RADIANS) / range, 0, 1);
}

function createCar(slot: RacingPlayerSlot): MutableCar {
  return {
    slot,
    distance: 0,
    lateral: 0,
    speed: 0,
    steering: 0,
    finishedAtMs: null,
  };
}

export class RacingSession {
  private enabled = false;
  private playerCount: 1 | 2 = 1;
  private corePhase: Exclude<RacingPhase, "paused"> = "ready";
  private userPaused = false;
  private orientationPaused = false;
  private systemPaused = false;
  private calibrationPurpose: RacingCalibrationPurpose | null = null;
  private calibrationElapsedMs = 0;
  private calibrationSamples = new Map<RacingPlayerSlot, number[]>();
  private neutralAngles = new Map<RacingPlayerSlot, number>();
  private inputs = new Map<RacingPlayerSlot, MutableInput>();
  private cars = new Map<RacingPlayerSlot, MutableCar>();
  private visibleDrivers = 0;
  private completeDrivers = 0;
  private elapsedMs = 0;
  private accumulatorMs = 0;
  private lastTickAtMs: number | null = null;
  private result: RacingResult | null = null;

  public setEnabled(enabled: boolean, playerCount: 1 | 2, nowMs: number): RacingSnapshot {
    this.enabled = enabled;
    this.playerCount = playerCount;
    this.resetRound(nowMs);
    return this.snapshot(nowMs);
  }

  public updateDrivers(input: RacingInputSnapshot, nowMs: number): RacingSnapshot {
    this.visibleDrivers = input.visibleDrivers;
    this.completeDrivers = input.completeDrivers;
    const observedSlots = new Set<RacingPlayerSlot>();
    for (const observation of input.observations) {
      if (!slotsFor(this.playerCount).includes(observation.slot)) {
        continue;
      }
      observedSlots.add(observation.slot);
      this.updateDriver(observation, nowMs);
    }
    for (const [slot, current] of this.inputs) {
      if (!observedSlots.has(slot)) {
        current.complete = false;
        current.wheelValid = false;
        current.wheelAngleRadians = null;
        current.lastObservedAtMs = nowMs;
      }
    }
    return this.snapshot(nowMs);
  }

  public start(nowMs: number): { started: boolean; snapshot: RacingSnapshot } {
    if (!this.enabled || this.corePhase !== "ready" || !this.readyToStart()) {
      return { started: false, snapshot: this.snapshot(nowMs) };
    }
    this.beginCalibration("new-race", nowMs);
    return { started: true, snapshot: this.snapshot(nowMs) };
  }

  public requestUserPause(nowMs: number): RacingSnapshot {
    if (this.enabled && this.corePhase === "racing" && !this.userPaused) {
      this.userPaused = true;
      this.lastTickAtMs = nowMs;
      this.accumulatorMs = 0;
    }
    return this.snapshot(nowMs);
  }

  public resume(nowMs: number): RacingSnapshot {
    if (this.userPaused && this.corePhase === "racing") {
      this.userPaused = false;
      this.lastTickAtMs = nowMs;
      this.accumulatorMs = 0;
    }
    return this.snapshot(nowMs);
  }

  public recenter(nowMs: number): RacingSnapshot {
    if (this.userPaused && this.corePhase === "racing") {
      this.userPaused = false;
      this.beginCalibration("recenter", nowMs);
    }
    return this.snapshot(nowMs);
  }

  public restart(nowMs: number): RacingSnapshot {
    this.resetRound(nowMs);
    return this.snapshot(nowMs);
  }

  public setOrientationPaused(paused: boolean, nowMs: number): RacingSnapshot {
    if (this.orientationPaused !== paused) {
      this.orientationPaused = paused;
      this.lastTickAtMs = nowMs;
      this.accumulatorMs = 0;
      if (paused) {
        for (const input of this.inputs.values()) {
          input.wheelValid = false;
          input.wheelAngleRadians = null;
          input.lastValidAtMs = null;
          input.targetSteering = 0;
        }
      }
    }
    return this.snapshot(nowMs);
  }

  public setSystemPaused(paused: boolean, nowMs: number): RacingSnapshot {
    if (this.systemPaused !== paused) {
      this.systemPaused = paused;
      this.lastTickAtMs = nowMs;
      this.accumulatorMs = 0;
    }
    return this.snapshot(nowMs);
  }

  public tick(nowMs: number): RacingSnapshot {
    if (this.lastTickAtMs === null) {
      this.lastTickAtMs = nowMs;
      return this.snapshot(nowMs);
    }
    const elapsedSinceTick = Math.max(0, nowMs - this.lastTickAtMs);
    this.lastTickAtMs = nowMs;
    if (!this.enabled || this.userPaused || this.orientationPaused || this.systemPaused) {
      this.accumulatorMs = 0;
      return this.snapshot(nowMs);
    }

    if (this.corePhase === "starting") {
      if (this.allWheelInputsFresh(nowMs)) {
        this.calibrationElapsedMs = Math.min(
          RACING_COUNTDOWN_MS,
          this.calibrationElapsedMs + Math.min(elapsedSinceTick, 100),
        );
      }
      if (this.calibrationElapsedMs >= RACING_COUNTDOWN_MS && this.finishCalibration()) {
        this.corePhase = "racing";
        this.calibrationPurpose = null;
        this.accumulatorMs = 0;
      }
      return this.snapshot(nowMs);
    }

    if (this.corePhase !== "racing") {
      return this.snapshot(nowMs);
    }
    this.accumulatorMs += Math.min(
      elapsedSinceTick,
      RACING_FIXED_STEP_MS * RACING_MAX_CATCH_UP_STEPS,
    );
    let steps = 0;
    while (
      this.accumulatorMs >= RACING_FIXED_STEP_MS - RACING_FIXED_STEP_EPSILON_MS &&
      steps < RACING_MAX_CATCH_UP_STEPS &&
      this.corePhase === "racing"
    ) {
      this.step(RACING_FIXED_STEP_MS / 1_000, nowMs);
      this.accumulatorMs = Math.max(0, this.accumulatorMs - RACING_FIXED_STEP_MS);
      steps += 1;
    }
    if (steps >= RACING_MAX_CATCH_UP_STEPS) {
      this.accumulatorMs = 0;
    }
    return this.snapshot(nowMs);
  }

  public getSnapshot(nowMs: number): RacingSnapshot {
    return this.snapshot(nowMs);
  }

  private updateDriver(observation: RacingDriverObservation, nowMs: number): void {
    const current = this.inputs.get(observation.slot) ?? {
      complete: false,
      wheelValid: false,
      wheelAngleRadians: null,
      lastObservedAtMs: nowMs,
      lastValidAtMs: null,
      targetSteering: 0,
    };
    current.complete = observation.complete;
    current.wheelValid = observation.wheelValid;
    current.wheelAngleRadians = observation.wheelAngleRadians;
    current.lastObservedAtMs = nowMs;
    if (observation.wheelValid && observation.wheelAngleRadians !== null) {
      current.lastValidAtMs = nowMs;
      if (this.corePhase === "starting") {
        const samples = this.calibrationSamples.get(observation.slot) ?? [];
        samples.push(observation.wheelAngleRadians);
        if (samples.length > 120) {
          samples.shift();
        }
        this.calibrationSamples.set(observation.slot, samples);
      } else if (this.corePhase === "racing") {
        const neutral = this.neutralAngles.get(observation.slot);
        if (neutral !== undefined) {
          current.targetSteering = steeringFromAngle(observation.wheelAngleRadians, neutral);
        }
      }
    }
    this.inputs.set(observation.slot, current);
  }

  private beginCalibration(purpose: RacingCalibrationPurpose, nowMs: number): void {
    if (purpose === "new-race") {
      this.cars = new Map(slotsFor(this.playerCount).map((slot) => [slot, createCar(slot)]));
      this.elapsedMs = 0;
      this.result = null;
    }
    this.corePhase = "starting";
    this.userPaused = false;
    this.calibrationPurpose = purpose;
    this.calibrationElapsedMs = 0;
    this.calibrationSamples.clear();
    this.neutralAngles.clear();
    this.accumulatorMs = 0;
    this.lastTickAtMs = nowMs;
    for (const input of this.inputs.values()) {
      input.lastValidAtMs = null;
      input.targetSteering = 0;
    }
    for (const car of this.cars.values()) {
      car.steering = 0;
    }
  }

  private finishCalibration(): boolean {
    for (const slot of slotsFor(this.playerCount)) {
      const samples = this.calibrationSamples.get(slot);
      if (samples === undefined || samples.length === 0) {
        return false;
      }
      this.neutralAngles.set(
        slot,
        samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
      );
      const input = this.inputs.get(slot);
      if (input !== undefined) {
        input.targetSteering = 0;
      }
    }
    return true;
  }

  private allWheelInputsFresh(nowMs: number): boolean {
    return slotsFor(this.playerCount).every((slot) => {
      const input = this.inputs.get(slot);
      return (
        input?.wheelValid &&
        input.wheelAngleRadians !== null &&
        input.lastValidAtMs !== null &&
        nowMs - input.lastValidAtMs <= RACING_CALIBRATION_INPUT_FRESH_MS
      );
    });
  }

  private readyToStart(): boolean {
    return this.completeDrivers >= this.playerCount;
  }

  private step(deltaSeconds: number, nowMs: number): void {
    const stepStartElapsedMs = this.elapsedMs;
    const stepDurationMs = deltaSeconds * 1_000;
    const finishers: Array<{ slot: RacingPlayerSlot; timeMs: number }> = [];
    for (const slot of slotsFor(this.playerCount)) {
      const car = this.cars.get(slot);
      if (car === undefined || car.finishedAtMs !== null) {
        continue;
      }
      const input = this.inputs.get(slot);
      const trackingAvailable =
        input?.lastValidAtMs !== null &&
        input?.lastValidAtMs !== undefined &&
        nowMs - input.lastValidAtMs <= RACING_INPUT_GRACE_MS;
      const targetSteering = trackingAvailable ? (input?.targetSteering ?? 0) : 0;
      const responseMs = trackingAvailable
        ? RACING_STEERING_TIME_CONSTANT_MS
        : RACING_CENTER_TIME_CONSTANT_MS;
      const steeringAlpha = 1 - Math.exp(-(deltaSeconds * 1_000) / responseMs);
      car.steering += (targetSteering - car.steering) * steeringAlpha;

      const curve = racingTrackCurveAt(RACING_TRACK, car.distance);
      const speedRatio = car.speed / RACING_MAX_SPEED;
      car.lateral +=
        (car.steering * RACING_STEERING_RATE -
          curve * RACING_CURVE_DRIFT * speedRatio * speedRatio) *
        deltaSeconds;
      car.lateral = clamp(car.lateral, -RACING_MAX_LATERAL, RACING_MAX_LATERAL);
      const offRoad = Math.abs(car.lateral) > 1;
      const speedLimit = offRoad ? RACING_OFF_ROAD_MAX_SPEED : RACING_MAX_SPEED;
      if (car.speed < speedLimit) {
        car.speed = Math.min(speedLimit, car.speed + RACING_ACCELERATION * deltaSeconds);
      } else if (car.speed > speedLimit) {
        car.speed = Math.max(speedLimit, car.speed - RACING_OFF_ROAD_DECELERATION * deltaSeconds);
      }

      const previousDistance = car.distance;
      car.distance = Math.min(RACING_TRACK.length, car.distance + car.speed * deltaSeconds);
      if (car.distance >= RACING_TRACK.length) {
        const travelled = car.distance - previousDistance;
        const finishFraction =
          travelled <= 0 ? 1 : (RACING_TRACK.length - previousDistance) / travelled;
        const finishTime = stepStartElapsedMs + stepDurationMs * clamp(finishFraction, 0, 1);
        car.finishedAtMs = finishTime;
        finishers.push({ slot, timeMs: finishTime });
      }
    }
    this.elapsedMs += stepDurationMs;
    if (finishers.length > 0) {
      this.finishRace(finishers);
    }
  }

  private finishRace(finishers: readonly { slot: RacingPlayerSlot; timeMs: number }[]): void {
    this.corePhase = "finished";
    this.userPaused = false;
    this.accumulatorMs = 0;
    if (this.playerCount === 1) {
      const finisher = finishers[0];
      if (finisher === undefined) {
        throw new Error("A one-player finish requires one finisher.");
      }
      this.elapsedMs = finisher.timeMs;
      this.result = { type: "time", elapsedMs: finisher.timeMs };
      return;
    }
    const left = finishers.find((finisher) => finisher.slot === "left");
    const right = finishers.find((finisher) => finisher.slot === "right");
    let winner: "left" | "right" | "tie";
    if (left !== undefined && right !== undefined) {
      winner =
        Math.abs(left.timeMs - right.timeMs) < 0.001
          ? "tie"
          : left.timeMs < right.timeMs
            ? "left"
            : "right";
      this.elapsedMs = Math.min(left.timeMs, right.timeMs);
    } else {
      winner = left === undefined ? "right" : "left";
      this.elapsedMs = left?.timeMs ?? right?.timeMs ?? this.elapsedMs;
    }
    this.result = {
      type: "winner",
      winner,
      leftTimeMs: left?.timeMs ?? null,
      rightTimeMs: right?.timeMs ?? null,
    };
  }

  private resetRound(nowMs: number): void {
    this.corePhase = "ready";
    this.userPaused = false;
    this.orientationPaused = false;
    this.systemPaused = false;
    this.calibrationPurpose = null;
    this.calibrationElapsedMs = 0;
    this.calibrationSamples.clear();
    this.neutralAngles.clear();
    this.inputs.clear();
    this.cars = new Map(slotsFor(this.playerCount).map((slot) => [slot, createCar(slot)]));
    this.visibleDrivers = 0;
    this.completeDrivers = 0;
    this.elapsedMs = 0;
    this.accumulatorMs = 0;
    this.lastTickAtMs = nowMs;
    this.result = null;
  }

  private snapshot(nowMs: number): RacingSnapshot {
    const paused = this.userPaused || this.orientationPaused || this.systemPaused;
    const phase: RacingPhase = this.userPaused ? "paused" : this.corePhase;
    const cars = slotsFor(this.playerCount).map((slot): RacingCarSnapshot => {
      const car = this.cars.get(slot) ?? createCar(slot);
      const input = this.inputs.get(slot);
      const trackingAvailable =
        input?.lastValidAtMs !== null &&
        input?.lastValidAtMs !== undefined &&
        nowMs - input.lastValidAtMs <= RACING_INPUT_GRACE_MS;
      return {
        slot,
        distance: car.distance,
        lateral: car.lateral,
        speed: car.speed,
        steering: car.steering,
        trackingAvailable,
        progress: clamp(car.distance / RACING_TRACK.length, 0, 1),
        finishedAtMs: car.finishedAtMs,
      };
    });
    const wheelReadyDrivers = slotsFor(this.playerCount).filter((slot) => {
      const input = this.inputs.get(slot);
      return (
        input?.wheelValid === true &&
        input.lastValidAtMs !== null &&
        nowMs - input.lastValidAtMs <= RACING_CALIBRATION_INPUT_FRESH_MS
      );
    }).length;
    return {
      enabled: this.enabled,
      playerCount: this.playerCount,
      phase,
      paused,
      orientationPaused: this.orientationPaused,
      systemPaused: this.systemPaused,
      readyToStart: this.readyToStart(),
      visibleDrivers: this.visibleDrivers,
      completeDrivers: this.completeDrivers,
      wheelReadyDrivers,
      calibrationPurpose: this.calibrationPurpose,
      startingRemainingMs: Math.max(0, RACING_COUNTDOWN_MS - this.calibrationElapsedMs),
      elapsedMs: this.elapsedMs,
      trackLength: RACING_TRACK.length,
      cars,
      result: this.result,
    };
  }
}

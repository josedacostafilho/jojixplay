import type { CameraFrame } from "../../domain/camera";
import type { DetectedPose, PosePacket } from "../../domain/pose";
import { coarseHand, usablePoseLandmark } from "../../domain/pose-features";
import type { Point } from "../../render/geometry";

export type RacingPlayerSlot = "solo" | "left" | "right";

export interface RacingDriverObservation {
  slot: RacingPlayerSlot;
  torsoCenter: Point;
  complete: boolean;
  wheelAngleRadians: number | null;
  wheelValid: boolean;
  pausePose: boolean;
}

export interface RacingInputSnapshot {
  observations: readonly RacingDriverObservation[];
  visibleDrivers: number;
  completeDrivers: number;
  pauseRequested: boolean;
  epoch: number | null;
}

interface DriverCandidate {
  torsoCenter: Point;
  complete: boolean;
  wheelAngleRadians: number | null;
  wheelValid: boolean;
  pausePose: boolean;
}

interface SlotLease {
  torsoCenter: Point;
  lastSeenAtMs: number;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const MIN_HAND_SEPARATION_RATIO = 0.55;
const MAX_HAND_SEPARATION_RATIO = 1.8;
const MIN_WHEEL_MIDPOINT_TORSO_RATIO = -0.25;
const MAX_WHEEL_MIDPOINT_TORSO_RATIO = 1.1;
const PAUSE_RAISE_MARGIN_TORSO_RATIO = 0.08;
const MAX_LEASE_DISTANCE = 0.32;
const LEASE_FRESH_MS = 350;
const PAUSE_HOLD_MS = 1_000;
const MAX_INPUT_GAP_MS = 250;

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function mirrored(point: Point): Point {
  return { x: 1 - point.x, y: point.y };
}

function aspectPoint(point: Point, frame: CameraFrame): Point {
  const minimumDimension = Math.min(frame.width, frame.height);
  return {
    x: (point.x * frame.width) / minimumDimension,
    y: (point.y * frame.height) / minimumDimension,
  };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function inFrame(point: Point): boolean {
  return point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
}

function candidateFromPose(pose: DetectedPose, frame: CameraFrame): DriverCandidate | null {
  const leftShoulder = usablePoseLandmark(pose, LEFT_SHOULDER);
  const rightShoulder = usablePoseLandmark(pose, RIGHT_SHOULDER);
  const leftHip = usablePoseLandmark(pose, LEFT_HIP);
  const rightHip = usablePoseLandmark(pose, RIGHT_HIP);
  if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
    return null;
  }

  const shoulderCenter = mirrored(midpoint(leftShoulder, rightShoulder));
  const hipCenter = mirrored(midpoint(leftHip, rightHip));
  const torsoCenter = midpoint(shoulderCenter, hipCenter);
  const torsoHeight = distance(aspectPoint(shoulderCenter, frame), aspectPoint(hipCenter, frame));
  const shoulderSpan = distance(
    aspectPoint(mirrored(leftShoulder), frame),
    aspectPoint(mirrored(rightShoulder), frame),
  );
  const leftHand = coarseHand(pose, "left");
  const rightHand = coarseHand(pose, "right");
  if (leftHand === null || rightHand === null || shoulderSpan <= 0 || torsoHeight <= 0) {
    return {
      torsoCenter,
      complete: false,
      wheelAngleRadians: null,
      wheelValid: false,
      pausePose: false,
    };
  }

  const firstHand = mirrored(leftHand.center);
  const secondHand = mirrored(rightHand.center);
  const screenLeftHand = firstHand.x <= secondHand.x ? firstHand : secondHand;
  const screenRightHand = firstHand.x <= secondHand.x ? secondHand : firstHand;
  const aspectLeftHand = aspectPoint(screenLeftHand, frame);
  const aspectRightHand = aspectPoint(screenRightHand, frame);
  const handSeparation = distance(aspectLeftHand, aspectRightHand);
  const handMidpoint = midpoint(screenLeftHand, screenRightHand);
  const aspectShoulder = aspectPoint(shoulderCenter, frame);
  const aspectHandMidpoint = aspectPoint(handMidpoint, frame);
  const torsoProgress = (aspectHandMidpoint.y - aspectShoulder.y) / torsoHeight;
  const separationRatio = handSeparation / shoulderSpan;
  const wheelValid =
    inFrame(screenLeftHand) &&
    inFrame(screenRightHand) &&
    screenLeftHand.x < screenRightHand.x &&
    separationRatio >= MIN_HAND_SEPARATION_RATIO &&
    separationRatio <= MAX_HAND_SEPARATION_RATIO &&
    torsoProgress >= MIN_WHEEL_MIDPOINT_TORSO_RATIO &&
    torsoProgress <= MAX_WHEEL_MIDPOINT_TORSO_RATIO;
  const pauseLimit = aspectShoulder.y - torsoHeight * PAUSE_RAISE_MARGIN_TORSO_RATIO;
  const pausePose = aspectLeftHand.y < pauseLimit && aspectRightHand.y < pauseLimit;

  return {
    torsoCenter,
    complete: inFrame(firstHand) && inFrame(secondHand),
    wheelAngleRadians: wheelValid
      ? Math.atan2(aspectRightHand.y - aspectLeftHand.y, aspectRightHand.x - aspectLeftHand.x)
      : null,
    wheelValid,
    pausePose,
  };
}

function slotOrder(playerCount: 1 | 2): readonly RacingPlayerSlot[] {
  return playerCount === 1 ? ["solo"] : ["left", "right"];
}

export class RacingInputSession {
  private leases = new Map<RacingPlayerSlot, SlotLease>();
  private epoch: number | null = null;
  private pauseStartedAt = new Map<RacingPlayerSlot, number>();
  private pauseLatched = false;
  private lastPacketAtMs: number | null = null;

  public reset(): void {
    this.leases.clear();
    this.epoch = null;
    this.pauseStartedAt.clear();
    this.pauseLatched = false;
    this.lastPacketAtMs = null;
  }

  public update(
    packet: PosePacket | null,
    playerCount: 1 | 2,
    receivedAtMs: number,
  ): RacingInputSnapshot {
    if (packet === null) {
      this.pauseStartedAt.clear();
      this.lastPacketAtMs = null;
      return {
        observations: [],
        visibleDrivers: 0,
        completeDrivers: 0,
        pauseRequested: false,
        epoch: this.epoch,
      };
    }
    if (this.epoch !== packet.frame.epoch) {
      this.leases.clear();
      this.pauseStartedAt.clear();
      this.pauseLatched = false;
      this.epoch = packet.frame.epoch;
    }
    if (this.lastPacketAtMs !== null && receivedAtMs - this.lastPacketAtMs > MAX_INPUT_GAP_MS) {
      this.pauseStartedAt.clear();
    }
    this.lastPacketAtMs = receivedAtMs;

    const candidates = packet.poses
      .map((pose) => candidateFromPose(pose, packet.frame))
      .filter((candidate): candidate is DriverCandidate => candidate !== null);
    const assigned = this.assignCandidates(candidates, playerCount, receivedAtMs);
    let anyPausePose = false;
    let pauseRequested = false;
    for (const observation of assigned) {
      if (!observation.pausePose) {
        this.pauseStartedAt.delete(observation.slot);
        continue;
      }
      anyPausePose = true;
      const startedAt = this.pauseStartedAt.get(observation.slot) ?? receivedAtMs;
      this.pauseStartedAt.set(observation.slot, startedAt);
      if (!this.pauseLatched && receivedAtMs - startedAt >= PAUSE_HOLD_MS) {
        pauseRequested = true;
        this.pauseLatched = true;
      }
    }
    if (!anyPausePose) {
      this.pauseLatched = false;
      this.pauseStartedAt.clear();
    }

    return {
      observations: assigned,
      visibleDrivers: assigned.length,
      completeDrivers: assigned.filter((observation) => observation.complete).length,
      pauseRequested,
      epoch: this.epoch,
    };
  }

  private assignCandidates(
    candidates: readonly DriverCandidate[],
    playerCount: 1 | 2,
    receivedAtMs: number,
  ): RacingDriverObservation[] {
    for (const [slot, lease] of this.leases) {
      if (receivedAtMs - lease.lastSeenAtMs > LEASE_FRESH_MS) {
        this.leases.delete(slot);
      }
    }

    if (playerCount === 1) {
      const candidate = [...candidates].sort(
        (left, right) => Math.abs(left.torsoCenter.x - 0.5) - Math.abs(right.torsoCenter.x - 0.5),
      )[0];
      if (candidate === undefined) {
        return [];
      }
      this.leases.clear();
      this.leases.set("solo", { torsoCenter: candidate.torsoCenter, lastSeenAtMs: receivedAtMs });
      return [this.observation("solo", candidate)];
    }

    const sorted = [...candidates].sort((left, right) => left.torsoCenter.x - right.torsoCenter.x);
    const selected = sorted.slice(0, 2);
    if (selected.length === 0) {
      return [];
    }
    const leftLease = this.leases.get("left");
    const rightLease = this.leases.get("right");
    let leftCandidate: DriverCandidate | undefined;
    let rightCandidate: DriverCandidate | undefined;

    if (selected.length === 2 && leftLease !== undefined && rightLease !== undefined) {
      const first = selected[0];
      const second = selected[1];
      if (first !== undefined && second !== undefined) {
        const orderedCost =
          distance(first.torsoCenter, leftLease.torsoCenter) +
          distance(second.torsoCenter, rightLease.torsoCenter);
        const swappedCost =
          distance(second.torsoCenter, leftLease.torsoCenter) +
          distance(first.torsoCenter, rightLease.torsoCenter);
        if (orderedCost <= swappedCost) {
          leftCandidate = first;
          rightCandidate = second;
        } else {
          leftCandidate = second;
          rightCandidate = first;
        }
        if (
          distance(leftCandidate.torsoCenter, leftLease.torsoCenter) > MAX_LEASE_DISTANCE ||
          distance(rightCandidate.torsoCenter, rightLease.torsoCenter) > MAX_LEASE_DISTANCE
        ) {
          leftCandidate = first;
          rightCandidate = second;
        }
      }
    } else if (selected.length === 2) {
      leftCandidate = selected[0];
      rightCandidate = selected[1];
    } else {
      const candidate = selected[0];
      if (candidate !== undefined) {
        const leftDistance =
          leftLease === undefined
            ? Number.POSITIVE_INFINITY
            : distance(candidate.torsoCenter, leftLease.torsoCenter);
        const rightDistance =
          rightLease === undefined
            ? Number.POSITIVE_INFINITY
            : distance(candidate.torsoCenter, rightLease.torsoCenter);
        if (Math.min(leftDistance, rightDistance) <= MAX_LEASE_DISTANCE) {
          if (leftDistance <= rightDistance) {
            leftCandidate = candidate;
          } else {
            rightCandidate = candidate;
          }
        } else if (candidate.torsoCenter.x < 0.5) {
          leftCandidate = candidate;
        } else {
          rightCandidate = candidate;
        }
      }
    }

    const observations: RacingDriverObservation[] = [];
    for (const slot of slotOrder(playerCount)) {
      const candidate = slot === "left" ? leftCandidate : rightCandidate;
      if (candidate === undefined) {
        continue;
      }
      this.leases.set(slot, { torsoCenter: candidate.torsoCenter, lastSeenAtMs: receivedAtMs });
      observations.push(this.observation(slot, candidate));
    }
    return observations;
  }

  private observation(slot: RacingPlayerSlot, candidate: DriverCandidate): RacingDriverObservation {
    return { slot, ...candidate };
  }
}

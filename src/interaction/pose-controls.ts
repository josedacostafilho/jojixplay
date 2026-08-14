import type { DetectedPose, PoseLandmark, PosePacket } from "../domain/pose";
import { coarseHand, usablePoseLandmark } from "../domain/pose-features";
import {
  createPoseProjection,
  frameNormalizedDistance,
  type Point,
  projectedFrameBounds,
  projectNormalizedPoint,
  type Rectangle,
  type Size,
} from "../render/geometry";

export const POSE_CONTROL_TIMING = {
  singlePersonClaimMs: 300,
  multiplePeopleClaimMs: 500,
  dwellMs: 900,
  belowHipsReleaseMs: 600,
  displacedReleaseMs: 600,
  poseLostReleaseMs: 1_000,
  inactivityReleaseMs: 15_000,
  freshPoseMs: 250,
} as const;

export const MAX_POSE_CONTROL_TARGETS = 4;
export type PoseControlPhase = "no-pose" | "needs-headroom" | "ready" | "claiming" | "active";
export type ControlHand = "left" | "right";
export type PoseControlPlacement = "overhead-row" | "left-column";

export interface PoseControlActionDefinition<TAction extends string> {
  action: TAction;
  label: string;
  dwellMs?: number;
}

export interface PoseControlTarget<TAction extends string = string> {
  action: TAction;
  label: string;
  dwellMs: number;
  rect: Rectangle;
}

export interface PoseControlHands {
  selected: ControlHand;
  left: Point | null;
  right: Point | null;
  shoulderSpan: number;
}

export interface PoseControlSnapshot<TAction extends string = string> {
  phase: PoseControlPhase;
  visiblePeople: number;
  requiresBothHands: boolean;
  claimProgress: number;
  targets: readonly PoseControlTarget<TAction>[];
  pointer: Point | null;
  hands: PoseControlHands | null;
  controlsArmed: boolean;
  hoveredAction: TAction | null;
  dwellProgress: number;
  controllerPoseIndex: number | null;
}

export interface PoseControlUpdate<TAction extends string = string> {
  snapshot: PoseControlSnapshot<TAction>;
  activated: TAction | null;
}

interface PoseDescriptor {
  poseIndex: number;
  shoulderCenter: Point;
  hipCenter: Point;
  torsoCenter: Point;
  headTopY: number | null;
  leftShoulder: PoseLandmark;
  rightShoulder: PoseLandmark;
  leftElbow: PoseLandmark | null;
  rightElbow: PoseLandmark | null;
  leftWrist: PoseLandmark | null;
  rightWrist: PoseLandmark | null;
  leftHandCenter: Point | null;
  rightHandCenter: Point | null;
}

interface ClaimCandidate {
  hand: ControlHand;
  multiplePeople: boolean;
  torsoCenter: Point;
  startedAtMs: number;
  lastSeenAtMs: number;
}

interface OverheadControlLayout {
  placement: "overhead-row";
  centerX: number;
  rowTop: number;
  targetWidth: number;
  targetHeight: number;
  gap: number;
}

interface LeftColumnControlLayout {
  placement: "left-column";
  columnLeft: number;
  columnTop: number;
  targetWidth: number;
  targetHeight: number;
  gap: number;
}

type ControlLayout = OverheadControlLayout | LeftColumnControlLayout;

interface ControlLease<TAction extends string> {
  hand: ControlHand;
  torsoCenter: Point;
  homeTorsoCenter: Point;
  lastSeenAtMs: number;
  lastMotionAtMs: number;
  lastMotionPoint: Point;
  frame: Size;
  layout: ControlLayout;
  overheadLayout: OverheadControlLayout | null;
  targets: readonly PoseControlTarget<TAction>[];
  pointer: Point | null;
  hands: PoseControlHands | null;
  controlsArmed: boolean;
  poseIndex: number;
  hoveredAction: TAction | null;
  hoverStartedAtMs: number | null;
  latchedAction: TAction | null;
  belowHipsSinceMs: number | null;
  displacedSinceMs: number | null;
}

const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const FACE_LANDMARK_INDICES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const RAISE_MARGIN = 0.015;
const CANDIDATE_MATCH_DISTANCE = 0.18;
const LEASE_MATCH_DISTANCE = 0.28;
const LAYOUT_DISPLACEMENT_DISTANCE = 0.24;
const MEANINGFUL_POINTER_MOVEMENT = 0.0125;
const CLAIM_PACKET_GAP_MS = POSE_CONTROL_TIMING.freshPoseMs;
const HOVER_HYSTERESIS_PX = 10;
const MAX_OVERHEAD_TARGETS = 3;

function validateActions<TAction extends string>(
  actions: readonly PoseControlActionDefinition<TAction>[],
  placement: PoseControlPlacement,
): readonly PoseControlActionDefinition<TAction>[] {
  const maximumTargets =
    placement === "overhead-row" ? MAX_OVERHEAD_TARGETS : MAX_POSE_CONTROL_TARGETS;
  if (actions.length === 0 || actions.length > maximumTargets) {
    throw new Error(
      `Pose controls require 1 to ${maximumTargets} actions for ${placement} placement.`,
    );
  }
  const seen = new Set<string>();
  return actions.map((definition) => {
    if (definition.action.length === 0 || definition.label.trim().length === 0) {
      throw new Error("Pose-control actions require non-empty action and label values.");
    }
    if (seen.has(definition.action)) {
      throw new Error(`Duplicate pose-control action: ${definition.action}.`);
    }
    seen.add(definition.action);
    const dwellMs = definition.dwellMs ?? POSE_CONTROL_TIMING.dwellMs;
    if (!Number.isFinite(dwellMs) || dwellMs <= 0) {
      throw new Error(`Pose-control action ${definition.action} has an invalid dwell time.`);
    }
    return { ...definition, dwellMs };
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function midpoint(left: Point, right: Point): Point {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function topmostVisibleLandmarkY(pose: DetectedPose, indices: readonly number[]): number | null {
  let top: number | null = null;
  for (const index of indices) {
    const landmark = usablePoseLandmark(pose, index);
    if (landmark !== null && (top === null || landmark.y < top)) {
      top = landmark.y;
    }
  }
  return top;
}

function describePose(pose: DetectedPose, poseIndex: number): PoseDescriptor | null {
  const leftShoulder = usablePoseLandmark(pose, LEFT_SHOULDER);
  const rightShoulder = usablePoseLandmark(pose, RIGHT_SHOULDER);
  const leftHip = usablePoseLandmark(pose, LEFT_HIP);
  const rightHip = usablePoseLandmark(pose, RIGHT_HIP);
  if (leftShoulder === null || rightShoulder === null || leftHip === null || rightHip === null) {
    return null;
  }

  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const leftHand = coarseHand(pose, "left");
  const rightHand = coarseHand(pose, "right");
  return {
    poseIndex,
    shoulderCenter,
    hipCenter,
    torsoCenter: midpoint(shoulderCenter, hipCenter),
    headTopY: topmostVisibleLandmarkY(pose, FACE_LANDMARK_INDICES),
    leftShoulder,
    rightShoulder,
    leftElbow: usablePoseLandmark(pose, LEFT_ELBOW),
    rightElbow: usablePoseLandmark(pose, RIGHT_ELBOW),
    leftWrist: leftHand?.landmarks.wrist ?? null,
    rightWrist: rightHand?.landmarks.wrist ?? null,
    leftHandCenter: leftHand?.center ?? null,
    rightHandCenter: rightHand?.center ?? null,
  };
}

function wristForHand(pose: PoseDescriptor, hand: ControlHand): PoseLandmark | null {
  return hand === "left" ? pose.leftWrist : pose.rightWrist;
}

function handCenterForHand(pose: PoseDescriptor, hand: ControlHand): Point | null {
  return hand === "left" ? pose.leftHandCenter : pose.rightHandCenter;
}

function isSinglePersonClaim(pose: PoseDescriptor, hand: ControlHand): boolean {
  const wrist = wristForHand(pose, hand);
  const elbow = hand === "left" ? pose.leftElbow : pose.rightElbow;
  return wrist !== null && elbow !== null && wrist.y < elbow.y - RAISE_MARGIN;
}

function isMultiplePeopleClaim(pose: PoseDescriptor): boolean {
  return (
    pose.leftWrist !== null &&
    pose.rightWrist !== null &&
    pose.leftWrist.y < pose.leftShoulder.y - RAISE_MARGIN &&
    pose.rightWrist.y < pose.rightShoulder.y - RAISE_MARGIN
  );
}

function preferredHand(pose: PoseDescriptor): ControlHand | null {
  if (pose.leftHandCenter === null) {
    return pose.rightHandCenter === null ? null : "right";
  }
  if (pose.rightHandCenter === null) {
    return "left";
  }
  return (pose.leftWrist?.y ?? Number.POSITIVE_INFINITY) <=
    (pose.rightWrist?.y ?? Number.POSITIVE_INFINITY)
    ? "left"
    : "right";
}

function descriptorCanContinueClaim(pose: PoseDescriptor, candidate: ClaimCandidate): boolean {
  return (
    handCenterForHand(pose, candidate.hand) !== null &&
    (candidate.multiplePeople
      ? isMultiplePeopleClaim(pose)
      : isSinglePersonClaim(pose, candidate.hand))
  );
}

function chooseNewCandidate(
  poses: readonly PoseDescriptor[],
  multiplePeople: boolean,
): { pose: PoseDescriptor; hand: ControlHand } | null {
  for (const pose of poses) {
    if (multiplePeople) {
      if (isMultiplePeopleClaim(pose)) {
        const hand = preferredHand(pose);
        if (hand !== null) {
          return { pose, hand };
        }
      }
      continue;
    }

    const leftRaised = pose.leftHandCenter !== null && isSinglePersonClaim(pose, "left");
    const rightRaised = pose.rightHandCenter !== null && isSinglePersonClaim(pose, "right");
    if (leftRaised && rightRaised) {
      const hand = preferredHand(pose);
      if (hand !== null) {
        return { pose, hand };
      }
    }
    if (leftRaised) {
      return { pose, hand: "left" };
    }
    if (rightRaised) {
      return { pose, hand: "right" };
    }
  }
  return null;
}

function nearestPose(
  poses: readonly PoseDescriptor[],
  point: Point,
  maximumDistance: number,
): PoseDescriptor | null {
  let nearest: PoseDescriptor | null = null;
  let nearestDistance = maximumDistance;
  for (const pose of poses) {
    const candidateDistance = distance(pose.torsoCenter, point);
    if (candidateDistance <= nearestDistance) {
      nearest = pose;
      nearestDistance = candidateDistance;
    }
  }
  return nearest;
}

function createOverheadControlLayout(
  pose: PoseDescriptor,
  frame: Size,
  viewport: Size,
): OverheadControlLayout | null {
  if (pose.headTopY === null) {
    return null;
  }
  const projection = createPoseProjection(
    frame.width,
    frame.height,
    viewport.width,
    viewport.height,
    true,
  );
  const frameBounds = projectedFrameBounds(projection);
  const headTop = projectNormalizedPoint(pose.shoulderCenter.x, pose.headTopY, projection);
  const minimumFrameDimension = Math.min(frameBounds.width, frameBounds.height);
  const safeMargin = Math.min(32, Math.max(8, minimumFrameDimension * 0.025));
  const availableWidth = Math.max(1, frameBounds.width - safeMargin * 2);
  const availableHeight = Math.max(1, frameBounds.height - safeMargin * 2);
  const gap = Math.min(clamp(viewport.width * 0.012, 8, 24), availableWidth * 0.04);
  const targetWidth = Math.max(
    1,
    Math.min(220, (availableWidth - gap * (MAX_OVERHEAD_TARGETS - 1)) / MAX_OVERHEAD_TARGETS),
  );
  const targetHeight = Math.max(
    1,
    Math.min(clamp(viewport.height * 0.09, 68, 112), availableHeight, targetWidth * 0.58),
  );
  const rowWidth = targetWidth * MAX_OVERHEAD_TARGETS + gap * (MAX_OVERHEAD_TARGETS - 1);
  const minimumCenterX = frameBounds.x + safeMargin + rowWidth / 2;
  const maximumCenterX = frameBounds.x + frameBounds.width - safeMargin - rowWidth / 2;
  const centerX = clamp(headTop.x, minimumCenterX, maximumCenterX);
  const headGap = clamp(minimumFrameDimension * 0.025, 12, 24);
  const rowTop = headTop.y - headGap - targetHeight;
  const minimumTop = frameBounds.y + safeMargin;
  const maximumBottom = frameBounds.y + frameBounds.height - safeMargin;
  if (rowTop < minimumTop || rowTop + targetHeight > maximumBottom) {
    return null;
  }
  return { placement: "overhead-row", centerX, rowTop, targetWidth, targetHeight, gap };
}

function createLeftColumnControlLayout(
  torsoCenter: Point,
  frame: Size,
  viewport: Size,
  actionCount: number,
): LeftColumnControlLayout {
  const projection = createPoseProjection(
    frame.width,
    frame.height,
    viewport.width,
    viewport.height,
    true,
  );
  const frameBounds = projectedFrameBounds(projection);
  const minimumFrameDimension = Math.min(frameBounds.width, frameBounds.height);
  const safeMargin = Math.min(24, Math.max(8, minimumFrameDimension * 0.025));
  const availableWidth = Math.max(1, frameBounds.width - safeMargin * 2);
  const availableHeight = Math.max(1, frameBounds.height - safeMargin * 2);
  const gap = Math.min(clamp(viewport.height * 0.012, 8, 14), availableHeight * 0.04);
  const targetWidth = Math.max(
    1,
    Math.min(clamp(viewport.width * 0.1, 96, 144), availableWidth * 0.28),
  );
  const targetHeight = Math.max(
    1,
    Math.min(
      clamp(viewport.height * 0.07, 48, 68),
      (availableHeight - gap * Math.max(0, actionCount - 1)) / actionCount,
      targetWidth * 0.62,
    ),
  );
  const columnHeight = targetHeight * actionCount + gap * Math.max(0, actionCount - 1);
  const torso = projectNormalizedPoint(torsoCenter.x, torsoCenter.y, projection);
  const minimumTop = frameBounds.y + safeMargin;
  const maximumTop = frameBounds.y + frameBounds.height - safeMargin - columnHeight;
  return {
    placement: "left-column",
    columnLeft: frameBounds.x + safeMargin,
    columnTop: clamp(torso.y - columnHeight / 2, minimumTop, Math.max(minimumTop, maximumTop)),
    targetWidth,
    targetHeight,
    gap,
  };
}

function createControlLayout(
  pose: PoseDescriptor,
  frame: Size,
  viewport: Size,
  placement: PoseControlPlacement,
  actionCount: number,
): ControlLayout | null {
  return placement === "overhead-row"
    ? createOverheadControlLayout(pose, frame, viewport)
    : createLeftColumnControlLayout(pose.torsoCenter, frame, viewport, actionCount);
}

function createControlTargets<TAction extends string>(
  layout: ControlLayout,
  actions: readonly PoseControlActionDefinition<TAction>[],
): readonly PoseControlTarget<TAction>[] {
  if (layout.placement === "left-column") {
    return actions.map(({ action, label, dwellMs }, index) => ({
      action,
      label,
      dwellMs: dwellMs ?? POSE_CONTROL_TIMING.dwellMs,
      rect: {
        x: layout.columnLeft,
        y: layout.columnTop + index * (layout.targetHeight + layout.gap),
        width: layout.targetWidth,
        height: layout.targetHeight,
      },
    }));
  }
  const rowWidth =
    layout.targetWidth * actions.length + layout.gap * Math.max(0, actions.length - 1);
  const rowLeft = layout.centerX - rowWidth / 2;
  return actions.map(({ action, label, dwellMs }, index) => ({
    action,
    label,
    dwellMs: dwellMs ?? POSE_CONTROL_TIMING.dwellMs,
    rect: {
      x: rowLeft + index * (layout.targetWidth + layout.gap),
      y: layout.rowTop,
      width: layout.targetWidth,
      height: layout.targetHeight,
    },
  }));
}

function containsPoint(rect: Rectangle, point: Point, padding: number): boolean {
  return (
    point.x >= rect.x - padding &&
    point.x <= rect.x + rect.width + padding &&
    point.y >= rect.y - padding &&
    point.y <= rect.y + rect.height + padding
  );
}

export class PoseControlSession<TAction extends string> {
  private actions: readonly PoseControlActionDefinition<TAction>[];
  private placement: PoseControlPlacement;
  private viewport: Size | null = null;
  private visiblePeople = 0;
  private multiplePeople = false;
  private headroomAvailable = false;
  private candidate: ClaimCandidate | null = null;
  private lease: ControlLease<TAction> | null = null;

  public constructor(
    actions: readonly PoseControlActionDefinition<TAction>[],
    placement: PoseControlPlacement,
  ) {
    this.actions = validateActions(actions, placement);
    this.placement = placement;
  }

  public setActions(
    actions: readonly PoseControlActionDefinition<TAction>[],
    placement: PoseControlPlacement,
    nowMs: number,
  ): PoseControlUpdate<TAction> {
    this.actions = validateActions(actions, placement);
    this.placement = placement;
    if (this.lease !== null) {
      const nextLayout =
        placement === "overhead-row"
          ? this.lease.overheadLayout
          : createLeftColumnControlLayout(
              this.lease.torsoCenter,
              this.lease.frame,
              this.viewport ?? this.lease.frame,
              this.actions.length,
            );
      if (nextLayout === null) {
        this.lease = null;
        this.candidate = null;
        this.headroomAvailable = false;
        return this.result(nowMs, null);
      }
      this.lease.layout = nextLayout;
      this.lease.targets = createControlTargets(this.lease.layout, this.actions);
      this.lease.controlsArmed = false;
      this.lease.hoveredAction = null;
      this.lease.hoverStartedAtMs = null;
      this.lease.latchedAction = null;
    }
    return this.result(nowMs, null);
  }

  updatePacket(
    packet: PosePacket | null,
    nowMs: number,
    viewport: Size,
  ): PoseControlUpdate<TAction> {
    if (
      this.viewport === null ||
      this.viewport.width !== viewport.width ||
      this.viewport.height !== viewport.height
    ) {
      this.viewport = { ...viewport };
      this.candidate = null;
      this.lease = null;
    }

    if (packet === null) {
      this.visiblePeople = 0;
      this.multiplePeople = false;
      this.headroomAvailable = false;
      this.candidate = null;
      this.clearPointer();
      return this.tick(nowMs);
    }

    const poses = packet.poses
      .map((pose, poseIndex) => describePose(pose, poseIndex))
      .filter((pose): pose is PoseDescriptor => pose !== null);
    this.visiblePeople = poses.length;
    this.multiplePeople = poses.length > 1;
    const posesWithHeadroom = poses.filter(
      (pose) =>
        createControlLayout(pose, packet.frame, viewport, this.placement, this.actions.length) !==
        null,
    );
    this.headroomAvailable = posesWithHeadroom.length > 0;

    if (this.lease !== null) {
      if (
        packet.frame.width !== this.lease.frame.width ||
        packet.frame.height !== this.lease.frame.height
      ) {
        this.lease = null;
        this.candidate = null;
        return this.result(nowMs, null);
      }
      return this.updateLease(poses, packet.frame, nowMs);
    }

    return this.updateClaim(posesWithHeadroom, packet.frame, nowMs, viewport);
  }

  tick(nowMs: number): PoseControlUpdate<TAction> {
    if (this.lease === null) {
      return this.result(nowMs, null);
    }

    if (nowMs - this.lease.lastSeenAtMs > POSE_CONTROL_TIMING.poseLostReleaseMs) {
      this.lease = null;
      return this.result(nowMs, null);
    }
    if (nowMs - this.lease.lastMotionAtMs > POSE_CONTROL_TIMING.inactivityReleaseMs) {
      this.lease = null;
      return this.result(nowMs, null);
    }
    if (nowMs - this.lease.lastSeenAtMs > POSE_CONTROL_TIMING.freshPoseMs) {
      this.clearPointer();
      return this.result(nowMs, null);
    }

    const activated = this.updateHover(nowMs, false);
    return this.result(nowMs, activated);
  }

  private updateClaim(
    poses: readonly PoseDescriptor[],
    frame: Size,
    nowMs: number,
    viewport: Size,
  ): PoseControlUpdate<TAction> {
    if (poses.length === 0) {
      this.candidate = null;
      return this.result(nowMs, null);
    }

    if (this.candidate !== null && this.candidate.multiplePeople === this.multiplePeople) {
      const matchedPose = nearestPose(poses, this.candidate.torsoCenter, CANDIDATE_MATCH_DISTANCE);
      if (matchedPose !== null && descriptorCanContinueClaim(matchedPose, this.candidate)) {
        if (nowMs - this.candidate.lastSeenAtMs > CLAIM_PACKET_GAP_MS) {
          this.candidate.startedAtMs = nowMs;
        }
        this.candidate.torsoCenter = matchedPose.torsoCenter;
        this.candidate.lastSeenAtMs = nowMs;
        const requiredHoldMs = this.multiplePeople
          ? POSE_CONTROL_TIMING.multiplePeopleClaimMs
          : POSE_CONTROL_TIMING.singlePersonClaimMs;
        if (nowMs - this.candidate.startedAtMs >= requiredHoldMs) {
          this.beginLease(matchedPose, this.candidate.hand, frame, viewport, nowMs);
        }
        return this.result(nowMs, null);
      }
    }

    const chosen = chooseNewCandidate(poses, this.multiplePeople);
    this.candidate =
      chosen === null
        ? null
        : {
            hand: chosen.hand,
            multiplePeople: this.multiplePeople,
            torsoCenter: chosen.pose.torsoCenter,
            startedAtMs: nowMs,
            lastSeenAtMs: nowMs,
          };
    return this.result(nowMs, null);
  }

  private beginLease(
    pose: PoseDescriptor,
    hand: ControlHand,
    frame: Size,
    viewport: Size,
    nowMs: number,
  ): void {
    const wrist = wristForHand(pose, hand);
    const handCenter = handCenterForHand(pose, hand);
    const overheadLayout = createOverheadControlLayout(pose, frame, viewport);
    const layout = createControlLayout(pose, frame, viewport, this.placement, this.actions.length);
    if (wrist === null || handCenter === null || layout === null) {
      this.candidate = null;
      return;
    }
    const projection = createPoseProjection(
      frame.width,
      frame.height,
      viewport.width,
      viewport.height,
      true,
    );
    this.lease = {
      hand,
      torsoCenter: pose.torsoCenter,
      homeTorsoCenter: pose.torsoCenter,
      lastSeenAtMs: nowMs,
      lastMotionAtMs: nowMs,
      lastMotionPoint: handCenter,
      frame: { ...frame },
      layout,
      overheadLayout,
      targets: createControlTargets(layout, this.actions),
      pointer: projectNormalizedPoint(handCenter.x, handCenter.y, projection),
      hands: {
        selected: hand,
        left: pose.leftHandCenter,
        right: pose.rightHandCenter,
        shoulderSpan: frameNormalizedDistance(pose.leftShoulder, pose.rightShoulder, frame),
      },
      controlsArmed: false,
      poseIndex: pose.poseIndex,
      hoveredAction: null,
      hoverStartedAtMs: null,
      latchedAction: null,
      belowHipsSinceMs: null,
      displacedSinceMs: null,
    };
    this.candidate = null;
  }

  private updateLease(
    poses: readonly PoseDescriptor[],
    frame: Size,
    nowMs: number,
  ): PoseControlUpdate<TAction> {
    const lease = this.lease;
    const viewport = this.viewport;
    if (lease === null || viewport === null) {
      return this.result(nowMs, null);
    }

    const pose = nearestPose(poses, lease.torsoCenter, LEASE_MATCH_DISTANCE);
    if (pose === null) {
      this.clearPointer();
      return this.tick(nowMs);
    }
    const wrist = wristForHand(pose, lease.hand);
    const handCenter = handCenterForHand(pose, lease.hand);
    if (wrist === null || handCenter === null) {
      this.clearPointer();
      return this.tick(nowMs);
    }

    lease.torsoCenter = pose.torsoCenter;
    lease.lastSeenAtMs = nowMs;
    lease.poseIndex = pose.poseIndex;
    lease.hands = {
      selected: lease.hand,
      left: pose.leftHandCenter,
      right: pose.rightHandCenter,
      shoulderSpan: frameNormalizedDistance(pose.leftShoulder, pose.rightShoulder, frame),
    };
    const projection = createPoseProjection(
      frame.width,
      frame.height,
      viewport.width,
      viewport.height,
      true,
    );
    lease.pointer = projectNormalizedPoint(handCenter.x, handCenter.y, projection);

    if (distance(handCenter, lease.lastMotionPoint) >= MEANINGFUL_POINTER_MOVEMENT) {
      lease.lastMotionPoint = handCenter;
      lease.lastMotionAtMs = nowMs;
    }

    if (wrist.y > pose.hipCenter.y) {
      lease.belowHipsSinceMs ??= nowMs;
      if (nowMs - lease.belowHipsSinceMs >= POSE_CONTROL_TIMING.belowHipsReleaseMs) {
        this.lease = null;
        return this.result(nowMs, null);
      }
    } else {
      lease.belowHipsSinceMs = null;
    }

    if (distance(pose.torsoCenter, lease.homeTorsoCenter) > LAYOUT_DISPLACEMENT_DISTANCE) {
      lease.displacedSinceMs ??= nowMs;
      if (nowMs - lease.displacedSinceMs >= POSE_CONTROL_TIMING.displacedReleaseMs) {
        this.lease = null;
        return this.result(nowMs, null);
      }
    } else {
      lease.displacedSinceMs = null;
    }

    const activated = this.updateHover(nowMs, true);
    return this.result(nowMs, activated);
  }

  private updateHover(nowMs: number, allowNeutralArm: boolean): TAction | null {
    const lease = this.lease;
    if (lease === null || lease.pointer === null) {
      return null;
    }
    const pointer = lease.pointer;

    if (!lease.controlsArmed) {
      lease.hoveredAction = null;
      lease.hoverStartedAtMs = null;
      lease.latchedAction = null;
      if (
        allowNeutralArm &&
        lease.targets.every((target) => !containsPoint(target.rect, pointer, HOVER_HYSTERESIS_PX))
      ) {
        lease.controlsArmed = true;
      }
      return null;
    }

    const previousTarget = lease.targets.find((target) => target.action === lease.hoveredAction);
    const retainedTarget =
      previousTarget !== undefined &&
      containsPoint(previousTarget.rect, pointer, HOVER_HYSTERESIS_PX)
        ? previousTarget
        : null;
    const target =
      retainedTarget ??
      lease.targets.find((candidate) => containsPoint(candidate.rect, pointer, 0)) ??
      null;

    if (target?.action !== lease.hoveredAction) {
      lease.hoveredAction = target?.action ?? null;
      lease.hoverStartedAtMs = target === null ? null : nowMs;
      lease.latchedAction = null;
    }
    if (
      target === null ||
      lease.hoverStartedAtMs === null ||
      lease.latchedAction === target.action ||
      nowMs - lease.hoverStartedAtMs < target.dwellMs
    ) {
      return null;
    }

    lease.latchedAction = target.action;
    lease.lastMotionAtMs = nowMs;
    return target.action;
  }

  private clearPointer(): void {
    if (this.lease === null) {
      return;
    }
    this.lease.pointer = null;
    this.lease.hands = null;
    this.lease.hoveredAction = null;
    this.lease.hoverStartedAtMs = null;
    this.lease.latchedAction = null;
  }

  private result(nowMs: number, activated: TAction | null): PoseControlUpdate<TAction> {
    const lease = this.lease;
    if (lease !== null) {
      const hoveredTarget = lease.targets.find((target) => target.action === lease.hoveredAction);
      const dwellProgress =
        lease.hoverStartedAtMs === null || hoveredTarget === undefined
          ? 0
          : clamp((nowMs - lease.hoverStartedAtMs) / hoveredTarget.dwellMs, 0, 1);
      return {
        activated,
        snapshot: {
          phase: "active",
          visiblePeople: this.visiblePeople,
          requiresBothHands: this.multiplePeople,
          claimProgress: 1,
          targets: lease.targets,
          pointer: lease.pointer,
          hands: lease.hands,
          controlsArmed: lease.controlsArmed,
          hoveredAction: lease.hoveredAction,
          dwellProgress,
          controllerPoseIndex: lease.poseIndex,
        },
      };
    }

    const requiredHoldMs = this.multiplePeople
      ? POSE_CONTROL_TIMING.multiplePeopleClaimMs
      : POSE_CONTROL_TIMING.singlePersonClaimMs;
    return {
      activated,
      snapshot: {
        phase:
          this.visiblePeople === 0
            ? "no-pose"
            : !this.headroomAvailable
              ? "needs-headroom"
              : this.candidate === null
                ? "ready"
                : "claiming",
        visiblePeople: this.visiblePeople,
        requiresBothHands: this.multiplePeople,
        claimProgress:
          this.candidate === null
            ? 0
            : clamp((nowMs - this.candidate.startedAtMs) / requiredHoldMs, 0, 1),
        targets: [],
        pointer: null,
        hands: null,
        controlsArmed: false,
        hoveredAction: null,
        dwellProgress: 0,
        controllerPoseIndex: null,
      },
    };
  }
}

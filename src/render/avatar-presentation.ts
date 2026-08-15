import {
  type DetectedPose,
  type PoseLandmark,
  type PosePacket,
  USABLE_LANDMARK_VISIBILITY,
} from "../domain/pose";
import { sameCameraFrameBasis } from "../domain/camera";
import type { PoseHand } from "../domain/pose-features";

export const AVATAR_PRESENTATION_TIMING = {
  maximumContinuationGapMs: 250,
  slowSmoothingTimeMs: 72,
  fastSmoothingTimeMs: 22,
  fullResponsivenessSpeed: 0.9,
  segmentReferenceTimeMs: 420,
  segmentCorrectionRatio: 0.55,
  maximumSegmentCorrectionRatio: 0.12,
  nearSideSwitchDepth: 0.035,
} as const;

export interface AvatarPresentationPose extends DetectedPose {
  sourcePoseIndex: number;
  nearSide: PoseHand;
}

export interface AvatarPresentationFrame {
  sequence: number;
  capturedAtMs: number;
  frame: PosePacket["frame"];
  poses: AvatarPresentationPose[];
}

interface LandmarkHistory {
  raw: PoseLandmark;
  displayed: PoseLandmark;
}

interface LimbChain {
  indices: readonly number[];
  attachments: readonly number[];
}

const DEPTH_INDICES = {
  left: [11, 13, 15, 23, 25, 27],
  right: [12, 14, 16, 24, 26, 28],
} as const satisfies Record<PoseHand, readonly number[]>;

const LIMB_CHAINS: readonly LimbChain[] = [
  { indices: [11, 13, 15], attachments: [17, 19, 21] },
  { indices: [12, 14, 16], attachments: [18, 20, 22] },
  { indices: [23, 25, 27], attachments: [29, 31] },
  { indices: [24, 26, 28], attachments: [30, 32] },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cloneLandmark(landmark: PoseLandmark): PoseLandmark {
  return { ...landmark };
}

function clonePose(pose: DetectedPose, sourcePoseIndex: number): AvatarPresentationPose {
  return {
    sourcePoseIndex,
    nearSide: currentNearSide(pose, null),
    landmarks: pose.landmarks.map(cloneLandmark),
  };
}

function meanUsableDepth(pose: DetectedPose, indices: readonly number[]): number | null {
  let sum = 0;
  let count = 0;
  for (const index of indices) {
    const landmark = pose.landmarks[index];
    if (landmark !== undefined && landmark.visibility >= USABLE_LANDMARK_VISIBILITY) {
      sum += landmark.z;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

function currentNearSide(pose: DetectedPose, established: PoseHand | null): PoseHand {
  const leftDepth = meanUsableDepth(pose, DEPTH_INDICES.left);
  const rightDepth = meanUsableDepth(pose, DEPTH_INDICES.right);
  if (leftDepth === null || rightDepth === null) {
    return established ?? "right";
  }

  const candidate: PoseHand = leftDepth < rightDepth ? "left" : "right";
  if (established === null || candidate === established) {
    return candidate;
  }
  return Math.abs(leftDepth - rightDepth) >= AVATAR_PRESENTATION_TIMING.nearSideSwitchDepth
    ? candidate
    : established;
}

function minimumDimension(frame: PosePacket["frame"]): number {
  return Math.min(frame.width, frame.height);
}

function frameDistance(
  left: Pick<PoseLandmark, "x" | "y">,
  right: Pick<PoseLandmark, "x" | "y">,
  frame: PosePacket["frame"],
): number {
  const minimum = minimumDimension(frame);
  return Math.hypot(
    ((left.x - right.x) * frame.width) / minimum,
    ((left.y - right.y) * frame.height) / minimum,
  );
}

function segmentKey(parentIndex: number, childIndex: number): string {
  return `${parentIndex}:${childIndex}`;
}

function segmentLength(
  parent: PoseLandmark,
  child: PoseLandmark,
  frame: PosePacket["frame"],
): number {
  return frameDistance(parent, child, frame);
}

function usable(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return landmark !== undefined && landmark.visibility >= USABLE_LANDMARK_VISIBILITY;
}

function initializeSegmentReferences(
  pose: AvatarPresentationPose,
  frame: PosePacket["frame"],
  references: Map<string, number>,
): void {
  references.clear();
  for (const chain of LIMB_CHAINS) {
    for (let index = 0; index < chain.indices.length - 1; index += 1) {
      const parentIndex = chain.indices[index];
      const childIndex = chain.indices[index + 1];
      if (parentIndex === undefined || childIndex === undefined) {
        continue;
      }
      const parent = pose.landmarks[parentIndex];
      const child = pose.landmarks[childIndex];
      if (usable(parent) && usable(child)) {
        references.set(segmentKey(parentIndex, childIndex), segmentLength(parent, child, frame));
      }
    }
  }
}

function shiftLandmarks(
  pose: AvatarPresentationPose,
  indices: readonly number[],
  deltaX: number,
  deltaY: number,
): void {
  for (const index of indices) {
    const landmark = pose.landmarks[index];
    if (usable(landmark)) {
      landmark.x += deltaX;
      landmark.y += deltaY;
    }
  }
}

function stabilizeSegmentLengths(
  pose: AvatarPresentationPose,
  frame: PosePacket["frame"],
  elapsedMs: number,
  references: Map<string, number>,
): void {
  const referenceAlpha =
    1 - Math.exp(-elapsedMs / AVATAR_PRESENTATION_TIMING.segmentReferenceTimeMs);
  const minimum = minimumDimension(frame);

  for (const chain of LIMB_CHAINS) {
    for (let index = 0; index < chain.indices.length - 1; index += 1) {
      const parentIndex = chain.indices[index];
      const childIndex = chain.indices[index + 1];
      if (parentIndex === undefined || childIndex === undefined) {
        continue;
      }
      const key = segmentKey(parentIndex, childIndex);
      const parent = pose.landmarks[parentIndex];
      const child = pose.landmarks[childIndex];
      if (!usable(parent) || !usable(child)) {
        references.delete(key);
        continue;
      }

      const measuredLength = segmentLength(parent, child, frame);
      if (measuredLength <= Number.EPSILON) {
        references.delete(key);
        continue;
      }
      const previousReference = references.get(key) ?? measuredLength;
      const reference = previousReference + (measuredLength - previousReference) * referenceAlpha;
      references.set(key, reference);

      const unconstrainedCorrection =
        (reference - measuredLength) * AVATAR_PRESENTATION_TIMING.segmentCorrectionRatio;
      const maximumCorrection =
        measuredLength * AVATAR_PRESENTATION_TIMING.maximumSegmentCorrectionRatio;
      const correction = clamp(unconstrainedCorrection, -maximumCorrection, maximumCorrection);
      if (Math.abs(correction) <= Number.EPSILON) {
        continue;
      }

      const aspectDeltaX = ((child.x - parent.x) * frame.width) / minimum;
      const aspectDeltaY = ((child.y - parent.y) * frame.height) / minimum;
      const scale = correction / measuredLength;
      const deltaX = (aspectDeltaX * scale * minimum) / frame.width;
      const deltaY = (aspectDeltaY * scale * minimum) / frame.height;
      const descendants = [...chain.indices.slice(index + 1), ...chain.attachments];
      shiftLandmarks(pose, descendants, deltaX, deltaY);
    }
  }
}

export class AvatarPresentationSession {
  private landmarkHistory: Array<LandmarkHistory | null> = [];
  private readonly segmentReferences = new Map<string, number>();
  private lastSequence: number | null = null;
  private lastCapturedAtMs: number | null = null;
  private lastFrame: PosePacket["frame"] | null = null;
  private nearSide: PoseHand | null = null;
  private cachedFrame: AvatarPresentationFrame | null = null;

  public update(packet: PosePacket | null): AvatarPresentationFrame | null {
    if (packet === null) {
      this.reset();
      return null;
    }
    if (this.lastSequence === packet.sequence && this.cachedFrame !== null) {
      return this.cachedFrame;
    }

    if (packet.poses.length !== 1) {
      this.resetTemporalState();
      return this.cache(packet, packet.poses.map(clonePose));
    }

    const sourcePose = packet.poses[0];
    if (sourcePose === undefined) {
      this.resetTemporalState();
      return this.cache(packet, []);
    }
    const elapsedMs =
      this.lastCapturedAtMs === null ? null : packet.capturedAtMs - this.lastCapturedAtMs;
    const continuous =
      this.lastSequence !== null &&
      packet.sequence > this.lastSequence &&
      elapsedMs !== null &&
      elapsedMs > 0 &&
      elapsedMs <= AVATAR_PRESENTATION_TIMING.maximumContinuationGapMs &&
      this.lastFrame !== null &&
      sameCameraFrameBasis(this.lastFrame, packet.frame) &&
      this.landmarkHistory.length === sourcePose.landmarks.length;

    if (!continuous || elapsedMs === null) {
      this.resetTemporalState();
      const pose = clonePose(sourcePose, 0);
      this.nearSide = pose.nearSide;
      this.landmarkHistory = sourcePose.landmarks.map((landmark) =>
        landmark.visibility >= USABLE_LANDMARK_VISIBILITY
          ? { raw: cloneLandmark(landmark), displayed: cloneLandmark(landmark) }
          : null,
      );
      initializeSegmentReferences(pose, packet.frame, this.segmentReferences);
      return this.cache(packet, [pose]);
    }

    const pose: AvatarPresentationPose = {
      sourcePoseIndex: 0,
      nearSide: currentNearSide(sourcePose, this.nearSide),
      landmarks: sourcePose.landmarks.map((landmark, index) => {
        const history = this.landmarkHistory[index];
        if (
          landmark.visibility < USABLE_LANDMARK_VISIBILITY ||
          history === null ||
          history === undefined
        ) {
          return cloneLandmark(landmark);
        }

        const speed = frameDistance(history.raw, landmark, packet.frame) / (elapsedMs / 1_000);
        const responsiveness = clamp(
          speed / AVATAR_PRESENTATION_TIMING.fullResponsivenessSpeed,
          0,
          1,
        );
        const timeConstantMs =
          AVATAR_PRESENTATION_TIMING.slowSmoothingTimeMs -
          (AVATAR_PRESENTATION_TIMING.slowSmoothingTimeMs -
            AVATAR_PRESENTATION_TIMING.fastSmoothingTimeMs) *
            responsiveness;
        const alpha = 1 - Math.exp(-elapsedMs / timeConstantMs);
        return {
          x: history.displayed.x + (landmark.x - history.displayed.x) * alpha,
          y: history.displayed.y + (landmark.y - history.displayed.y) * alpha,
          z: history.displayed.z + (landmark.z - history.displayed.z) * alpha,
          visibility: landmark.visibility,
        };
      }),
    };
    stabilizeSegmentLengths(pose, packet.frame, elapsedMs, this.segmentReferences);
    this.nearSide = pose.nearSide;
    this.landmarkHistory = sourcePose.landmarks.map((landmark, index) => {
      const displayed = pose.landmarks[index];
      return landmark.visibility >= USABLE_LANDMARK_VISIBILITY && displayed !== undefined
        ? { raw: cloneLandmark(landmark), displayed: cloneLandmark(displayed) }
        : null;
    });
    return this.cache(packet, [pose]);
  }

  private cache(packet: PosePacket, poses: AvatarPresentationPose[]): AvatarPresentationFrame {
    const frame: AvatarPresentationFrame = {
      sequence: packet.sequence,
      capturedAtMs: packet.capturedAtMs,
      frame: { ...packet.frame },
      poses,
    };
    this.lastSequence = packet.sequence;
    this.lastCapturedAtMs = packet.capturedAtMs;
    this.lastFrame = { ...packet.frame };
    this.cachedFrame = frame;
    return frame;
  }

  private resetTemporalState(): void {
    this.landmarkHistory = [];
    this.segmentReferences.clear();
    this.nearSide = null;
  }

  private reset(): void {
    this.resetTemporalState();
    this.lastSequence = null;
    this.lastCapturedAtMs = null;
    this.lastFrame = null;
    this.cachedFrame = null;
  }
}

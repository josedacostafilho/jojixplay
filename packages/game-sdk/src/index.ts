/** Unmirrored normalized camera coordinates. A missing joint is unavailable, never inferred. */
export interface Joint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly confidence: number;
}

export const jointNames = [
  "nose",
  "leftEye",
  "rightEye",
  "leftEar",
  "rightEar",
  "leftShoulder",
  "rightShoulder",
  "leftElbow",
  "rightElbow",
  "leftWrist",
  "rightWrist",
  "leftPinky",
  "rightPinky",
  "leftIndex",
  "rightIndex",
  "leftThumb",
  "rightThumb",
  "leftHip",
  "rightHip",
  "leftKnee",
  "rightKnee",
  "leftAnkle",
  "rightAnkle",
  "leftHeel",
  "rightHeel",
  "leftFoot",
  "rightFoot",
] as const;
export type JointName = (typeof jointNames)[number];
export type Body = Readonly<Partial<Record<JointName, Joint>>>;

export interface BodyFrame {
  readonly sequence: number;
  readonly capturedAtMs: number;
  readonly width: number;
  readonly height: number;
  readonly epoch: number;
  /** Observations, not stable player identities. */
  readonly bodies: readonly Body[];
}

/** Each mount owns its resources. dispose must release them; null input clears stale tracking. */
export interface Experience {
  update(frame: BodyFrame | null): void;
  dispose(): void;
}
export type MountExperience = (container: HTMLElement) => Experience;

export const BODY_FRESHNESS_MS = 250;
export function isFresh(frame: BodyFrame, now: number): boolean {
  const age = now - frame.capturedAtMs;
  return age >= 0 && age <= BODY_FRESHNESS_MS;
}

export { mountMovementControls, type ControlPoint } from "./movement-controls";

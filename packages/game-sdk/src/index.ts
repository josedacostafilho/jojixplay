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

/** Unmirrored normalized camera coordinates. A detected hand always has every point; one may lie outside the frame. */
export interface HandPoint {
  readonly x: number;
  readonly y: number;
  /** Depth relative to the wrist, in roughly the same scale as x. Smaller is nearer the camera. */
  readonly z: number;
}

export const handPointNames = [
  "wrist",
  "thumbBase",
  "thumbKnuckle",
  "thumbJoint",
  "thumbTip",
  "indexKnuckle",
  "indexMiddle",
  "indexJoint",
  "indexTip",
  "middleKnuckle",
  "middleMiddle",
  "middleJoint",
  "middleTip",
  "ringKnuckle",
  "ringMiddle",
  "ringJoint",
  "ringTip",
  "pinkyKnuckle",
  "pinkyMiddle",
  "pinkyJoint",
  "pinkyTip",
] as const;
export type HandPointName = (typeof handPointNames)[number];

export interface Hand {
  /** The person's own left or right hand, as with body joints. */
  readonly side: "left" | "right";
  /** How sure the model is of `side`. */
  readonly confidence: number;
  readonly points: Readonly<Record<HandPointName, HandPoint>>;
}

/**
 * What the host turns camera images into. Sensing is the host's job and happens once for
 * everyone; what a wrist or a fingertip means is each game's own business.
 */
export const sensings = ["body", "hands", "silhouette"] as const;
export type Sensing = (typeof sensings)[number];

/**
 * Where people are in the camera image: one value per pixel of a `width` by `height` grid laid
 * over the whole unmirrored image, row by row from the top left. 0 is certainly not a person, 255
 * certainly a person, and edges fall in between. The grid is coarser than the image.
 */
export interface Silhouette {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

/** What every sensed frame says about the camera image it came from. */
export interface Observation {
  readonly sequence: number;
  readonly capturedAtMs: number;
  readonly width: number;
  readonly height: number;
  readonly epoch: number;
}

export interface BodyFrame extends Observation {
  /** Observations, not stable player identities. Empty unless the host is sensing bodies. */
  readonly bodies: readonly Body[];
}

export interface HandFrame extends Observation {
  /** Observations, not stable identities. Empty unless the host is sensing hands. */
  readonly hands: readonly Hand[];
}

export interface SilhouetteFrame extends Observation {
  /**
   * Everyone in view as one shape. Null unless the host is sensing silhouettes; while it is, the
   * frame carries the bodies too.
   */
  readonly silhouette: Silhouette | null;
}

/** Everything the host sensed in one camera image. A game types its input by the part it reads. */
export interface Frame extends BodyFrame, HandFrame, SilhouetteFrame {
  readonly sensing: Sensing;
}

/** Each mount owns its resources. dispose must release them; null input clears stale tracking. */
export interface Experience<Input extends Observation = BodyFrame> {
  update(frame: Input | null): void;
  dispose(): void;
}

/**
 * The live camera picture, for a game to draw with. `video` holds the pixels as the camera
 * delivers them; turning them clockwise by `rotation` degrees gives the upright image that every
 * observation is measured in. The picture is always newer than the latest observation.
 */
export interface CameraImage {
  readonly video: HTMLVideoElement;
  readonly rotation: 0 | 90 | 180 | 270;
}

/** What a mounted game may ask of its host. Games own every control shown while they run. */
export interface GameHost {
  /** Leave the game. The game confirms with the players before calling this. */
  exit(): void;
  /**
   * Change what the camera senses. A game starts with "body". Resolves once the change is
   * applied; frames carry the new `sensing` and a new epoch. If it cannot be applied the promise
   * rejects and the host ends the session.
   */
  sense(sensing: Sensing): Promise<void>;
  /**
   * Show or hide the host's camera image behind the game: mirrored and covering the viewport,
   * exactly as `cameraCover` describes. Hidden when a game starts.
   */
  showCamera(visible: boolean): void;
  /**
   * The live camera picture, or null while the camera has none. A game may draw it and must not
   * record it, keep copies of it or send it anywhere.
   */
  camera(): CameraImage | null;
}

export const BODY_FRESHNESS_MS = 250;
export function isFresh(frame: Observation, now: number): boolean {
  const age = now - frame.capturedAtMs;
  return age >= 0 && age <= BODY_FRESHNESS_MS;
}

/**
 * Where a camera image of the given size lands when it covers the viewport, exactly as
 * object-fit: cover would place it. The host shows the image mirrored, so a normalized camera
 * point appears at `left + (1 - x) * width`, `top + y * height`.
 */
export function cameraCover(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const scale = Math.max(viewportWidth / width, viewportHeight / height);
  return {
    width: width * scale,
    height: height * scale,
    left: (viewportWidth - width * scale) / 2,
    top: (viewportHeight - height * scale) / 2,
    scale,
  };
}

export {
  type ControlPoint,
  type MovementControls,
  mountMovementControls,
} from "./movement-controls";

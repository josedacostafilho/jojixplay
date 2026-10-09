import type { Body, Joint } from "@jojixplay/game-sdk";

// Phone-tuning parameters. Everything is measured in the player's own body, so a small child and
// a tall adult get the same avatar movement for the same effort.
export const TUNING = {
  /** A run may start only with the player this close to the middle of the camera's view. */
  startReach: 0.25,
  /** One lane is this many shoulder widths: about one comfortable step. */
  lanePerShoulder: 1.25,
  /** Lanes are narrowed, if need be, to keep this share of the view free at each side. */
  edgeMargin: 0.04,
  /** How far past a lane's boundary, in lanes, the player must go before the lane changes. */
  laneHysteresis: 0.12,
  /** Shoulders lowered by this share of the torso's length is a full crouch. */
  crouchPerTorso: 0.6,
  duckAt: 0.5,
  standAt: 0.35,
  /** A torso the camera cannot measure is taken to be this many shoulder widths long. */
  torsoPerShoulder: 1.4,
  /** Closer than this to the side of the camera's view, the player is about to leave it. */
  viewEdge: 0.06,
} as const;

export type Lane = -1 | 0 | 1;

/** A direction on the screen, seen from behind the avatar: x to the right, y up, unit length. */
export interface Direction {
  readonly x: number;
  readonly y: number;
}

export interface Arm {
  readonly upper: Direction;
  /** Null when the forearm cannot be seen; the avatar's then hangs from the elbow. */
  readonly lower: Direction | null;
}

/** What the player's body is doing, in the avatar's terms. */
export interface Puppet {
  /** Sideways position in lanes: 0 is where the run started, negative is to the screen's left. */
  readonly offset: number;
  /** The lane the game counts the player in, which changes only on a clear step. */
  readonly lane: Lane;
  /** 0 standing, 1 fully crouched. */
  readonly crouch: number;
  readonly ducked: boolean;
  /** Torso lean in radians, positive towards the screen's right. */
  readonly lean: number;
  /** Each arm the camera can see, by the player's own side. */
  readonly arms: { readonly left: Arm | null; readonly right: Arm | null };
  /** The player is close to walking out of the camera's view. */
  readonly nearEdge: boolean;
}

/** What a run remembers about where and how tall the player stood when it began. */
export interface Calibration {
  readonly centerX: number;
  /** One lane, as a share of the camera view's width. */
  readonly laneWidth: number;
  readonly shoulderY: number;
  /** Shoulders to hips, as a share of the camera view's height. */
  readonly torso: number;
}

function middle(a: Joint | undefined, b: Joint | undefined) {
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
}

/**
 * The avatar is seen from behind, facing the way the player faces: the player's left is the
 * screen's left. The camera faces the player, so its image is the other way round.
 */
function onScreen(from: Joint, to: Joint, aspect: number): Direction | null {
  const x = -(to.x - from.x) * aspect;
  const y = -(to.y - from.y);
  const length = Math.hypot(x, y);
  return length < 0.004 ? null : { x: x / length, y: y / length };
}

function shoulderWidth(body: Body, aspect: number): number | null {
  const { leftShoulder: left, rightShoulder: right } = body;
  // Measured in shares of the view's height, so it compares with vertical distances.
  return left && right ? Math.hypot((left.x - right.x) * aspect, left.y - right.y) : null;
}

/**
 * Where the player stands. Hips stay put when the torso leans and move when the player steps, so
 * they decide; shoulders stand in when the camera cannot see the hips.
 */
export function standingX(body: Body): number | null {
  return (
    middle(body.leftHip, body.rightHip)?.x ??
    middle(body.leftShoulder, body.rightShoulder)?.x ??
    null
  );
}

/** Whether a run could start with the player where they are: both shoulders seen, near the middle. */
export function canStart(body: Body): boolean {
  const x = standingX(body);
  return (
    !!body.leftShoulder &&
    !!body.rightShoulder &&
    x !== null &&
    Math.abs(x - 0.5) <= TUNING.startReach
  );
}

/**
 * Lays the three lanes out around the player: centred where they stand, one comfortable step
 * wide for their size, and narrowed if that is needed to keep all three inside the camera's view.
 */
export function calibrate(body: Body, aspect: number): Calibration | null {
  const centerX = standingX(body);
  const shoulders = middle(body.leftShoulder, body.rightShoulder);
  const width = shoulderWidth(body, aspect);
  if (centerX === null || !shoulders || width === null || !canStart(body)) return null;
  const hips = middle(body.leftHip, body.rightHip);
  const room = Math.min(centerX, 1 - centerX) - TUNING.edgeMargin;
  return {
    centerX,
    laneWidth: Math.min((width / aspect) * TUNING.lanePerShoulder, room / 1.5),
    shoulderY: shoulders.y,
    torso: hips ? Math.max(hips.y - shoulders.y, width * 0.8) : width * TUNING.torsoPerShoulder,
  };
}

function arm(body: Body, side: "left" | "right", aspect: number): Arm | null {
  const shoulder = body[`${side}Shoulder`];
  const elbow = body[`${side}Elbow`];
  const wrist = body[`${side}Wrist`];
  const upper = shoulder && elbow ? onScreen(shoulder, elbow, aspect) : null;
  if (!upper) return null;
  return { upper, lower: elbow && wrist ? onScreen(elbow, wrist, aspect) : null };
}

function lean(body: Body, aspect: number): number {
  const shoulders = middle(body.leftShoulder, body.rightShoulder);
  const hips = middle(body.leftHip, body.rightHip);
  if (shoulders && hips) {
    return Math.atan2(-(shoulders.x - hips.x) * aspect, -(shoulders.y - hips.y));
  }
  // Without hips, the tilt of the shoulder line says nearly the same thing.
  const { leftShoulder: left, rightShoulder: right } = body;
  const line = left && right ? onScreen(left, right, aspect) : null;
  return line ? -Math.atan2(line.y, line.x) : 0;
}

/** Arms and lean alone, for the avatar to copy the player before a run has been calibrated. */
export function preview(body: Body, aspect: number): Puppet {
  return {
    offset: 0,
    lane: 0,
    crouch: 0,
    ducked: false,
    lean: lean(body, aspect),
    arms: { left: arm(body, "left", aspect), right: arm(body, "right", aspect) },
    nearEdge: false,
  };
}

/** Reads the player's body against one run's calibration. Lane and duck decisions do not flicker. */
export class PuppetReader {
  private lane: Lane = 0;
  private offset = 0;
  private ducked = false;

  public constructor(public readonly calibration: Calibration) {}

  public read(body: Body, aspect: number): Puppet {
    const { centerX, laneWidth, shoulderY, torso } = this.calibration;
    const x = standingX(body);
    const shoulders = middle(body.leftShoulder, body.rightShoulder);
    // A player the camera cannot place for a moment is taken to be where they last were.
    const lanes = x === null ? this.offset : -(x - centerX) / laneWidth;
    this.offset = lanes;
    const step = 0.5 + TUNING.laneHysteresis;
    while (lanes > this.lane + step && this.lane < 1) this.lane = (this.lane + 1) as Lane;
    while (lanes < this.lane - step && this.lane > -1) this.lane = (this.lane - 1) as Lane;

    const crouch = shoulders
      ? Math.max(0, Math.min(1, (shoulders.y - shoulderY) / (torso * TUNING.crouchPerTorso)))
      : this.ducked
        ? 1
        : 0;
    this.ducked = crouch >= (this.ducked ? TUNING.standAt : TUNING.duckAt);

    const seen = shoulders?.x ?? x;
    return {
      // The avatar stops at the road's edge however far the player goes.
      offset: Math.max(-1.5, Math.min(1.5, lanes)),
      lane: this.lane,
      crouch,
      ducked: this.ducked,
      lean: lean(body, aspect),
      arms: { left: arm(body, "left", aspect), right: arm(body, "right", aspect) },
      nearEdge: seen !== null && (seen < TUNING.viewEdge || seen > 1 - TUNING.viewEdge),
    };
  }
}

import type { Body, Joint, WorldBody, WorldJoint } from "@jojixplay/game-sdk";

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
  /**
   * Head and shoulders all this share of the torso's length above where they stood is a jump;
   * back under the lower mark, the player has landed.
   */
  jumpAt: 0.12,
  landAt: 0.05,
  /**
   * A punch is a wrist moving forward by `rise` of its arm's own length inside `withinMs`,
   * wherever it starts from, and ending at least `least` in front of its shoulder. The arm can
   * punch again once the wrist has come back by `rearm` from the furthest it reached.
   */
  punch: { rise: 0.2, withinMs: 260, least: 0.15, rearm: 0.15 },
  /** How far the torso is taken to lean back and forward, in radians. */
  pitch: { back: -0.3, forward: 0.8 },
  /** A torso the camera cannot measure is taken to be this many shoulder widths long. */
  torsoPerShoulder: 1.4,
  /** Closer than this to the side of the camera's view, the player is about to leave it. */
  viewEdge: 0.06,
} as const;

export type Lane = -1 | 0 | 1;

/**
 * A direction in the avatar's own space, unit length: x to its right, which is the screen's
 * right, y up, z the way it faces, down the road.
 */
export interface Direction {
  readonly x: number;
  readonly y: number;
  readonly z: number;
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
  /** How far above standing height the player is, as a share of the torso's length. */
  readonly rise: number;
  /** In the air: set on leaving the ground and cleared on landing, without flicker between. */
  readonly jumping: boolean;
  /** Torso lean in radians, positive towards the screen's right. */
  readonly lean: number;
  /** Torso lean forward in radians; negative is leaning back. */
  readonly pitch: number;
  /** Each arm the camera can see, by the player's own side. */
  readonly arms: { readonly left: Arm | null; readonly right: Arm | null };
  /**
   * How far in front of its shoulder each wrist is, as a share of that arm's length; null for an
   * arm the camera cannot see whole.
   */
  readonly reach: { readonly left: number | null; readonly right: number | null };
  /** A punch was thrown in this very reading, by the player's own side. */
  readonly thrown: { readonly left: boolean; readonly right: boolean };
  /** The last punch read: how far the wrist went forward, and in how long. */
  readonly lastPunch: Punch | null;
  /** The player is close to walking out of the camera's view. */
  readonly nearEdge: boolean;
}

export interface Punch {
  readonly side: "left" | "right";
  /** As a share of the arm's length. */
  readonly rise: number;
  readonly ms: number;
}

/** What a run remembers about where and how tall the player stood when it began. */
export interface Calibration {
  readonly centerX: number;
  /** One lane, as a share of the camera view's width. */
  readonly laneWidth: number;
  /**
   * How high each of these stood, as shares of the view's height. A crouch is how far whichever
   * of them the camera can still see has come down; the head is seen when shoulders are hidden.
   */
  readonly standing: Readonly<Partial<Record<(typeof HEIGHT_MARKS)[number], number>>>;
  /** Shoulders to hips, as a share of the camera view's height. */
  readonly torso: number;
}

/** Parts whose height tells a crouch, most trusted first. */
const HEIGHT_MARKS = ["leftShoulder", "rightShoulder", "nose", "leftEar", "rightEar"] as const;

function middle(a: Joint | undefined, b: Joint | undefined) {
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
}

/**
 * The avatar faces the way the player faces, into the screen: the player's left is the
 * screen's left. The camera faces the player, so its image is the other way round.
 */
function onScreen(from: Joint, to: Joint, aspect: number): { x: number; y: number } | null {
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
    standing: Object.fromEntries(
      HEIGHT_MARKS.flatMap((mark) => {
        const joint = body[mark];
        return joint ? [[mark, joint.y]] : [];
      }),
    ),
    torso: hips ? Math.max(hips.y - shoulders.y, width * 0.8) : width * TUNING.torsoPerShoulder,
  };
}

/**
 * From one joint to another in the avatar's space. The player faces the camera and the avatar
 * faces into the screen, the same way, so all three of the camera's axes are the other way
 * round: its right is the player's left, its down is up, and towards it is forwards.
 */
function towards(from: WorldJoint, to: WorldJoint): Direction | null {
  const x = -(to.x - from.x);
  const y = -(to.y - from.y);
  const z = -(to.z - from.z);
  const length = Math.hypot(x, y, z);
  return length < 0.01 ? null : { x: x / length, y: y / length, z: z / length };
}

function arm(world: WorldBody, side: "left" | "right"): Arm | null {
  const shoulder = world[`${side}Shoulder`];
  const elbow = world[`${side}Elbow`];
  const wrist = world[`${side}Wrist`];
  const upper = shoulder && elbow ? towards(shoulder, elbow) : null;
  if (!upper) return null;
  return { upper, lower: elbow && wrist ? towards(elbow, wrist) : null };
}

function reach(world: WorldBody, side: "left" | "right"): number | null {
  const shoulder = world[`${side}Shoulder`];
  const elbow = world[`${side}Elbow`];
  const wrist = world[`${side}Wrist`];
  if (!shoulder || !elbow || !wrist) return null;
  const length =
    Math.hypot(elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z) +
    Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y, wrist.z - elbow.z);
  return length < 0.05 ? null : -(wrist.z - shoulder.z) / length;
}

function pitch(world: WorldBody): number {
  const { leftShoulder, rightShoulder, leftHip, rightHip } = world;
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return 0;
  const forward = -(leftShoulder.z + rightShoulder.z - leftHip.z - rightHip.z);
  const up = -(leftShoulder.y + rightShoulder.y - leftHip.y - rightHip.y);
  return Math.max(TUNING.pitch.back, Math.min(TUNING.pitch.forward, Math.atan2(forward, up)));
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
export function preview(body: Body, world: WorldBody, aspect: number): Puppet {
  return {
    offset: 0,
    lane: 0,
    crouch: 0,
    ducked: false,
    rise: 0,
    jumping: false,
    lean: lean(body, aspect),
    pitch: pitch(world),
    arms: { left: arm(world, "left"), right: arm(world, "right") },
    reach: { left: reach(world, "left"), right: reach(world, "right") },
    thrown: { left: false, right: false },
    lastPunch: null,
    nearEdge: false,
  };
}

/** Reads the player's body against one run's calibration. Lane and duck decisions do not flicker. */
export class PuppetReader {
  private lane: Lane = 0;
  private offset = 0;
  private ducked = false;
  private crouch = 0;
  private jumping = false;
  /** Each arm's recent reach, to tell a quick move forward from an arm merely held out. */
  private readonly arms = {
    left: { samples: [] as Array<{ at: number; reach: number }>, ready: true, furthest: 0 },
    right: { samples: [] as Array<{ at: number; reach: number }>, ready: true, furthest: 0 },
  };
  private lastPunch: Punch | null = null;

  public constructor(public readonly calibration: Calibration) {}

  /**
   * `world` is the same person in their own space: where they are comes from `body` alone. `at`
   * is when the reading was taken, in milliseconds; reading one twice changes nothing.
   */
  public read(body: Body, world: WorldBody, aspect: number, at: number): Puppet {
    const { centerX, laneWidth, standing, torso } = this.calibration;
    const x = standingX(body);
    const shoulders = middle(body.leftShoulder, body.rightShoulder);
    // A player the camera cannot place for a moment is taken to be where they last were.
    const lanes = x === null ? this.offset : -(x - centerX) / laneWidth;
    this.offset = lanes;
    const step = 0.5 + TUNING.laneHysteresis;
    while (lanes > this.lane + step && this.lane < 1) this.lane = (this.lane + 1) as Lane;
    while (lanes < this.lane - step && this.lane > -1) this.lane = (this.lane - 1) as Lane;

    // Crouching hides the body behind knees and arms: the camera often loses a shoulder or both
    // just as the player is lowest. Whatever it still sees says how far down they are, and when
    // it sees nothing they are taken to be as low as they last were.
    const drops = HEIGHT_MARKS.flatMap((mark) => {
      const joint = body[mark];
      const stood = standing[mark];
      return joint && stood !== undefined ? [joint.y - stood] : [];
    });
    if (drops.length > 0) {
      // The lowest reading wins: a part pushed down by the crouch is not undone by one that lags.
      const drop = Math.max(...drops);
      this.crouch = Math.max(0, Math.min(1, drop / (torso * TUNING.crouchPerTorso)));
    }
    const crouch = this.crouch;
    this.ducked = crouch >= (this.ducked ? TUNING.standAt : TUNING.duckAt);
    // A jump lifts every part at once. The part that rose least decides, so shoulders shrugged
    // up by raised arms are not a jump while the head stays where it was. Unseen is not airborne.
    const rise = drops.length > 0 ? Math.max(0, -Math.max(...drops) / torso) : 0;
    this.jumping = rise >= (this.jumping ? TUNING.landAt : TUNING.jumpAt);

    const reaches = { left: reach(world, "left"), right: reach(world, "right") };
    const thrown = { left: false, right: false };
    for (const side of ["left", "right"] as const) {
      const forward = reaches[side];
      const arm = this.arms[side];
      // An arm the camera cannot see whole tells nothing new.
      if (forward === null || arm.samples.at(-1)?.at === at) continue;
      arm.samples = arm.samples.filter((sample) => at - sample.at <= TUNING.punch.withinMs);
      if (!arm.ready) {
        arm.furthest = Math.max(arm.furthest, forward);
        arm.ready = forward <= arm.furthest - TUNING.punch.rearm;
      }
      // Measured from where the wrist was furthest back in the last moment.
      const from = arm.samples.reduce(
        (least, sample) => (sample.reach < least.reach ? sample : least),
        { at, reach: forward },
      );
      if (arm.ready && forward - from.reach >= TUNING.punch.rise && forward >= TUNING.punch.least) {
        thrown[side] = true;
        arm.ready = false;
        arm.furthest = forward;
        this.lastPunch = { side, rise: forward - from.reach, ms: at - from.at };
      }
      arm.samples.push({ at, reach: forward });
    }

    const seen = shoulders?.x ?? x;
    return {
      // The avatar stops at the road's edge however far the player goes.
      offset: Math.max(-1.5, Math.min(1.5, lanes)),
      lane: this.lane,
      crouch,
      ducked: this.ducked,
      rise,
      jumping: this.jumping,
      lean: lean(body, aspect),
      pitch: pitch(world),
      arms: { left: arm(world, "left"), right: arm(world, "right") },
      reach: reaches,
      thrown,
      lastPunch: this.lastPunch,
      nearEdge: seen !== null && (seen < TUNING.viewEdge || seen > 1 - TUNING.viewEdge),
    };
  }
}

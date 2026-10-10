import type { Arm, Direction } from "./puppet";

/**
 * One lane's width in world units. The road is three of them, with no line between. A lane is
 * several times the character's width, so a change of lane is a clear slide across the screen.
 */
export const LANE = 3.2;

/** Proportions of the one character, in world units. It is about 1.8 tall whoever plays. */
export const FIGURE = {
  hip: 0.86,
  torso: 0.52,
  shoulder: 0.21,
  /** From the shoulders up to the middle of the head. */
  neck: 0.24,
  head: 0.155,
  // Arms are a quarter longer than a real body's, so a pose reads from across a room.
  upperArm: 0.34,
  forearm: 0.32,
  hand: 0.116,
  limb: 0.075,
  /** How far a full crouch lowers the hips, and tips the torso forward, in radians. */
  crouchDrop: 0.45,
  crouchTip: 0.9,
  /** The angle from straight down at which an arm the camera cannot see hangs. */
  armRest: 0.14,
} as const;

/**
 * World units a second down the road. Everything that is a length of time for the player (the
 * moment before a log in which a jump counts, the clear road between obstacles, how long a tunnel
 * lasts) is written as seconds at this speed, so changing it changes the pace and nothing else.
 */
export const SPEED = 16;
/** How much road goes by in this many seconds. */
export const stretch = (seconds: number) => seconds * SPEED;

/** The underside of a beam. A character clears it when the top of its head is lower. */
export const BEAM_UNDERSIDE = 1.45;
/** A tunnel is a row of beams this far apart: too close together in time to stand up between. */
export const BEAM_SPACING = stretch(0.17);
/** How high a log lies across the road. */
export const LOG_HEIGHT = 0.55;
/**
 * How high the rails over a pool run: well out of a raised hand's reach from the ground, so the
 * character visibly swings up to them, and above the camera, so they never cross its view of it.
 */
export const RAIL_HEIGHT = 3;
/** How far each of a lane's two rails is from the lane's middle: over each shoulder. */
export const RAIL_SPREAD = FIGURE.shoulder;
/** A river runs in a channel this far below the road. */
export const WATER_LEVEL = -0.9;
/** How deep a character that fell into a river stands in it. */
export const POOL_DEPTH = 0.4;
/** A character that fell into a river goes down its bank, and up the far one, over this much road. */
export const BANK = 2.6;
/**
 * A character that fell into a ravine falls faster and faster, by `fall` units a second each
 * second, to `deepest` at most. The ravine's walls go down `depth` and are lost in the dark.
 * It is gone from sight `vanish` before where the far wall may first be.
 */
export const RAVINE = { fall: 30, deepest: 26, depth: 48, vanish: 1 } as const;
/**
 * The far edge of a gap is drawn ragged: anywhere from where the gap is said to end to this
 * much further on. Nothing is decided by where it is drawn; everything allows for the most.
 */
export const RECESS = { ravine: 3, river: 1 } as const;
/**
 * Past the furthest the far edge can be, by `clear`, a character is set down: let go by a vine,
 * or put back on the road from `from` above it over the next `drop` after a fall.
 */
export const LANDING = { clear: 0.3, from: 0.9, drop: stretch(0.15) } as const;
/** A vine swings down and up again: by `dip` for each unit across, and no more than `most`. */
export const SWING = { dip: 0.09, most: { ravine: 2, river: 0.9 } } as const;
/**
 * A hollow trunk lying along a lane. Its roof inside is where a beam's underside is, so what
 * ducks under a beam goes through it. `room` is how far from the lane's middle a character
 * inside it can be, and `beside` how near one outside it can come, in lanes.
 */
export const TRUNK = { inner: 0.78, outer: 1, wide: 1.3, room: 0.08, beside: 0.56 } as const;
/**
 * A falling tree starts to go `from` ahead of the character and is on the ground `lands` after
 * passing it. At the moment it passes it is drawn `over` high above the middle of the middle
 * lane: lower than a beam, so that nobody thinks to go under it with the head up.
 */
export const FELLING = { from: stretch(3), lands: stretch(0.25), over: 1.2 } as const;
/**
 * A monster is far taller and wider than the character, and comes at it: it is always `charge`
 * times as far off as a thing standing on the road would be, so it closes that much faster and
 * still arrives when the road says it does.
 */
export const MONSTER = { height: 3.4, width: 3, charge: 1.7 } as const;

export interface Spot {
  readonly x: number;
  readonly y: number;
}

/** What decides the character's outline: the same things whoever is asking. */
export interface Stance {
  readonly crouch: number;
  readonly lean: number;
  readonly pitch: number;
  readonly arms: { readonly left: Arm | null; readonly right: Arm | null };
}

interface ArmSpots {
  readonly shoulder: Spot;
  readonly elbow: Spot;
  readonly hand: Spot;
}

/**
 * Where the parts of a character are, looking the way it faces, with its feet at the origin. Arms reach
 * forward too, but nothing is judged by how far: only by how high and how far across.
 */
export interface Figure {
  readonly hips: Spot;
  readonly neck: Spot;
  readonly head: Spot;
  /** The top of the head. */
  readonly top: number;
  readonly left: ArmSpots;
  readonly right: ArmSpots;
}

/**
 * How far forward the torso tips, in radians: by a set amount in a crouch, and as the player
 * leans when standing, so the two never add up.
 */
export function torsoTip(crouch: number, pitch: number): number {
  return crouch * FIGURE.crouchTip + (1 - crouch) * pitch;
}

/**
 * The character's outline for a stance. The character is drawn from these same numbers, so
 * anything judged by this outline is judged by what the player sees.
 */
export function figure(stance: Stance): Figure {
  const hipY = FIGURE.hip - stance.crouch * FIGURE.crouchDrop;
  // Tipping forward brings the head down.
  const tall = Math.cos(torsoTip(stance.crouch, stance.pitch));
  const cos = Math.cos(stance.lean);
  const sin = Math.sin(stance.lean);
  /** A point on the torso, `across` from its middle and `up` from the hips, leaning with it. */
  const onTorso = (across: number, up: number): Spot => ({
    x: across * cos + up * tall * sin,
    y: hipY - across * sin + up * tall * cos,
  });
  const arm = (side: -1 | 1, seen: Arm | null): ArmSpots => {
    const rest: Direction = {
      x: Math.sin(side * FIGURE.armRest),
      y: -Math.cos(FIGURE.armRest),
      z: 0,
    };
    const upper = seen?.upper ?? rest;
    // A forearm the camera lost carries on straight from the upper arm.
    const lower = seen?.lower ?? upper;
    const shoulder = onTorso(side * FIGURE.shoulder, FIGURE.torso);
    const elbow = {
      x: shoulder.x + upper.x * FIGURE.upperArm,
      y: shoulder.y + upper.y * FIGURE.upperArm,
    };
    return {
      shoulder,
      elbow,
      hand: { x: elbow.x + lower.x * FIGURE.forearm, y: elbow.y + lower.y * FIGURE.forearm },
    };
  };
  const head = onTorso(0, FIGURE.torso + FIGURE.neck);
  return {
    hips: { x: 0, y: hipY },
    neck: onTorso(0, FIGURE.torso),
    head,
    top: head.y + FIGURE.head,
    left: arm(-1, stance.arms.left),
    right: arm(1, stance.arms.right),
  };
}

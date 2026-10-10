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

/** The underside of a beam. A character clears it when the top of its head is lower. */
export const BEAM_UNDERSIDE = 1.45;
/** A tunnel is a row of beams this far apart: too close together to stand up between. */
export const BEAM_SPACING = 1.8;
/** How high a log lies across the road. */
export const LOG_HEIGHT = 0.55;
/**
 * How high the rails over a pool run: well out of a raised hand's reach from the ground, so the
 * character visibly swings up to them, and above the camera, so they never cross its view of it.
 */
export const RAIL_HEIGHT = 3;
/** How far each of a lane's two rails is from the lane's middle: over each shoulder. */
export const RAIL_SPREAD = FIGURE.shoulder;
/** How deep a character that let go of the rails stands in the pool. */
export const POOL_DEPTH = 0.4;
/** A monster is far taller and wider than the character. */
export const MONSTER = { height: 3.4, width: 3 } as const;

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

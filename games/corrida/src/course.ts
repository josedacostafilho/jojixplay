import type { Lane } from "./puppet";
import { BEAM_SPACING, LANDING, RECESS, stretch } from "./world";

/** Something on the road, starting `at` this many world units from where the run began. */
export type Obstacle =
  /** Stands in one or two lanes: be in another. */
  | { readonly kind: "block"; readonly at: number; readonly lanes: readonly Lane[] }
  /** Beams across the whole road at chest height, one or a row of them as a tunnel: duck. */
  | { readonly kind: "beam"; readonly at: number; readonly beams: number }
  /** Lies across the whole road: jump. */
  | { readonly kind: "log"; readonly at: number }
  /**
   * A tree that comes down right across the road as the player nears, and is still coming down
   * as they pass: the lane on the side it falls from is closed, the middle one is low enough
   * that only a ducked head goes under, and the far one is clear.
   */
  | { readonly kind: "fall"; readonly at: number; readonly from: -1 | 1 }
  /** A hollow trunk lying along one lane: go round it, or through it ducked all the way. */
  | { readonly kind: "trunk"; readonly at: number; readonly length: number; readonly lane: Lane }
  /**
   * A gap across the whole road, a river or a ravine, with one or two ways over: a vine over
   * one lane, taken from that lane with a hand raised as the gap starts and held to its end,
   * and a hollow trunk bridging another, gone through ducked all the way.
   */
  | {
      readonly kind: "gap";
      readonly at: number;
      readonly length: number;
      readonly over: "river" | "ravine";
      readonly vine: Lane | null;
      readonly trunk: Lane | null;
    }
  /**
   * Comes down a lane: punch it, with the arm on its side. A great one reaches right across the
   * road and cannot be stepped around; a small one only gets a player in its own lane.
   */
  | {
      readonly kind: "monster";
      readonly at: number;
      readonly lane: Lane;
      readonly size: "great" | "small";
    };

/** The lane a hollow trunk lies along, for anything that has one. */
export function tube(obstacle: Obstacle): Lane | null {
  return obstacle.kind === "trunk"
    ? obstacle.lane
    : obstacle.kind === "gap"
      ? obstacle.trunk
      : null;
}

const FIRST_AT = stretch(3);
/** The last stretch before the finish is clear road. */
export const RUN_IN = stretch(3);
/** Clear road after an obstacle: about a second and a half of running. */
const GAP = { least: stretch(1.4), most: stretch(1.9) } as const;
const LANES: readonly Lane[] = [-1, 0, 1];
/** Tunnels last from about half a second to a second and a half. */
const TUNNEL_BEAMS = [4, 5, 6, 8, 10] as const;
/** How long each thing with a length lasts. A river is always about as wide; a ravine varies. */
const LENGTHS = {
  river: { least: stretch(1.25), most: stretch(1.85) },
  ravine: { least: stretch(1), most: stretch(3) },
  trunk: { least: stretch(0.8), most: stretch(2.5) },
} as const;
const LONGEST = stretch(3) + RECESS.ravine + LANDING.clear + LANDING.drop;

/**
 * Where along the road a character crossing a gap is set down: past the furthest its ragged far
 * edge can be drawn. The gap's own length is to the nearest that edge can be.
 */
export function setDown(gap: Extract<Obstacle, { kind: "gap" }>): number {
  return gap.at + gap.length + RECESS[gap.over] + LANDING.clear;
}

/** How much road an obstacle takes up, from where it starts. */
export function extent(obstacle: Obstacle): number {
  if (obstacle.kind === "beam") return (obstacle.beams - 1) * BEAM_SPACING;
  if (obstacle.kind === "gap") return setDown(obstacle) - obstacle.at + LANDING.drop;
  return obstacle.kind === "trunk" ? obstacle.length : 0;
}

/** A small seeded generator: the same seed lays the same road, which tests rely on. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A road of a set length with every kind of obstacle in random order, for trying them all at
 * once. What order and pace make a good run is not decided here.
 */
export class Course {
  public readonly obstacles: Obstacle[] = [];
  private readonly next: () => number;
  private laidTo = FIRST_AT;

  /** `length` is where the finish is, in world units from the start. */
  public constructor(
    seed: number,
    private readonly length: number,
  ) {
    this.next = random(seed);
  }

  /** Lays obstacles as far as `distance`, and none that would not end well before the finish. */
  public layTo(distance: number): void {
    while (this.laidTo <= Math.min(distance, this.length - RUN_IN - LONGEST)) {
      const at = this.laidTo;
      const pick = <T>(choices: readonly T[]) =>
        choices[Math.floor(this.next() * choices.length)] as T;
      const between = (span: { least: number; most: number }) =>
        span.least + this.next() * (span.most - span.least);
      const roll = this.next();
      let obstacle: Obstacle;
      if (roll < 0.14) {
        // One lane or two, never all three: there is always somewhere to go.
        const open = pick(LANES);
        const one = pick(LANES);
        obstacle = {
          kind: "block",
          at,
          lanes: this.next() < 0.5 ? [one] : LANES.filter((lane) => lane !== open),
        };
      } else if (roll < 0.25) {
        obstacle = { kind: "fall", at, from: this.next() < 0.5 ? -1 : 1 };
      } else if (roll < 0.33) {
        obstacle = { kind: "beam", at, beams: 1 };
      } else if (roll < 0.42) {
        obstacle = { kind: "beam", at, beams: pick(TUNNEL_BEAMS) };
      } else if (roll < 0.54) {
        obstacle = { kind: "log", at };
      } else if (roll < 0.72) {
        obstacle = {
          kind: "monster",
          at,
          lane: pick(LANES),
          size: this.next() < 0.35 ? "great" : "small",
        };
      } else if (roll < 0.82) {
        obstacle = { kind: "trunk", at, length: between(LENGTHS.trunk), lane: pick(LANES) };
      } else {
        const over = this.next() < 0.5 ? "river" : "ravine";
        // A vine, a trunk, or one of each over different lanes.
        const ways = this.next();
        const first = pick(LANES);
        const second = pick(LANES.filter((lane) => lane !== first));
        obstacle = {
          kind: "gap",
          at,
          length: between(LENGTHS[over]),
          over,
          vine: ways < 0.7 ? first : null,
          trunk: ways < 0.45 ? null : ways < 0.7 ? second : first,
        };
      }
      this.obstacles.push(obstacle);
      this.laidTo = at + extent(obstacle) + GAP.least + this.next() * (GAP.most - GAP.least);
    }
  }
}

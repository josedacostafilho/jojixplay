import type { Lane } from "./puppet";
import { BEAM_SPACING } from "./world";

/** Something on the road, starting `at` this many world units from where the run began. */
export type Obstacle =
  /** Stands in one or two lanes: be in another. */
  | { readonly kind: "block"; readonly at: number; readonly lanes: readonly Lane[] }
  /** Beams across the whole road at chest height, one or a row of them as a tunnel: duck. */
  | { readonly kind: "beam"; readonly at: number; readonly beams: number }
  /** Lies across the whole road: jump. */
  | { readonly kind: "log"; readonly at: number }
  /** A pool across the whole road with rails over it: hang on with a raised hand. */
  | { readonly kind: "rails"; readonly at: number; readonly length: number }
  /** Stands in a lane and cannot be stepped around: punch it, with the arm on its side. */
  | { readonly kind: "monster"; readonly at: number; readonly lane: Lane };

const FIRST_AT = 34;
/** Clear road after an obstacle: about three seconds of running, time enough to see and move. */
const GAP = { least: 20, most: 26 } as const;
const LANES: readonly Lane[] = [-1, 0, 1];
/** Tunnels last from under a second to about a second and a half. */
const TUNNEL_BEAMS = [3, 4, 5, 6, 7] as const;
/** Rails last from about a second to two. */
const RAILS = { least: 8, most: 14 } as const;

/** How much road an obstacle takes up, from where it starts. */
export function extent(obstacle: Obstacle): number {
  if (obstacle.kind === "beam") return (obstacle.beams - 1) * BEAM_SPACING;
  return obstacle.kind === "rails" ? obstacle.length : 0;
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
 * An endless road of every kind of obstacle in random order, for trying them all at once. What
 * order and pace make a good run is not decided here.
 */
export class Course {
  public readonly obstacles: Obstacle[] = [];
  private readonly next: () => number;
  private laidTo = FIRST_AT;

  public constructor(seed: number) {
    this.next = random(seed);
  }

  /** Lays obstacles as far as `distance`. */
  public layTo(distance: number): void {
    while (this.laidTo <= distance) {
      const at = this.laidTo;
      const pick = <T>(choices: readonly T[]) =>
        choices[Math.floor(this.next() * choices.length)] as T;
      const roll = this.next();
      let obstacle: Obstacle;
      if (roll < 0.22) {
        // One lane or two, never all three: there is always somewhere to go.
        const open = pick(LANES);
        const one = pick(LANES);
        obstacle = {
          kind: "block",
          at,
          lanes: this.next() < 0.5 ? [one] : LANES.filter((lane) => lane !== open),
        };
      } else if (roll < 0.34) {
        obstacle = { kind: "beam", at, beams: 1 };
      } else if (roll < 0.48) {
        obstacle = { kind: "beam", at, beams: pick(TUNNEL_BEAMS) };
      } else if (roll < 0.64) {
        obstacle = { kind: "log", at };
      } else if (roll < 0.84) {
        obstacle = { kind: "monster", at, lane: pick(LANES) };
      } else {
        obstacle = {
          kind: "rails",
          at,
          length: RAILS.least + this.next() * (RAILS.most - RAILS.least),
        };
      }
      this.obstacles.push(obstacle);
      this.laidTo = at + extent(obstacle) + GAP.least + this.next() * (GAP.most - GAP.least);
    }
  }
}

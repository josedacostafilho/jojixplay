import type { Lane } from "./puppet";
import { BEAM_SPACING, stretch } from "./world";

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

const FIRST_AT = stretch(3);
/** The last stretch before the finish is clear road. */
export const RUN_IN = stretch(3);
/** Clear road after an obstacle: about a second and a half of running. */
const GAP = { least: stretch(1.4), most: stretch(1.9) } as const;
const LANES: readonly Lane[] = [-1, 0, 1];
/** Tunnels last from about half a second to a second and a half. */
const TUNNEL_BEAMS = [4, 5, 6, 8, 10] as const;
/** Rails last from about a second to two. */
const RAILS = { least: stretch(1.1), most: stretch(2) } as const;

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
    while (this.laidTo <= Math.min(distance, this.length - RUN_IN - RAILS.most)) {
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

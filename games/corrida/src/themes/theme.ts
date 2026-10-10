import type * as THREE from "three";
import type { Obstacle } from "../course";

/** What a world is told each frame, to move itself past the view. */
export interface ThemeFrame {
  /** How far down the road the run has come. */
  readonly distance: number;
  readonly now: number;
  /** Milliseconds since the frame before. */
  readonly elapsed: number;
  /** Where the view is. */
  readonly eyes: THREE.Vector3;
  /** 0 to 1: how fully the character is hanging over water. */
  readonly hang: number;
  /**
   * How much of its scattered scenery to draw, from 1 down to about a seventh: less when the device
   * cannot keep the picture smooth.
   */
  readonly detail: number;
  /** Whether a run is under way, and not waiting to start or over. */
  readonly running: boolean;
  /** Where the holding hands are while it hangs; null otherwise. */
  readonly hands: THREE.Vector3 | null;
}

/**
 * A world to run through: its light, its scenery, and what each kind of obstacle looks like in
 * it. The rules, the view and the arms are the same in every world.
 */
export interface Theme {
  /** Settles when its pictures and models are in; rejects if one cannot be loaded. */
  readonly ready: Promise<void>;
  /** How hands hold on over water: each to its own rail, or both to the end of one rope. */
  readonly grip: "rails" | "rope";
  /**
   * One obstacle, standing at the origin and stretching away down the road. A part that should
   * go from sight once it is behind the view says how far along it ends, in `userData.end`.
   * The scene keeps `userData.struck` on it: whether the character has struck its hollow trunk.
   */
  build(obstacle: Obstacle): THREE.Group;
  update(frame: ThemeFrame): void;
  dispose(): void;
}

export type ThemeMaker = (scene: THREE.Scene) => Theme;

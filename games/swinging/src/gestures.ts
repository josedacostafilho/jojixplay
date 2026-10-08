import type { HandPoint, TrackedHand } from "@jojixplay/game-sdk";
import type { Side } from "./physics";
import { projectHand } from "./hand-view";

import { sides, type TrackedHands } from "./tracking";
const STABLE_MS = 70;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** Turning angle at the middle finger joint, independent of camera orientation. */
export function fingerCurl(points: readonly HandPoint[], base: number): number | null {
  const a = points[base],
    b = points[base + 1],
    c = points[base + 2];
  if (!a || !b || !c) return null;
  const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const v = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };
  const length = Math.hypot(u.x, u.y, u.z) * Math.hypot(v.x, v.y, v.z);
  return length < 1e-8
    ? null
    : Math.acos(clamp((u.x * v.x + u.y * v.y + u.z * v.z) / length, -1, 1));
}

export function handShape(hand: TrackedHand): "open" | "closed" | null {
  const curls = [5, 9, 13, 17].map((base) => fingerCurl(hand.worldLandmarks, base));
  if (curls.some((curl) => curl === null)) return null;
  // ponytail: prototype curl thresholds; tune with sideways/occluded hands on the target phone.
  if (curls.filter((curl) => curl !== null && curl > 1.05).length >= 3) return "closed";
  if (curls.filter((curl) => curl !== null && curl < 0.45).length >= 3) return "open";
  return null;
}

export class HandControl {
  closed = false;
  armed = false;
  fired = false;
  open = false;
  aim: { x: number; y: number };
  private lastWrist: HandPoint | null = null;
  private candidate: "open" | "closed" | null = null;
  private candidateSince = 0;

  constructor(readonly side: Side) {
    this.aim = { x: side === "left" ? 0.27 : 0.73, y: 0.4 };
  }

  reset() {
    this.closed = this.armed = this.fired = this.open = false;
    this.lastWrist = null;
    this.candidate = null;
  }

  sample(hand: TrackedHand, capturedAt: number) {
    const wrist = hand.landmarks[0];
    if (!wrist) return;
    if (this.lastWrist && Math.hypot(wrist.x - this.lastWrist.x, wrist.y - this.lastWrist.y) > 0.3)
      this.reset();
    this.lastWrist = wrist;
    this.fired = false;
    const shape = handShape(hand);
    if (shape !== this.candidate) {
      this.candidate = shape;
      this.candidateSince = capturedAt;
    }
    this.open = shape === "open";
    if (shape && capturedAt - this.candidateSince >= STABLE_MS) {
      if (shape === "open") {
        this.closed = false;
        this.armed = true;
      } else if (!this.closed && this.armed) {
        this.closed = true;
        this.fired = true;
        this.armed = false;
      }
    }
    // Freeze aim as soon as closure begins; fingertips curling must not shift the shot.
    if (this.open && !this.closed) {
      const index = projectHand(hand)[8];
      if (index) this.aim = { x: index.x, y: index.y };
    }
  }
}

export class SwingGestures {
  readonly hands = { left: new HandControl("left"), right: new HandControl("right") };
  reset() {
    for (const side of sides) this.hands[side].reset();
  }

  sample(observations: TrackedHands, capturedAt: number) {
    for (const side of sides) {
      const hand = observations[side];
      if (hand) this.hands[side].sample(hand, capturedAt);
      else this.hands[side].reset();
    }
  }
}

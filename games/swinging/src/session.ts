import type { BodyFrame } from "@jojixplay/game-sdk";
import { SwingGestures } from "./gestures";
import { sides, SwingTracking } from "./tracking";
import { SwingPhysics, type Side, type Vec3 } from "./physics";

export class SwingSession {
  readonly physics = new SwingPhysics();
  readonly tracking = new SwingTracking();
  readonly gestures = new SwingGestures();
  entryProgress = 0;
  private frame: BodyFrame | null = null;
  private receivedAtMs = -Infinity;
  private epoch: number | null = null;
  private sequence = -1;
  private gestureSequence = -1;
  private previousAt: number | null = null;
  private readySince: number | null = null;
  private readyWrists: Partial<Record<Side, { x: number; y: number }>> = {};

  replay() {
    this.physics.reset();
    this.gestures.reset();
    this.gestureSequence = -1;
    this.readySince = null;
    this.readyWrists = {};
    this.entryProgress = 0;
  }

  update(frame: BodyFrame | null, receivedAtMs: number) {
    if (!frame?.hands) {
      this.frame = null;
      this.receivedAtMs = -Infinity;
      return;
    }
    if (frame.epoch === this.frame?.epoch && frame.sequence <= this.frame.sequence) return;
    this.frame = frame;
    this.receivedAtMs = receivedAtMs;
  }

  hasRecentResult(now: number) {
    // Missing hands are handled by each result; this only guards a stalled result stream.
    return this.frame !== null && now - this.receivedAtMs <= 1000;
  }

  tick(now: number, ray: (side: Side) => { origin: Vec3; direction: Vec3 }, enabled: boolean) {
    const valid = this.hasRecentResult(now) ? this.frame : null;
    if (valid && valid.epoch !== this.epoch) {
      this.tracking.reset();
      this.gestureSequence = -1;
      this.gestures.reset();
      for (const side of sides) this.physics.release(side);
      this.epoch = valid.epoch;
      this.sequence = -1;
      this.readySince = null;
      this.readyWrists = {};
    }
    if (!valid) this.tracking.reset();
    if (!valid || !enabled) {
      this.gestures.reset();
      this.gestureSequence = -1;
    }
    if (valid && valid.sequence !== this.sequence) {
      this.sequence = valid.sequence;
      this.tracking.sample(valid.hands ?? []);
    }
    if (valid && enabled && valid.sequence !== this.gestureSequence) {
      this.gestureSequence = valid.sequence;
      this.gestures.sample(this.tracking.hands, valid.capturedAtMs);
    }
    if (this.physics.phase === "ready") {
      const ready = sides.every(
        (side) => enabled && this.tracking.hands[side] && this.gestures.hands[side].open,
      );
      if (!ready) {
        this.readySince = null;
        this.readyWrists = {};
        this.entryProgress = 0;
      } else {
        const moved = sides.some((side) => {
          const wrist = this.tracking.hands[side]?.landmarks[0],
            reference = this.readyWrists[side];
          return (
            wrist && reference && Math.hypot(wrist.x - reference.x, wrist.y - reference.y) > 0.035
          );
        });
        if (this.readySince === null || moved) {
          this.readySince = now;
          for (const side of sides) {
            const wrist = this.tracking.hands[side]?.landmarks[0];
            if (wrist) this.readyWrists[side] = { ...wrist };
          }
        }
        this.entryProgress = Math.min(1, (now - this.readySince) / 1500);
        if (this.entryProgress === 1) this.physics.start();
      }
    }
    for (const side of sides) {
      const control = this.gestures.hands[side];
      if (!control.closed) this.physics.release(side);
      if (control.fired) {
        const shot = ray(side);
        this.physics.shoot(side, shot.origin, shot.direction);
        control.fired = false;
      }
    }
    this.physics.advance(this.previousAt === null ? 0 : (now - this.previousAt) / 1000);
    this.previousAt = now;
  }
}

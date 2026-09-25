import { isFresh, type Body, type BodyFrame, type Joint } from "@jojixplay/game-sdk";
import { SwingGestures } from "./gestures";
import { SwingPhysics } from "./physics";

function angle(a: Joint, b: Joint, c: Joint, aspect: number) {
  const ux = (a.x - b.x) * aspect,
    uy = a.y - b.y,
    vx = (c.x - b.x) * aspect,
    vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return length < 0.00001
    ? 180
    : (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length))) * 180) / Math.PI;
}

export class SwingSession {
  readonly physics = new SwingPhysics();
  readonly gestures = new SwingGestures();
  entryProgress = 0;
  private epoch: number | null = null;
  private sequence = -1;
  private previousAt: number | null = null;
  private standingY: number | null = null;
  private crouchSince: number | null = null;
  private lastCrouchAt = -Infinity;

  replay() {
    this.physics.reset();
    this.gestures.reset();
    this.standingY = this.crouchSince = null;
    this.lastCrouchAt = -Infinity;
    this.entryProgress = 0;
  }

  private entry(body: Body, now: number, aspect: number) {
    const shoulder =
      body.leftShoulder && body.rightShoulder
        ? (body.leftShoulder.y + body.rightShoulder.y) / 2
        : (body.leftShoulder ?? body.rightShoulder)?.y;
    const hip =
      body.leftHip && body.rightHip
        ? (body.leftHip.y + body.rightHip.y) / 2
        : (body.leftHip ?? body.rightHip)?.y;
    if (shoulder === undefined || hip === undefined) {
      if (now - this.lastCrouchAt > 120) {
        this.crouchSince = null;
        this.entryProgress = 0;
      }
      return;
    }
    const torso = Math.max(0.08, hip - shoulder);
    let bent = false;
    for (const side of ["left", "right"] as const) {
      const h = body[`${side}Hip`],
        k = body[`${side}Knee`],
        a = body[`${side}Ankle`];
      if (h && k && a) bent ||= angle(h, k, a, aspect) < 145;
      else if (h && k) bent ||= k.y - h.y < torso * 0.55;
    }
    if (this.standingY === null && !bent) this.standingY = shoulder;
    const crouched =
      bent || (this.standingY !== null && shoulder - this.standingY > Math.max(0.045, torso * 0.3));
    if (crouched) {
      this.crouchSince ??= now;
      this.lastCrouchAt = now;
    } else if (now - this.lastCrouchAt > 120) {
      this.crouchSince = null;
      this.standingY = shoulder;
    }
    this.entryProgress =
      this.crouchSince === null ? 0 : Math.min(1, (now - this.crouchSince) / 3000);
    if (this.entryProgress === 1) {
      this.physics.start();
      this.crouchSince = null;
      this.entryProgress = 0;
    }
  }

  tick(now: number, frame: BodyFrame | null) {
    const valid = frame && isFresh(frame, now) && frame.bodies.length === 1 ? frame : null;
    let jumped = false;
    if (valid && valid.epoch !== this.epoch) {
      this.gestures.reset();
      this.epoch = valid.epoch;
      this.sequence = -1;
      this.crouchSince = null;
      this.entryProgress = 0;
    }
    if (valid && valid.sequence !== this.sequence) {
      this.sequence = valid.sequence;
      const body = valid.bodies[0] ?? null;
      this.gestures.sample(body, now, this.physics.phase !== "ready");
      jumped = this.gestures.jumped;
      if (body && this.physics.phase === "ready") this.entry(body, now, valid.width / valid.height);
    } else if (!valid) {
      this.gestures.sample(null, now, this.physics.phase !== "ready");
      if (now - this.lastCrouchAt > 120) {
        this.crouchSince = null;
        this.entryProgress = 0;
      }
    }
    if (jumped) this.physics.jump();
    for (const side of ["left", "right"] as const)
      this.physics.setArm(side, this.gestures.arms[side]);
    this.physics.advance(this.previousAt === null ? 0 : (now - this.previousAt) / 1000);
    this.previousAt = now;
  }
}

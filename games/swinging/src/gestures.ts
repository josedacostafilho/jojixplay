import type { Body, Joint } from "@jojixplay/game-sdk";
import type { Side } from "./physics";

const ARM_EVIDENCE_MS = 70;
const ARM_LOSS_MS = 180;
const NEUTRAL_MS = 250;
const DIP_MS = 90;
const RISE_MS = 60;

class ArmGesture {
  raised = false;
  private candidate: boolean | null = null;
  private candidateSince = 0;
  private lastEvidence = -Infinity;

  reset() {
    this.raised = false;
    this.candidate = null;
    this.lastEvidence = -Infinity;
  }

  sample(
    shoulder: Joint | undefined,
    elbow: Joint | undefined,
    wrist: Joint | undefined,
    scale: number,
    now: number,
  ) {
    let evidence: boolean | null = null;
    if (shoulder) {
      const height = wrist
        ? (wrist.y - shoulder.y) / scale
        : elbow
          ? (elbow.y - shoulder.y) / scale
          : null;
      if (height !== null) {
        if (height < (wrist ? -0.2 : -0.08)) evidence = true;
        if (height > (wrist ? 0.3 : 0.22)) evidence = false;
      }
    }
    if (evidence !== null) {
      this.lastEvidence = now;
      if (evidence === this.raised) this.candidate = null;
      else if (this.candidate !== evidence) {
        this.candidate = evidence;
        this.candidateSince = now;
      } else if (now - this.candidateSince >= ARM_EVIDENCE_MS) {
        this.raised = evidence;
        this.candidate = null;
      }
    } else if (now - this.lastEvidence > ARM_LOSS_MS) {
      this.raised = false;
      this.candidate = null;
    }
    return this.raised;
  }
}

export class SwingGestures {
  readonly arms: Record<Side, boolean> = { left: false, right: false };
  tracking = false;
  jumped = false;
  private readonly arm = { left: new ArmGesture(), right: new ArmGesture() };
  private baseline: { shoulder: number; hip: number; scale: number } | null = null;
  private torsoMask = 0;
  private neutralSince: number | null = null;
  private dipSince: number | null = null;
  private dipped = false;
  private riseSince: number | null = null;
  private armed = false;

  reset() {
    this.arm.left.reset();
    this.arm.right.reset();
    this.arms.left = this.arms.right = false;
    this.tracking = this.jumped = false;
    this.resetJump();
  }

  private resetJump() {
    this.baseline = null;
    this.torsoMask = 0;
    this.neutralSince = this.dipSince = this.riseSince = null;
    this.dipped = false;
    this.armed = false;
  }

  sample(body: Body | null, now: number, jumpEnabled: boolean) {
    this.jumped = false;
    this.tracking =
      !!body && !!(body.leftShoulder || body.rightShoulder || body.leftHip || body.rightHip);
    for (const side of ["left", "right"] as const) {
      const shoulder = body?.[`${side}Shoulder`];
      const hip = body?.[`${side}Hip`];
      const otherShoulder = body?.[`${side === "left" ? "right" : "left"}Shoulder`];
      const scale =
        hip && shoulder
          ? Math.max(0.08, hip.y - shoulder.y)
          : shoulder && otherShoulder
            ? Math.max(0.08, Math.abs(shoulder.x - otherShoulder.x))
            : 0.2;
      this.arms[side] = this.arm[side].sample(
        shoulder,
        body?.[`${side}Elbow`],
        body?.[`${side}Wrist`],
        scale,
        now,
      );
    }
    if (!jumpEnabled) {
      this.resetJump();
      return;
    }
    const pairs = (["left", "right"] as const).flatMap((side) => {
      const shoulder = body?.[`${side}Shoulder`],
        hip = body?.[`${side}Hip`];
      return shoulder && hip ? [{ shoulder, hip }] : [];
    });
    if (!pairs.length) {
      this.resetJump();
      return;
    }
    const mask =
      Number(!!body?.leftShoulder) +
      Number(!!body?.rightShoulder) * 2 +
      Number(!!body?.leftHip) * 4 +
      Number(!!body?.rightHip) * 8;
    if (mask !== this.torsoMask) {
      this.resetJump();
      this.torsoMask = mask;
    }
    const shoulder = pairs.reduce((sum, pair) => sum + pair.shoulder.y, 0) / pairs.length;
    const hip = pairs.reduce((sum, pair) => sum + pair.hip.y, 0) / pairs.length;
    const scale = hip - shoulder;
    if (scale < 0.08) {
      this.resetJump();
      return;
    }
    this.baseline ??= { shoulder, hip, scale };
    const base = this.baseline;
    const shoulderDrop = (shoulder - base.shoulder) / base.scale;
    const hipDrop = (hip - base.hip) / base.scale;
    const neutral = Math.abs(shoulderDrop) < 0.08 && Math.abs(hipDrop) < 0.08;
    if (shoulderDrop < -0.18 && hipDrop < -0.18 && !this.dipped) {
      this.baseline = { shoulder, hip, scale };
      this.armed = false;
      this.neutralSince = now;
      this.dipSince = null;
      return;
    }
    if (!this.armed) {
      if (neutral) this.neutralSince ??= now;
      else this.neutralSince = null;
      if (this.neutralSince !== null && now - this.neutralSince >= NEUTRAL_MS) this.armed = true;
      return;
    }
    if (shoulderDrop > 0.16 && hipDrop > 0.16) {
      this.dipSince ??= now;
      if (now - this.dipSince >= DIP_MS) this.dipped = true;
      this.riseSince = null;
    } else if (!this.dipped) {
      this.dipSince = null;
    } else if (neutral) {
      this.riseSince ??= now;
      if (now - this.riseSince >= RISE_MS) {
        this.jumped = true;
        this.armed = false;
        this.neutralSince = now;
        this.dipSince = this.riseSince = null;
        this.dipped = false;
      }
    } else if (this.dipSince !== null && now - this.dipSince > 900) {
      this.dipSince = this.riseSince = null;
      this.dipped = false;
    }
    if (neutral && this.dipSince === null) {
      this.baseline = {
        shoulder: base.shoulder * 0.99 + shoulder * 0.01,
        hip: base.hip * 0.99 + hip * 0.01,
        scale: base.scale * 0.99 + scale * 0.01,
      };
    }
  }
}

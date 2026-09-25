import type { Body, Joint, JointName } from "@jojixplay/game-sdk";

// Phone-tuning parameters: coarse geometry and time evidence, not exact poses.
export const TOLERANCE = {
  centerMargin: 0.12,
  crouchDrop: 0.3,
  crouchKneeDegrees: 145,
  jumpRise: 0.22,
  neutralMs: 350,
  jumpEvidenceMs: 60,
  poseAngleDegrees: 38,
  poseHoldMs: 120,
  noiseMs: 120,
} as const;
export type PoseName = "asas" | "estrela" | "forte" | "alto";
export const POSES: readonly PoseName[] = ["asas", "estrela", "forte", "alto"];
export const poseLabels: Record<PoseName, string> = {
  asas: "Braços para os lados",
  estrela: "Faça uma estrela",
  forte: "Mostre sua força",
  alto: "Mãos lá no alto",
};
export interface Point {
  x: number;
  y: number;
}
export type Skeleton = Partial<Record<JointName, Point>>;
export const BONES: readonly (readonly [JointName, JointName])[] = [
  ["nose", "leftShoulder"],
  ["nose", "rightShoulder"],
  ["leftShoulder", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["leftShoulder", "leftHip"],
  ["rightShoulder", "rightHip"],
  ["leftHip", "rightHip"],
  ["leftHip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["rightHip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];
const ARM_BONES = BONES.slice(3, 7);
export function targetPose(pose: PoseName): Skeleton {
  const target: Skeleton = { nose: { x: 0, y: 0.55 } };
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    target[`${side}Shoulder`] = { x: sign * 0.45, y: 0 };
    const angle = pose === "estrela" ? Math.PI / 4 : pose === "alto" ? Math.PI / 2.6 : 0;
    const elbow = { x: sign * (0.45 + 0.6 * Math.cos(angle)), y: 0.6 * Math.sin(angle) };
    target[`${side}Elbow`] = elbow;
    target[`${side}Wrist`] =
      pose === "forte"
        ? { x: elbow.x, y: 0.6 }
        : { x: elbow.x + sign * 0.6 * Math.cos(angle), y: elbow.y + 0.6 * Math.sin(angle) };
    target[`${side}Hip`] = { x: sign * 0.3, y: -0.9 };
    target[`${side}Knee`] = { x: sign * 0.35, y: -1.55 };
    target[`${side}Ankle`] = { x: sign * 0.4, y: -2.2 };
  }
  return target;
}
function angle(a: Point, b: Point, c: Point): number {
  const ux = a.x - b.x,
    uy = a.y - b.y,
    vx = c.x - b.x,
    vy = c.y - b.y;
  const length = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return length < 0.00001
    ? 180
    : (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / length))) * 180) / Math.PI;
}
function midpoint(a: Joint | undefined, b: Joint | undefined): Point | null {
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : (a ?? b ?? null);
}
/** Retarget observed limb directions to common bone lengths. Never invent missing joints. */
export function normalizePose(body: Body, aspect: number): Skeleton {
  const result: Skeleton = {};
  const shoulders = midpoint(body.leftShoulder, body.rightShoulder);
  if (!shoulders) return result;
  // Anatomical names are not screen sides. Use the observed order before mirroring.
  const shoulderOrder =
    body.leftShoulder && body.rightShoulder
      ? Math.sign(body.rightShoulder.x - body.leftShoulder.x) || 1
      : -1;
  const raw = (j: Joint): Point => ({ x: -j.x * aspect, y: -j.y });
  const append = (from: JointName, to: JointName, length: number) => {
    const a = body[from],
      b = body[to],
      origin = result[from];
    if (!a || !b || !origin) return;
    const dx = -(b.x - a.x) * aspect,
      dy = -(b.y - a.y),
      distance = Math.hypot(dx, dy);
    if (distance < 0.005) return;
    result[to] = { x: origin.x + (dx / distance) * length, y: origin.y + (dy / distance) * length };
  };
  for (const side of ["left", "right"] as const) {
    const shoulder = body[`${side}Shoulder`];
    if (shoulder)
      result[`${side}Shoulder`] = { x: (side === "left" ? 0.45 : -0.45) * shoulderOrder, y: 0 };
    append(`${side}Shoulder`, `${side}Elbow`, 0.6);
    append(`${side}Elbow`, `${side}Wrist`, 0.6);
    append(`${side}Shoulder`, `${side}Hip`, 0.91);
    append(`${side}Hip`, `${side}Knee`, 0.65);
    append(`${side}Knee`, `${side}Ankle`, 0.65);
  }
  if (body.nose) {
    const nose = raw(body.nose),
      center = { x: -shoulders.x * aspect, y: -shoulders.y };
    const distance = Math.hypot(nose.x - center.x, nose.y - center.y);
    if (distance > 0.005)
      result.nose = {
        x: ((nose.x - center.x) / distance) * 0.55,
        y: ((nose.y - center.y) / distance) * 0.55,
      };
  }
  return result;
}
export function matchesPose(skeleton: Skeleton, pose: PoseName): boolean {
  const target = targetPose(pose);
  const shoulderOrder = (skeleton.leftShoulder?.x ?? 0) > (skeleton.rightShoulder?.x ?? 0) ? 1 : -1;
  return ARM_BONES.every(([from, to]) => {
    const a = skeleton[from],
      b = skeleton[to],
      ta = target[from],
      tb = target[to];
    if (!a || !b || !ta || !tb) return false;
    const dot =
      ((b.x - a.x) * (tb.x - ta.x) * shoulderOrder + (b.y - a.y) * (tb.y - ta.y)) /
      (Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(tb.x - ta.x, tb.y - ta.y));
    return dot >= Math.cos((TOLERANCE.poseAngleDegrees * Math.PI) / 180);
  });
}
export class Movement {
  centered = false;
  crouched = false;
  jumped = false;
  skeleton: Skeleton = {};
  private standingY: number | null = null;
  private standingHipY: number | null = null;
  private torso = 0.2;
  private lastY: number | null = null;
  private lastAt = 0;
  private neutralSince: number | null = null;
  private armed = false;
  private riseSince: number | null = null;
  reset() {
    this.standingY = this.standingHipY = this.lastY = null;
    this.neutralSince = this.riseSince = null;
    this.lastAt = 0;
    this.torso = 0.2;
    this.armed = this.centered = this.crouched = this.jumped = false;
    this.skeleton = {};
  }
  sample(body: Body, aspect: number, now: number) {
    this.jumped = false;
    this.skeleton = normalizePose(body, aspect);
    const shoulder = midpoint(body.leftShoulder, body.rightShoulder);
    const hip = midpoint(body.leftHip, body.rightHip);
    if (!shoulder) {
      this.centered = this.crouched = false;
      this.armed = false;
      return;
    }
    this.centered = shoulder.x > TOLERANCE.centerMargin && shoulder.x < 1 - TOLERANCE.centerMargin;
    if (hip) this.torso = Math.max(0.1, Math.min(0.4, hip.y - shoulder.y));
    const dt = Math.max(1, now - this.lastAt);
    const y =
      this.lastY === null
        ? shoulder.y
        : this.lastY + (shoulder.y - this.lastY) * (1 - Math.exp(-dt / 65));
    let bent = false;
    for (const side of ["left", "right"] as const) {
      const h = body[`${side}Hip`],
        k = body[`${side}Knee`],
        a = body[`${side}Ankle`];
      if (h && k && a)
        bent ||=
          angle(
            { x: h.x * aspect, y: h.y },
            { x: k.x * aspect, y: k.y },
            { x: a.x * aspect, y: a.y },
          ) < (this.crouched ? 158 : TOLERANCE.crouchKneeDegrees);
      else if (h && k) bent ||= Math.abs(k.y - h.y) < this.torso * 0.55;
    }
    if (this.standingY === null && !bent) {
      this.standingY = shoulder.y;
      this.standingHipY = hip?.y ?? null;
    }
    const baseline = this.standingY ?? y;
    this.crouched =
      bent ||
      y - baseline > Math.max(0.045, this.torso * TOLERANCE.crouchDrop * (this.crouched ? 0.7 : 1));
    const risen = baseline - y > Math.max(0.035, this.torso * TOLERANCE.jumpRise);
    const hipRisen =
      !hip || this.standingHipY === null || this.standingHipY - hip.y > this.torso * 0.1;
    if (this.crouched) {
      this.armed = false;
      this.neutralSince = this.riseSince = null;
    } else if (risen) {
      if (hipRisen && this.centered) {
        this.riseSince ??= now;
        if (this.armed && now - this.riseSince >= TOLERANCE.jumpEvidenceMs) {
          this.jumped = true;
          this.armed = false;
        }
        // A held higher stance is repositioning, not an endless flight.
        if (now - this.riseSince > 1200) {
          this.standingY = y;
          this.standingHipY = hip?.y ?? null;
          this.riseSince = null;
        }
      } else this.riseSince = null;
      this.neutralSince = null;
    } else {
      this.riseSince = null;
      this.neutralSince ??= now;
      if (now - this.neutralSince >= TOLERANCE.neutralMs) this.armed = true;
      // Slow adaptation follows gradual repositioning, not a jump's flight arc.
      const rate = Math.min(0.03, dt / 6000);
      this.standingY = baseline + (y - baseline) * rate;
      if (hip)
        this.standingHipY =
          (this.standingHipY ?? hip.y) + (hip.y - (this.standingHipY ?? hip.y)) * rate;
    }
    this.lastY = y;
    this.lastAt = now;
  }
}

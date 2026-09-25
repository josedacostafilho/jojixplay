import type { Body, BodyFrame, JointName } from "@jojixplay/game-sdk";
import { targetPose, type PoseName } from "../src/movement";
export function body({
  duck = false,
  lift = 0,
  pose,
  x = 0.5,
}: {
  duck?: boolean;
  lift?: number;
  pose?: PoseName;
  x?: number;
} = {}): Body {
  const joint = (x: number, y: number) => ({ x, y, z: 0, confidence: 1 });
  const y = 0.31 + (duck ? 0.15 : 0) - lift;
  const result: Partial<Record<JointName, ReturnType<typeof joint>>> = {};
  for (const [key, p] of Object.entries(targetPose(pose ?? "asas")))
    result[key as JointName] = joint(x + (p.x * 0.15) / (16 / 9), y - p.y * 0.15);
  for (const side of ["left", "right"] as const) {
    const sign = side === "left" ? 1 : -1;
    result[`${side}Hip`] = joint(x + sign * 0.04, y + 0.19);
    result[`${side}Knee`] = joint(x + sign * (duck ? 0.09 : 0.04), duck ? y + 0.21 : y + 0.33);
    result[`${side}Ankle`] = joint(x + sign * 0.04, 0.84 - lift);
    if (!pose) {
      result[`${side}Elbow`] = joint(x + sign * 0.075, y + 0.1);
      result[`${side}Wrist`] = joint(x + sign * 0.085, y + 0.22);
    }
  }
  return result;
}
export function frame(now: number, input: Body = body(), epoch = 0): BodyFrame {
  return { sequence: now, capturedAtMs: now, width: 1280, height: 720, epoch, bodies: [input] };
}

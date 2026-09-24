import { BODY_FRESHNESS_MS, jointNames, type BodyFrame, type Joint } from "@jojixplay/game-sdk";

/** Presentation only. No historical array-slot blending for two-person observations. */
export function softenMovement(previous: BodyFrame | null, next: BodyFrame): BodyFrame {
  const elapsed = previous ? next.capturedAtMs - previous.capturedAtMs : 0;
  if (
    !previous ||
    previous.epoch !== next.epoch ||
    elapsed <= 0 ||
    elapsed > BODY_FRESHNESS_MS ||
    previous.bodies.length !== 1 ||
    next.bodies.length !== 1
  )
    return next;
  const body = next.bodies[0],
    old = previous.bodies[0];
  if (!body || !old) return next;
  const points: Partial<Record<(typeof jointNames)[number], Joint>> = {};
  for (const name of jointNames) {
    const point = body[name],
      before = old[name];
    if (!point) continue;
    if (!before) {
      points[name] = point;
      continue;
    }
    const distance = Math.hypot(point.x - before.x, point.y - before.y);
    // Large discontinuities represent reacquisition, not a motion to animate through.
    const response = distance > 0.15 ? 1 : 1 - Math.exp(-elapsed / (distance > 0.025 ? 20 : 45));
    points[name] = {
      ...point,
      x: before.x + (point.x - before.x) * response,
      y: before.y + (point.y - before.y) * response,
    };
  }
  return { ...next, bodies: [points] };
}

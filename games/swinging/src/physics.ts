export type Side = "left" | "right";
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}
export interface Building {
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}
export interface Web {
  point: Vec3;
  length: number;
}

export const STEP = 1 / 90;
export const RADIUS = 1.1;
export const ISLAND_HALF_SIZE = 230;
export const startBuilding: Building = { x: 0, z: 35, width: 32, depth: 32, height: 130 };
export const buildings: readonly Building[] = [
  startBuilding,
  ...[-192, -120, -48, 48, 120, 192].flatMap((x, column) =>
    [-192, -120, -48, 48, 120, 192].map((z, row) => ({
      x,
      z,
      width: 29 + ((column + row) % 3) * 3,
      depth: 29 + ((column * 2 + row) % 3) * 3,
      height: 140 + ((column * 3 + row * 2) % 5) * 14,
    })),
  ),
];

const copy = (p: Vec3): Vec3 => ({ ...p });
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const insideFootprint = (p: Vec3, b: Building, margin = 0) =>
  Math.abs(p.x - b.x) <= b.width / 2 + margin && Math.abs(p.z - b.z) <= b.depth / 2 + margin;

function segmentBox(
  from: Vec3,
  to: Vec3,
  building: Building,
  margin: number,
): { time: number; normal: Vec3 } | null {
  let entry = -Infinity,
    exit = Infinity,
    normal: Vec3 = { x: 0, y: 0, z: 0 };
  const bounds = {
    x: [building.x - building.width / 2 - margin, building.x + building.width / 2 + margin],
    y: [-margin, building.height + margin],
    z: [building.z - building.depth / 2 - margin, building.z + building.depth / 2 + margin],
  };
  for (const axis of ["x", "y", "z"] as const) {
    const [min, max] = bounds[axis];
    if (min === undefined || max === undefined) return null;
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-9) {
      if (from[axis] < min || from[axis] > max) return null;
      continue;
    }
    const first = delta > 0 ? min : max,
      last = delta > 0 ? max : min,
      near = (first - from[axis]) / delta,
      far = (last - from[axis]) / delta;
    if (near > entry) {
      entry = near;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = delta > 0 ? -1 : 1;
    }
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return entry >= 0 && entry <= 1 && exit >= 0 ? { time: entry, normal } : null;
}

/** First visible building along the exact crosshair ray, at most 150 game meters away. */
export function rayTarget(origin: Vec3, direction: Vec3): Vec3 | null {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length < 1e-6) return null;
  const to = {
    x: origin.x + (direction.x / length) * 150,
    y: origin.y + (direction.y / length) * 150,
    z: origin.z + (direction.z / length) * 150,
  };
  let time = Infinity;
  for (const building of buildings) {
    const hit = segmentBox(origin, to, building, 0);
    if (hit) time = Math.min(time, hit.time);
  }
  return time === Infinity
    ? null
    : {
        x: origin.x + (to.x - origin.x) * time,
        y: origin.y + (to.y - origin.y) * time,
        z: origin.z + (to.z - origin.z) * time,
      };
}

export class SwingPhysics {
  phase: "ready" | "roof" | "air" | "lost" = "ready";
  position: Vec3 = { x: 0, y: startBuilding.height + RADIUS, z: startBuilding.z };
  velocity: Vec3 = { x: 0, y: 0, z: -24 };
  readonly webs: Record<Side, Web | null> = { left: null, right: null };
  private roof: Building | null = startBuilding;
  private previousRoof: Building | null = null;
  private accumulator = 0;

  reset() {
    this.phase = "ready";
    this.position = { x: 0, y: startBuilding.height + RADIUS, z: startBuilding.z };
    this.velocity = { x: 0, y: 0, z: -24 };
    this.webs.left = this.webs.right = null;
    this.roof = startBuilding;
    this.previousRoof = null;
    this.accumulator = 0;
  }

  start() {
    this.reset();
    this.phase = "roof";
  }

  release(side: Side) {
    this.webs[side] = null;
  }

  shoot(side: Side, origin: Vec3, direction: Vec3) {
    if ((this.phase !== "air" && this.phase !== "roof") || this.webs[side]) return;
    const point = rayTarget(origin, direction);
    if (point) this.webs[side] = { point, length: distance(this.position, point) * 0.75 };
  }

  advance(seconds: number) {
    if (!Number.isFinite(seconds) || seconds < 0) return;
    this.accumulator += Math.min(seconds, 0.15);
    let count = 0;
    while (this.accumulator >= STEP && count < 12) {
      this.step();
      this.accumulator -= STEP;
      count++;
    }
    if (count === 12) this.accumulator = 0;
  }

  private step() {
    if (this.phase === "ready" || this.phase === "lost") return;
    if (this.phase === "roof") {
      const speed = Math.hypot(this.velocity.x, this.velocity.z) || 1;
      this.velocity.x = (this.velocity.x / speed) * 24;
      this.velocity.z = (this.velocity.z / speed) * 24;
      this.position.x += this.velocity.x * STEP;
      this.position.z += this.velocity.z * STEP;
      if (this.roof && !insideFootprint(this.position, this.roof, RADIUS)) {
        this.previousRoof = this.roof;
        this.roof = null;
        this.phase = "air";
      }
      return;
    }
    if (this.previousRoof && !insideFootprint(this.position, this.previousRoof, RADIUS + 1))
      this.previousRoof = null;
    this.velocity.y -= 12 * STEP;
    const pull = { x: 0, y: 0, z: 0 };
    for (const side of ["left", "right"] as const) {
      const web = this.webs[side];
      if (!web) continue;
      const dx = web.point.x - this.position.x,
        dy = web.point.y - this.position.y,
        dz = web.point.z - this.position.z,
        length = Math.hypot(dx, dy, dz),
        stretch = length - web.length;
      if (stretch <= 0) continue;
      const nx = dx / length,
        ny = dy / length,
        nz = dz / length,
        outward = -(this.velocity.x * nx + this.velocity.y * ny + this.velocity.z * nz),
        tension = Math.max(0, 3 * stretch + 0.7 * outward);
      pull.x += nx * tension;
      pull.y += ny * tension;
      pull.z += nz * tension;
    }
    const pullSize = Math.hypot(pull.x, pull.y, pull.z);
    const pullScale = pullSize > 65 ? 65 / pullSize : 1;
    this.velocity.x += pull.x * pullScale * STEP;
    this.velocity.y += pull.y * pullScale * STEP;
    this.velocity.z += pull.z * pullScale * STEP;
    const speed = Math.hypot(this.velocity.x, this.velocity.y, this.velocity.z);
    if (speed > 50) {
      const scale = 50 / speed;
      this.velocity.x *= scale;
      this.velocity.y *= scale;
      this.velocity.z *= scale;
    }
    const from = copy(this.position);
    const next = {
      x: from.x + this.velocity.x * STEP,
      y: from.y + this.velocity.y * STEP,
      z: from.z + this.velocity.z * STEP,
    };
    let first: { time: number; normal: Vec3; building: Building } | null = null;
    for (const building of buildings) {
      if (building === this.previousRoof) continue;
      const hit = segmentBox(from, next, building, RADIUS);
      if (hit && (!first || hit.time < first.time)) first = { ...hit, building };
    }
    if (first) {
      const t = Math.max(0, first.time - 0.001);
      this.position = {
        x: from.x + (next.x - from.x) * t,
        y: from.y + (next.y - from.y) * t,
        z: from.z + (next.z - from.z) * t,
      };
      if (first.normal.y > 0 && this.velocity.y < 0) {
        this.position.y = first.building.height + RADIUS;
        this.velocity.y = 0;
        this.webs.left = this.webs.right = null;
        this.roof = first.building;
        this.phase = "roof";
      } else {
        const remaining = {
          x: next.x - this.position.x,
          y: next.y - this.position.y,
          z: next.z - this.position.z,
        };
        const intoWall =
          remaining.x * first.normal.x +
          remaining.y * first.normal.y +
          remaining.z * first.normal.z;
        if (intoWall < 0) {
          remaining.x -= first.normal.x * intoWall;
          remaining.y -= first.normal.y * intoWall;
          remaining.z -= first.normal.z * intoWall;
        }
        this.position.x += remaining.x;
        this.position.y += remaining.y;
        this.position.z += remaining.z;
        const normalSpeed =
          this.velocity.x * first.normal.x +
          this.velocity.y * first.normal.y +
          this.velocity.z * first.normal.z;
        if (normalSpeed < 0) {
          this.velocity.x = (this.velocity.x - normalSpeed * first.normal.x) * 0.8;
          this.velocity.z = (this.velocity.z - normalSpeed * first.normal.z) * 0.8;
        }
      }
    } else this.position = next;
    if (this.position.y <= RADIUS) {
      this.position.y = RADIUS;
      this.phase = "lost";
      this.webs.left = this.webs.right = null;
    }
  }
}

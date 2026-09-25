import { isFresh, type Body, type BodyFrame } from "@jojixplay/game-sdk";

export const colors = ["#e76859", "#e6b431", "#469c79", "#428bd1", "#9565cc", "#d65f9e"] as const;
export const colorNames = ["Coral", "Amarelo", "Verde", "Azul", "Roxo", "Rosa"] as const;
export const MAX_MARKS = 6000;
export interface Point {
  x: number;
  y: number;
}
export interface Mark {
  from: Point;
  to: Point;
  color: string;
  radius: number;
  stroke: number;
  player: number;
}
export interface Brush {
  point: Point | null;
  painting: boolean;
  color: number;
  thick: boolean;
  leftHand: boolean;
  lastTime: number;
  torso: Point | null;
  stroke: number;
}
export class DrawSession {
  constructor(readonly players: 1 | 2) {}
  readonly brushes: Brush[] = [0, 3].map((color) => ({
    point: null,
    painting: false,
    color,
    thick: false,
    leftHand: false,
    lastTime: -1,
    torso: null,
    stroke: 0,
  }));
  marks: Mark[] = [];
  revision = 0;
  replacement = 0;
  private nextStroke = 0;
  private epoch: number | null = null;
  private sequence = -1;
  private timestamp = -1;
  private playerCount = 0;
  full = false;

  breakStroke(player: number): void {
    const brush = this.brushes[player];
    if (brush) {
      brush.painting = false;
      brush.point = null;
      brush.lastTime = -1;
      brush.torso = null;
    }
  }
  select(player: number, action: string): void {
    const brush = this.brushes[player];
    if (!brush) return;
    this.breakStroke(player);
    if (action.startsWith("color-")) {
      const color = Number(action.slice(6));
      if (Number.isInteger(color) && colors[color]) brush.color = color;
    } else if (action === "size") brush.thick = !brush.thick;
    else if (action === "hand") brush.leftHand = !brush.leftHand;
    else if (action === "undo") {
      const last = this.marks
        .slice()
        .reverse()
        .find((mark) => mark.player === player)?.stroke;
      if (last !== undefined) {
        this.marks = this.marks.filter((mark) => mark.stroke !== last);
        this.revision++;
        this.replacement++;
        this.full = false;
      }
    }
  }
  clear(): void {
    this.marks = [];
    this.full = false;
    this.revision++;
    this.replacement++;
    this.brushes.forEach((_, i) => {
      this.breakStroke(i);
    });
  }

  update(
    frame: BodyFrame | null,
    now: number,
    blocked: (point: Point, player: number) => boolean = () => false,
  ): void {
    if (
      !frame ||
      !isFresh(frame, now) ||
      frame.sequence <= this.sequence ||
      frame.capturedAtMs <= this.timestamp
    ) {
      this.brushes.forEach((_, i) => {
        this.breakStroke(i);
      });
      return;
    }
    const changed = frame.epoch !== this.epoch || frame.bodies.length !== this.playerCount;
    if (changed)
      this.brushes.forEach((_, i) => {
        this.breakStroke(i);
      });
    this.epoch = frame.epoch;
    this.sequence = frame.sequence;
    this.timestamp = frame.capturedAtMs;
    this.playerCount = frame.bodies.length;
    const assigned: Array<Body | undefined> = [undefined, undefined];
    if (this.players === 1 && frame.bodies.length === 1) assigned[0] = frame.bodies[0];
    else if (this.players === 2) {
      // Screen zones are ephemeral ownership, not array-index identity. A central gap forces release before crossing.
      for (const body of frame.bodies) {
        const a = body.leftShoulder,
          b = body.rightShoulder;
        if (!a || !b) continue;
        const x = 1 - (a.x + b.x) / 2;
        const slot = x < 0.44 ? 0 : x > 0.56 ? 1 : -1;
        if (slot < 0) continue;
        if (assigned[slot]) {
          assigned[slot] = undefined;
          break;
        }
        assigned[slot] = body;
      }
    }
    assigned.forEach((body, index) => {
      this.move(body, index, frame, blocked);
    });
  }
  private move(
    body: Body | undefined,
    index: number,
    frame: BodyFrame,
    blocked: (point: Point, player: number) => boolean,
  ): void {
    const brush = this.brushes[index];
    if (!brush) return;
    const wrist = body?.[brush.leftHand ? "leftWrist" : "rightWrist"];
    const other = body?.[brush.leftHand ? "rightWrist" : "leftWrist"];
    const shoulder = body?.[brush.leftHand ? "rightShoulder" : "leftShoulder"];
    if (!wrist) {
      this.breakStroke(index);
      return;
    }
    const point = { x: 1 - wrist.x, y: wrist.y };
    if (!shoulder || !other) {
      this.breakStroke(index);
      brush.point = point;
      return;
    }
    const torso = { x: shoulder.x, y: shoulder.y };
    const gap = frame.capturedAtMs - brush.lastTime;
    const jump =
      brush.point &&
      Math.hypot(
        ((point.x - brush.point.x) * frame.width) / frame.height,
        point.y - brush.point.y,
      ) > 0.24;
    const changedPerson =
      brush.torso && Math.hypot(torso.x - brush.torso.x, torso.y - brush.torso.y) > 0.15;
    const previous = brush.point;
    const continuing = brush.painting && gap > 0 && gap <= 180 && !jump && !changedPerson;
    const raised = other.y < shoulder.y - (continuing ? 0.02 : 0.07);
    brush.point = point;
    brush.torso = torso;
    brush.lastTime = frame.capturedAtMs;
    if (blocked(point, index) || !raised || jump || changedPerson || this.full) {
      brush.painting = false;
      return;
    }
    if (!continuing) brush.stroke = ++this.nextStroke;
    brush.painting = true;
    const from = continuing && previous ? previous : point;
    if (continuing && Math.hypot(point.x - from.x, point.y - from.y) < 0.003) return;
    if (this.marks.length >= MAX_MARKS) {
      this.full = true;
      brush.painting = false;
      return;
    }
    this.marks.push({
      from,
      to: point,
      color: colors[brush.color] ?? colors[0],
      radius: brush.thick ? 0.016 : 0.009,
      stroke: brush.stroke,
      player: index,
    });
    this.revision++;
  }
}

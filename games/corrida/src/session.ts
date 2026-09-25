import { isFresh, type BodyFrame } from "@jojixplay/game-sdk";
import { matchesPose, Movement, POSES, TOLERANCE, type PoseName } from "./movement";

export const RUN_SECONDS = 300;
export const LEVEL_STARTS = [0, 60, 150] as const;
export const JUMP_WINDOW = 2;
export interface Obstacle {
  readonly id: number;
  readonly at: number;
  readonly kind: "jump" | "wall" | "duck";
  readonly pose: PoseName;
}
export function levelAt(seconds: number): 1 | 2 | 3 {
  return seconds < 60 ? 1 : seconds < 150 ? 2 : 3;
}
export function distanceAt(seconds: number): number {
  return 9 * seconds + 0.0175 * seconds * seconds;
}
export function makeCourse(): readonly Obstacle[] {
  const result: Obstacle[] = [];
  for (const [index, start] of LEVEL_STARTS.entries()) {
    const end = LEVEL_STARTS[index + 1] ?? RUN_SECONDS;
    let step = 0;
    for (let at = start + 7; at < end - 3; at += Math.max(4, 6 - at / 150)) {
      const kind =
        index === 0
          ? "duck"
          : index === 1
            ? step % 2
              ? "duck"
              : "wall"
            : ((["jump", "wall", "duck"] as const)[step % 3] ?? "jump");
      result.push({
        id: result.length,
        at,
        kind,
        pose: POSES[Math.floor(result.length / 2) % POSES.length] ?? "asas",
      });
      step++;
    }
  }
  return result;
}
export class RaceSession {
  readonly course = makeCourse();
  readonly movement = new Movement();
  phase: "ready" | "countdown" | "running" | "lost" | "won" = "ready";
  elapsed = 0;
  countdown = 0;
  level: 1 | 2 | 3 = 1;
  lives = 3;
  score = 0;
  cleared = 0;
  jumpSerial = 0;
  nextIndex = 0;
  tracking = false;
  recovering = false;
  matching = false;
  feedback: { success: boolean; until: number; id: number } | null = null;
  private previousAt: number | null = null;
  private epoch: number | null = null;
  private sequence = -1;
  private capturedAt = -1;
  private invalidSince: number | null = null;
  private recoverSince: number | null = null;
  private crouchLostAt: number | null = null;
  private matchSince: number | null = null;
  private lastMatchAt = -Infinity;
  private jumpAt = -Infinity;
  private duckAt = -Infinity;
  private actionSeen = false;
  get next(): Obstacle | undefined {
    return this.course[this.nextIndex];
  }
  get action(): "jump" | "duck" | "wall" | null {
    if (this.phase !== "running" || this.recovering) return null;
    const obstacle = this.next;
    return obstacle && obstacle.at - this.elapsed <= 5.5 ? obstacle.kind : null;
  }
  get cameraCrouched(): boolean {
    return this.action === "duck" && this.movement.crouched;
  }
  private clearEvidence() {
    this.countdown = 0;
    if (this.phase === "countdown") this.phase = "ready";
    this.movement.reset();
    this.matchSince = this.crouchLostAt = null;
    this.lastMatchAt = this.jumpAt = this.duckAt = -Infinity;
    this.matching = this.actionSeen = false;
    this.sequence = -1;
    this.capturedAt = -1;
  }
  tick(now: number, frame: BodyFrame | null, paused = false) {
    const dt = this.previousAt === null ? 0 : Math.max(0, Math.min(100, now - this.previousAt));
    this.previousAt = now;
    if (frame && this.epoch !== frame.epoch) {
      this.clearEvidence();
      this.epoch = frame.epoch;
      if (this.phase === "running") this.recovering = true;
      this.recoverSince = null;
    }
    const body =
      frame && isFresh(frame, now) && frame.bodies.length === 1 ? frame.bodies[0] : undefined;
    this.tracking = !!body && !!(body.leftShoulder || body.rightShoulder) && !paused;
    if (!this.tracking) {
      this.movement.skeleton = {};
      this.matching = false;
      this.invalidSince ??= now;
      if (paused || now - this.invalidSince > TOLERANCE.noiseMs) {
        this.clearEvidence();
        if (this.phase === "running") this.recovering = true;
        this.recoverSince = null;
      }
      return;
    }
    this.invalidSince = null;
    if (!frame || !body) return;
    if (frame.sequence < this.sequence || frame.capturedAtMs < this.capturedAt) {
      this.tracking = false;
      this.clearEvidence();
      return;
    }
    const sampled = frame.sequence !== this.sequence;
    if (sampled) {
      this.movement.sample(
        body,
        frame.width / frame.height,
        frame.capturedAtMs,
        this.action === "jump",
      );
      if (this.movement.jumped && this.action === "jump") this.jumpSerial++;
      this.sequence = frame.sequence;
      this.capturedAt = frame.capturedAtMs;
    }
    if (this.phase === "ready" || this.phase === "countdown") {
      if (!this.movement.centered) {
        this.countdown = 0;
        this.phase = "ready";
        return;
      }
      if (this.movement.crouched) {
        this.crouchLostAt = null;
        this.phase = "countdown";
        this.countdown += dt;
        if (this.countdown >= 3000) {
          this.phase = "running";
          this.countdown = 3000;
        }
      } else {
        this.crouchLostAt ??= now;
        if (now - this.crouchLostAt > TOLERANCE.noiseMs) {
          this.countdown = 0;
          this.phase = "ready";
        }
      }
      return;
    }
    if (this.phase !== "running") return;
    if (this.recovering) {
      if (!this.movement.centered) {
        this.recoverSince = null;
        return;
      }
      this.recoverSince ??= now;
      if (now - this.recoverSince < 800) return;
      this.recovering = false;
      this.recoverSince = null;
      return;
    }
    this.elapsed = Math.min(RUN_SECONDS, this.elapsed + dt / 1000);
    const level = levelAt(this.elapsed);
    if (this.level !== level) {
      this.level = level;
      this.lives = 3;
    }
    if (sampled && this.movement.jumped) this.jumpAt = this.elapsed;
    if (this.movement.crouched && this.movement.centered) this.duckAt = this.elapsed;
    const obstacle = this.next;
    if (obstacle) {
      const matches = this.movement.centered && matchesPose(this.movement.skeleton, obstacle.pose);
      if (matches) {
        this.matchSince ??= now;
        this.lastMatchAt = now;
      } else if (now - this.lastMatchAt > TOLERANCE.noiseMs) this.matchSince = null;
      this.matching =
        matches && this.matchSince !== null && now - this.matchSince >= TOLERANCE.poseHoldMs;
      if (obstacle.kind === "jump" && Math.abs(this.jumpAt - obstacle.at) <= JUMP_WINDOW)
        this.actionSeen = true;
      if (obstacle.kind === "duck" && Math.abs(this.duckAt - obstacle.at) <= 1)
        this.actionSeen = true;
      const deadline =
        obstacle.at + (obstacle.kind === "wall" ? 0 : obstacle.kind === "jump" ? 1 : 0.6);
      if (this.elapsed >= deadline) {
        const success = obstacle.kind === "wall" ? this.matching : this.actionSeen;
        if (success) {
          this.score += 100;
          this.cleared++;
        } else this.lives--;
        this.feedback = { success, until: this.elapsed + 1.15, id: obstacle.id };
        this.nextIndex++;
        this.actionSeen = false;
        this.matchSince = null;
        this.lastMatchAt = this.jumpAt = this.duckAt = -Infinity;
        this.matching = false;
        if (this.lives === 0) this.phase = "lost";
      }
    }
    if (this.phase === "running" && this.elapsed >= RUN_SECONDS) this.phase = "won";
  }
}

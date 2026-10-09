import { type Body, type BodyFrame, isFresh } from "@jojixplay/game-sdk";
import { canStart, calibrate, type Puppet, PuppetReader, preview, standingX } from "./puppet";

/** How long the player must stand in place before the lanes are laid out around them. */
export const SETTLE_MS = 800;
/** Tracking may drop a reading or two while the player stands still; that is not leaving. */
const FLICKER_MS = 400;
/** A player gone this long has left; the next run starts from where they stand then. */
const ABSENCE_MS = 3000;
/** World units a second. */
export const SPEED = 7;

/** The one player a run follows: whoever stands nearest the middle of the view. */
function player(frame: BodyFrame): Body | null {
  let best: Body | null = null;
  let offset = Number.POSITIVE_INFINITY;
  for (const body of frame.bodies) {
    const x = standingX(body);
    if (x === null || Math.abs(x - 0.5) >= offset) continue;
    best = body;
    offset = Math.abs(x - 0.5);
  }
  return best;
}

/** One go at the road: waiting for the player to stand in place, then running until they leave. */
export class Run {
  public phase: "waiting" | "settling" | "running" = "waiting";
  /** Why a run has not started, while waiting. */
  public waitingFor: "player" | "middle" = "player";
  /** 0 to 1 while settling. */
  public settled = 0;
  /** What the avatar should be doing; null until the player has been seen. */
  public puppet: Puppet | null = null;
  /** Whether the player is being seen right now. */
  public tracking = false;
  public distance = 0;
  private reader: PuppetReader | null = null;
  private settlingSince: number | null = null;
  private lostSince: number | null = null;
  private previousAt: number | null = null;
  private epoch: number | null = null;

  public tick(now: number, frame: BodyFrame | null): void {
    const elapsed =
      this.previousAt === null ? 0 : Math.min(100, Math.max(0, now - this.previousAt));
    this.previousAt = now;
    // A new camera basis moves everything the calibration measured.
    if (frame && this.epoch !== null && frame.epoch !== this.epoch) this.restart();
    if (frame) this.epoch = frame.epoch;

    const body = frame && isFresh(frame, now) ? player(frame) : null;
    this.tracking = body !== null;
    if (this.phase === "running") this.distance += (SPEED * elapsed) / 1000;
    if (!frame || !body) {
      this.lostSince ??= now;
      if (this.phase === "settling" && now - this.lostSince <= FLICKER_MS) return;
      this.settlingSince = null;
      if (this.phase !== "running") {
        this.phase = "waiting";
        this.waitingFor = "player";
        this.settled = 0;
      } else if (now - this.lostSince > ABSENCE_MS) this.restart();
      return;
    }
    this.lostSince = null;
    const aspect = frame.width / frame.height;

    if (this.phase === "running" && this.reader) {
      this.puppet = this.reader.read(body, aspect);
      return;
    }
    // Before a run the avatar already copies the player's arms, standing where the run will start.
    this.puppet = preview(body, aspect);
    if (!canStart(body)) {
      this.phase = "waiting";
      this.waitingFor = body.leftShoulder && body.rightShoulder ? "middle" : "player";
      this.settlingSince = null;
      this.settled = 0;
      return;
    }
    this.phase = "settling";
    this.settlingSince ??= now;
    this.settled = Math.min(1, (now - this.settlingSince) / SETTLE_MS);
    if (this.settled < 1) return;
    const calibration = calibrate(body, aspect);
    if (!calibration) return;
    this.reader = new PuppetReader(calibration);
    this.puppet = this.reader.read(body, aspect);
    this.phase = "running";
  }

  private restart(): void {
    this.phase = "waiting";
    this.waitingFor = "player";
    this.reader = null;
    this.puppet = null;
    this.settlingSince = null;
    this.settled = 0;
    this.distance = 0;
  }
}

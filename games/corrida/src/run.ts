import {
  type Body,
  type BodyFrame,
  isFresh,
  type WorldBody,
  type WorldFrame,
} from "@jojixplay/game-sdk";
import { Course, extent, type Obstacle } from "./course";
import {
  type Arm,
  calibrate,
  canStart,
  type Puppet,
  PuppetReader,
  preview,
  standingX,
} from "./puppet";
import {
  BEAM_SPACING,
  BEAM_UNDERSIDE,
  FIGURE,
  figure,
  LOG_HEIGHT,
  MONSTER,
  POOL_DEPTH,
  RAIL_HEIGHT,
  SPEED,
  stretch,
} from "./world";

/** How long the player must stand in place before the lanes are laid out around them. */
export const SETTLE_MS = 800;
/** Tracking may drop a reading or two while the player stands still; that is not leaving. */
const FLICKER_MS = 400;
/** A player unseen for this long has left; the next run starts from where they stand then. */
const ABSENCE_MS = 6000;

/** What kind of run this is. */
export interface RunOptions {
  /** How long the road takes to run, from start to finish line. */
  readonly seconds: number;
  /** Hearts that run out come back, and the run goes on. Without it, the run is failed. */
  readonly immortal: boolean;
}
/** While the game is being tried out: five minutes, and nothing ends a run early. */
export const TRIAL: RunOptions = { seconds: 300, immortal: true };

// Phone-tuning parameters.
export const RULES = {
  hearts: 5,
  /**
   * Leaving the ground while a log is between `earliest` and `latest` ahead, from 0.85 to 0.15
   * seconds before it arrives, carries the character over it in an arc that lands `past` it. A
   * jump anywhere else is only for fun.
   */
  jump: { earliest: stretch(0.85), latest: stretch(0.15), past: stretch(0.3), height: 1.1 },
  /**
   * Away from a log the character leaves the ground as far as the player does, a little more
   * for show, and never as high as a log.
   */
  hop: { gain: 1.5, most: 0.4 },
  /**
   * A punch thrown while a monster is seen within `reach` of the character knocks it away: near
   * enough that the fist looks to meet it. It comes fast, so that is about a third of a second.
   * A monster that has arrived looms over the character for `late` more before it strikes, and
   * can still be punched then.
   */
  punch: { reach: 10, late: stretch(0.12), points: 10 },
  /** Time itself slows through the last stretch before the finish, to this share of its speed. */
  slow: { finishFrom: stretch(0.7), finishPace: 0.4 },
  /** How far ahead obstacles are laid, and how far behind they are forgotten. */
  ahead: stretch(7),
  behind: 14,
} as const;

/** An arm the camera lost while its hand held a rail is still holding it, straight up. */
const HOLDING: Arm = { upper: { x: 0, y: 1, z: 0 }, lower: { x: 0, y: 1, z: 0 } };

/** What a run reads: each person's place in the picture, and how they hold themselves. */
export type RunFrame = BodyFrame & WorldFrame;

/** An obstacle on the road and what became of it. */
export interface Item {
  readonly obstacle: Obstacle;
  state: "coming" | "passed" | "hit" | "punched";
  /** How many of a tunnel's beams the character has gone under. */
  beams: number;
  /** When a monster was punched, and by which arm. */
  punched?: { readonly at: number; readonly side: "left" | "right" };
}

/** The one player a run follows: whoever stands nearest the middle of the view. */
function player(frame: RunFrame): { body: Body; world: WorldBody } | null {
  let best: { body: Body; world: WorldBody } | null = null;
  let offset = Number.POSITIVE_INFINITY;
  frame.bodies.forEach((body, index) => {
    const x = standingX(body);
    if (x === null || Math.abs(x - 0.5) >= offset) return;
    // The two lists describe the same people in the same order.
    best = { body, world: frame.worldBodies[index] ?? {} };
    offset = Math.abs(x - 0.5);
  });
  return best;
}

/**
 * One go at the road: waiting for the player to stand in place, then running past whatever
 * comes to the finish line, or until the last heart goes. Then it waits to be started again.
 */
export class Run {
  public phase: "waiting" | "settling" | "running" | "finished" | "failed" = "waiting";
  /** Where the finish line is, in world units from the start. */
  public readonly length: number;
  /** Why a run has not started, while waiting. */
  public waitingFor: "player" | "middle" = "player";
  /** 0 to 1 while settling. */
  public settled = 0;
  /** What the avatar should be doing; null until the player has been seen. */
  public puppet: Puppet | null = null;
  /** Whether the player is being seen right now. */
  public tracking = false;
  public distance = 0;
  public hearts: number = RULES.hearts;
  public points = 0;
  /** Obstacles near enough to matter, nearest first. */
  public items: Item[] = [];
  /** How high the character's feet are off the road; below it when wading through a pool. */
  public lift = 0;
  /** Hanging from rails, and by which hands. */
  public hanging = false;
  public readonly grip = { left: false, right: false };
  /** The character's arms as drawn and judged: the player's, but for a held rail. */
  public arms: Puppet["arms"] = { left: null, right: null };
  /** When each arm last threw a punch, at a monster or at nothing. */
  public readonly punchedAt = { left: Number.NEGATIVE_INFINITY, right: Number.NEGATIVE_INFINITY };
  /** When a punch last landed on a monster. */
  public connectedAt = Number.NEGATIVE_INFINITY;
  /** How far along its arc over a log the character is, from 0 to 1; null on the ground. */
  public arc: number | null = null;
  /** When the character last came down from such an arc, and last fell into a pool. */
  public landedAt = Number.NEGATIVE_INFINITY;
  public fellAt = Number.NEGATIVE_INFINITY;
  /** Wading through a pool it fell into. */
  public wading = false;
  /** When the player last changed lane, and which way: -1 to the screen's left. */
  public stepped: { readonly at: number; readonly way: -1 | 1 } | null = null;
  /** When the character last ran into something, and when hearts last ran out. */
  public hitAt = Number.NEGATIVE_INFINITY;
  public refilledAt = Number.NEGATIVE_INFINITY;
  /** 0 to 1: how fully hanging has drawn the character under its lane's rails. */
  private pull = 0;
  /** The arc carrying the character over a log, by distances along the road. */
  private jump: { readonly from: number; readonly to: number; readonly over: Item } | null = null;
  private wasJumping = false;
  private lane: Puppet["lane"] = 0;
  private course: Course;
  private laid = 0;
  private reader: PuppetReader | null = null;
  private settlingSince: number | null = null;
  private lostSince: number | null = null;
  private previousAt: number | null = null;
  private epoch: number | null = null;

  public constructor(
    private readonly seed: number,
    private readonly options: RunOptions,
  ) {
    this.length = options.seconds * SPEED;
    this.course = new Course(seed, this.length);
  }

  public tick(now: number, frame: RunFrame | null): void {
    const elapsed =
      this.previousAt === null ? 0 : Math.min(100, Math.max(0, now - this.previousAt));
    this.previousAt = now;
    // A new camera basis moves everything the calibration measured.
    if (frame && this.epoch !== null && frame.epoch !== this.epoch) this.restart();
    if (frame) this.epoch = frame.epoch;

    const seen = frame && isFresh(frame, now) ? player(frame) : null;
    this.tracking = seen !== null;
    if (this.phase === "finished" || this.phase === "failed") {
      // The run is over until it is started again; the arms go on being the player's.
      if (frame && seen) this.puppet = preview(seen.body, seen.world, frame.width / frame.height);
      return;
    }
    if (!frame || !seen) {
      this.lostSince ??= now;
      if (this.phase === "settling" && now - this.lostSince <= FLICKER_MS) return;
      this.settlingSince = null;
      if (this.phase !== "running") {
        this.phase = "waiting";
        this.waitingFor = "player";
        this.settled = 0;
      } else if (now - this.lostSince > ABSENCE_MS) this.restart();
      // The road does not wait for a player the camera has lost: the character keeps the lane
      // and pose it was last seen in, and whatever arrives meets it like that.
      else this.advance(now, elapsed);
      return;
    }
    this.lostSince = null;
    const { body, world } = seen;
    const aspect = frame.width / frame.height;

    if (this.phase === "running" && this.reader) {
      this.puppet = this.reader.read(body, world, aspect, frame.capturedAtMs);
      this.advance(now, elapsed);
      return;
    }
    // Before a run the avatar already copies the player's arms, standing where the run will start.
    this.puppet = preview(body, world, aspect);
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
    this.puppet = this.reader.read(body, world, aspect, frame.capturedAtMs);
    this.phase = "running";
  }

  private advance(now: number, elapsed: number): void {
    const puppet = this.puppet;
    if (!puppet) return;
    const pace = this.distance >= this.length - RULES.slow.finishFrom ? RULES.slow.finishPace : 1;
    this.distance += (SPEED * pace * elapsed) / 1000;
    if (this.lane !== puppet.lane) {
      this.stepped = { at: now, way: puppet.lane > this.lane ? 1 : -1 };
      this.lane = puppet.lane;
    }
    this.course.layTo(this.distance + RULES.ahead);
    for (; this.laid < this.course.obstacles.length; this.laid += 1) {
      const obstacle = this.course.obstacles[this.laid];
      if (obstacle) this.items.push({ obstacle, state: "coming", beams: 0 });
    }
    this.items = this.items.filter(
      (item) => item.obstacle.at + extent(item.obstacle) > this.distance - RULES.behind,
    );

    // A hand takes hold above the head and lets go below the shoulders, so it does not flicker
    // between. A hand the camera cannot see is doing what it was last seen doing.
    const seen = figure(puppet);
    for (const side of ["left", "right"] as const) {
      if (!puppet.arms[side]) continue;
      this.grip[side] = seen[side].hand.y > (this.grip[side] ? seen.neck.y : seen.head.y);
    }
    const over = this.items.find(
      (item) =>
        item.obstacle.kind === "rails" &&
        this.distance >= item.obstacle.at &&
        this.distance < item.obstacle.at + extent(item.obstacle),
    );
    this.hanging = over?.state === "coming" && (this.grip.left || this.grip.right);
    const held = (side: "left" | "right") =>
      puppet.arms[side] ?? (this.hanging && this.grip[side] ? HOLDING : null);
    this.arms = { left: held("left"), right: held("right") };
    this.pull += ((this.hanging ? 1 : 0) - this.pull) * (1 - Math.exp(-elapsed / 220));

    // Leaving the ground with a log the right distance ahead is the jump over it.
    if (puppet.jumping && !this.wasJumping && this.tracking && !this.jump) {
      const log = this.items.find((item) => {
        const ahead = item.obstacle.at - this.distance;
        return (
          item.state === "coming" &&
          item.obstacle.kind === "log" &&
          ahead <= RULES.jump.earliest &&
          ahead >= RULES.jump.latest
        );
      });
      if (log)
        this.jump = { from: this.distance, to: log.obstacle.at + RULES.jump.past, over: log };
    }
    this.wasJumping = puppet.jumping;
    if (this.jump && this.distance >= this.jump.to) {
      this.jump = null;
      this.landedAt = now;
    }

    // A punch thrown with a monster the right distance ahead knocks it away, if it is thrown
    // with the arm on the monster's side of the road. Either arm will do for one in the middle,
    // and for one straight ahead in the player's own lane.
    for (const side of ["left", "right"] as const) {
      // Only a reading just taken throws a punch: one kept for a lost player threw its own.
      if (!puppet.thrown[side] || !this.tracking) continue;
      this.punchedAt[side] = now;
      const monster = this.items.find((item) => {
        const { obstacle } = item;
        const ahead = obstacle.at - this.distance;
        return (
          item.state === "coming" &&
          obstacle.kind === "monster" &&
          // As far off as it is seen to be.
          ahead * MONSTER.charge <= RULES.punch.reach &&
          ahead >= -RULES.punch.late &&
          (obstacle.lane === puppet.lane || obstacle.lane !== (side === "left" ? 1 : -1))
        );
      });
      if (!monster) continue;
      monster.state = "punched";
      monster.punched = { at: now, side };
      this.connectedAt = now;
      this.points += RULES.punch.points;
    }

    const shape = figure({ ...puppet, arms: this.arms });
    if (this.jump) {
      const along = (this.distance - this.jump.from) / (this.jump.to - this.jump.from);
      this.lift = 4 * RULES.jump.height * along * (1 - along);
      this.arc = along;
    } else if (this.hanging) {
      // The character hangs by its highest holding hand.
      const hands = (["left", "right"] as const).flatMap((side) =>
        this.grip[side] ? [shape[side].hand.y] : [],
      );
      this.lift = RAIL_HEIGHT - Math.max(...hands);
    } else if (over) {
      this.lift = -POOL_DEPTH;
      if (!this.wading) this.fellAt = now;
    } else {
      // A player the camera has lost is not taken to be still in the air.
      const rise = this.tracking ? puppet.rise : 0;
      this.lift = Math.min(RULES.hop.most, rise * FIGURE.torso * RULES.hop.gain);
    }

    if (!this.jump) this.arc = null;
    this.wading = !!over && !this.hanging;
    if (this.distance >= this.length) {
      this.end("finished");
      return;
    }

    // Each obstacle is judged at the moment it reaches the character, by what the character is
    // doing at that moment.
    for (const item of this.items) {
      const { obstacle } = item;
      if (item.state !== "coming" || this.distance < obstacle.at) continue;
      if (obstacle.kind === "block") {
        this.judge(item, !obstacle.lanes.includes(puppet.lane), now);
      } else if (obstacle.kind === "monster") {
        // It reaches across the whole road: unpunched, it gets the character wherever it is,
        // a moment after it arrives.
        if (this.distance >= obstacle.at + RULES.punch.late) this.judge(item, false, now);
      } else if (obstacle.kind === "log") {
        this.judge(item, this.jump?.over === item && this.lift > LOG_HEIGHT, now);
      } else if (obstacle.kind === "beam") {
        // Every beam of a tunnel is met in its turn; the first one struck is the only one that costs.
        while (
          item.state === "coming" &&
          this.distance >= obstacle.at + item.beams * BEAM_SPACING
        ) {
          if (shape.top + this.lift > BEAM_UNDERSIDE) this.judge(item, false, now);
          else if (++item.beams === obstacle.beams) this.judge(item, true, now);
        }
      } else if (this.distance >= obstacle.at + obstacle.length) {
        this.judge(item, true, now);
      } else if (!this.hanging) {
        // Nothing holds the rails: into the pool, to wade the rest of the way.
        this.judge(item, false, now);
      }
    }
  }

  /** Where the character is across the road, in lanes, as it is drawn. */
  public get offset(): number {
    const puppet = this.puppet;
    return puppet ? puppet.offset + (puppet.lane - puppet.offset) * this.pull : 0;
  }

  private judge(item: Item, cleared: boolean, now: number): void {
    item.state = cleared ? "passed" : "hit";
    if (cleared) return;
    this.hitAt = now;
    this.hearts -= 1;
    if (this.hearts > 0) return;
    if (!this.options.immortal) {
      this.end("failed");
      return;
    }
    this.hearts = RULES.hearts;
    this.refilledAt = now;
  }

  private end(phase: "finished" | "failed"): void {
    this.phase = phase;
    this.reader = null;
    this.lift = 0;
    this.hanging = false;
    this.jump = null;
    this.arc = null;
    this.wading = false;
    this.pull = 0;
  }

  /** Back to waiting for the player to stand in place, with the same road ahead. */
  public restart(): void {
    this.phase = "waiting";
    this.waitingFor = "player";
    this.reader = null;
    this.puppet = null;
    this.settlingSince = null;
    this.settled = 0;
    this.distance = 0;
    this.hearts = RULES.hearts;
    this.points = 0;
    this.punchedAt.left = this.punchedAt.right = Number.NEGATIVE_INFINITY;
    this.items = [];
    this.pull = 0;
    this.lift = 0;
    this.hanging = false;
    this.grip.left = this.grip.right = false;
    this.arms = { left: null, right: null };
    this.jump = null;
    this.arc = null;
    this.wading = false;
    this.stepped = null;
    this.lane = 0;
    this.wasJumping = false;
    this.laid = 0;
    this.course = new Course(this.seed, this.length);
  }
}

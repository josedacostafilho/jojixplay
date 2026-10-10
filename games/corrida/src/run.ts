import {
  type Body,
  type BodyFrame,
  isFresh,
  type WorldBody,
  type WorldFrame,
} from "@jojixplay/game-sdk";
import { Course, extent, type Obstacle, setDown, tube } from "./course";
import {
  type Arm,
  calibrate,
  canStart,
  type Lane,
  type Puppet,
  PuppetReader,
  preview,
  recalibrate,
  standingX,
} from "./puppet";
import {
  BANK,
  BEAM_SPACING,
  BEAM_UNDERSIDE,
  FIGURE,
  figure,
  LANDING,
  LOG_HEIGHT,
  MONSTER,
  POOL_DEPTH,
  RAIL_HEIGHT,
  RAVINE,
  SPEED,
  SWING,
  stretch,
  TRUNK,
  WATER_LEVEL,
} from "./world";

/** How long the player must stand in place before the lanes are laid out around them. */
export const SETTLE_MS = 800;
/** Tracking may drop a reading or two while the player stands still; that is not leaving. */
const FLICKER_MS = 400;

/** What kind of run this is. */
export interface RunOptions {
  /** How long the road takes to run, from start to finish line. */
  readonly seconds: number;
  /** Hearts that run out come back, and the run goes on. Without it, the run is failed. */
  readonly immortal: boolean;
  /** Which road to lay, to try the same one again. Any road, when not said. */
  readonly road?: number;
}
/** While the game is being tried out: one level of two minutes, and nothing ends a run early. */
export const TRIAL: RunOptions = { seconds: 120, immortal: true };

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
  /** The character is drawn into line with a hollow trunk over this much road before its mouth. */
  lineUp: stretch(0.3),
  /** How long after going into a river what lives there bites. */
  bite: stretch(0.4),
  /** How far ahead obstacles are laid, and how far behind they are forgotten. */
  ahead: stretch(7.8),
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
  /** The character has come to the start of this trunk or gap. */
  met?: boolean;
  /** The character took hold of the vine over this gap as it came to it. */
  holding?: boolean;
  /** The character struck this hollow trunk, at its mouth or from inside. */
  struck?: boolean;
  /** The character went into this hollow trunk, ducked. */
  inside?: boolean;
  /** The lane the character was in as it came to a trunk it did not go into. */
  beside?: Lane;
  /** Where along the road the character fell into this gap. */
  fellFrom?: number;
  /** This obstacle has cost its heart. A fall costs it later than it begins. */
  hurt?: boolean;
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
  /** Wading through a river it fell into, or down in a ravine it fell into. */
  public wading = false;
  public falling = false;
  /** 0 to 1: how far the dark has closed in on a character falling into a ravine. */
  public dark = 0;
  /** How far across a gap the character has swung on its vine, from 0 to 1; null otherwise. */
  public swing: number | null = null;
  /** Inside a hollow trunk. */
  public inside = false;
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
  private lane: Lane = 0;
  /** The lane of the vine last held: the character is drawn under it. */
  private heldLane: Lane = 0;
  /**
   * A hollow trunk the character is in, beside or just coming to: it is drawn within the
   * trunk's walls (`side` 0) or clear of them on one side, as fully as `weight` says.
   */
  private channel: { lane: Lane; side: -1 | 0 | 1; weight: number } | null = null;
  private course: Course;
  private laid = 0;
  private reader: PuppetReader | null = null;
  private settlingSince: number | null = null;
  private lostSince: number | null = null;
  private previousAt: number | null = null;
  private epoch: number | null = null;
  /** The camera's picture has changed under a run: its lanes are to be laid out in the new one. */
  private remeasure = false;
  /** How high the character last hung by a hand that held. */
  private hung = 0;

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
    // A new camera basis moves everything that was measured in the old one. A run goes on, and
    // its lanes are laid out again in the new picture; the wait to start one begins again.
    if (frame && this.epoch !== null && frame.epoch !== this.epoch) {
      this.remeasure = this.phase === "running";
      this.settlingSince = null;
    }
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
      }
      // The road does not wait for a player the camera has lost, however long: the character
      // keeps the lane and pose it was last seen in, and whatever arrives meets it like that.
      else this.advance(now, elapsed);
      return;
    }
    this.lostSince = null;
    const { body, world } = seen;
    const aspect = frame.width / frame.height;

    if (this.phase === "running" && this.reader) {
      if (this.remeasure) {
        const fresh = this.puppet ? recalibrate(body, aspect, this.puppet) : null;
        // Until the player can be measured in the new picture, they are as they last were.
        if (!fresh) {
          this.advance(now, elapsed);
          return;
        }
        this.reader = new PuppetReader(fresh);
        this.remeasure = false;
      }
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
    this.course.layTo(this.distance + RULES.ahead);
    for (; this.laid < this.course.obstacles.length; this.laid += 1) {
      const obstacle = this.course.obstacles[this.laid];
      if (obstacle) this.items.push({ obstacle, state: "coming", beams: 0 });
    }
    this.items = this.items.filter(
      (item) => item.obstacle.at + extent(item.obstacle) > this.distance - RULES.behind,
    );

    const seen = figure(puppet);
    // Under a roof only the head's own height counts: a hop does not lift it there.
    const ducked = seen.top <= BEAM_UNDERSIDE;
    /** The trunk or gap the character is in the length of. */
    const over = this.items.find(
      (item) =>
        (item.obstacle.kind === "gap" || item.obstacle.kind === "trunk") &&
        this.distance >= item.obstacle.at &&
        this.distance < item.obstacle.at + extent(item.obstacle),
    );
    const pipe = over ? tube(over.obstacle) : null;
    // A hollow trunk is gone into at its mouth, ducked, from its own lane. A head held up
    // there, or lifted anywhere inside, strikes it.
    if (over && !over.met) {
      over.met = true;
      if (pipe === puppet.lane) {
        if (ducked) over.inside = true;
        else this.strike(over, now);
      } else if (over.obstacle.kind === "trunk") over.beside = puppet.lane;
    }
    if (over?.inside && over.state === "coming" && !ducked) this.strike(over, now);
    const inside = over?.inside === true && over.state === "coming";
    // Its walls keep whoever is inside in its lane and whoever is outside out of it, whatever
    // the player's feet do. Past its end the character is wherever the player stands.
    const lane: Lane =
      inside && pipe !== null
        ? pipe
        : over?.beside !== undefined && puppet.lane === pipe
          ? over.beside
          : puppet.lane;
    if (this.lane !== lane) {
      this.stepped = { at: now, way: lane > this.lane ? 1 : -1 };
      this.lane = lane;
    }

    // A hand takes hold above the head and lets go below the shoulders, so it does not flicker
    // between. A hand the camera cannot see is doing what it was last seen doing.
    for (const side of ["left", "right"] as const) {
      if (!puppet.arms[side]) continue;
      this.grip[side] = seen[side].hand.y > (this.grip[side] ? seen.neck.y : seen.head.y);
    }
    const gap = over?.obstacle.kind === "gap" ? over : undefined;
    const chasm = gap?.obstacle.kind === "gap" ? gap.obstacle : undefined;
    // A gap is said to end where its far edge may first be, and a character over it is set
    // down past the furthest that edge may be: nothing depends on where the edge is drawn.
    const ideal = chasm ? chasm.at + chasm.length : 0;
    const landing = chasm ? setDown(chasm) : 0;
    const crossing = chasm !== undefined && this.distance < landing;
    // The vine hangs over one lane: it is taken from that lane, as the gap starts, and once
    // taken carries the character whatever the player's feet do. It must be held as far as the
    // gap is said to go; from there it carries the character on by itself.
    const within =
      gap !== undefined && crossing && !inside && (gap.holding === true || chasm?.vine === lane);
    const gripping =
      this.grip.left || this.grip.right || (gap?.holding === true && this.distance >= ideal);
    this.hanging = gap?.state === "coming" && within && gripping;
    if (gap && chasm && this.hanging) {
      gap.holding = true;
      if (chasm.vine !== null) this.heldLane = chasm.vine;
    }
    // Neither held nor inside: into the gap, for the rest of the way across.
    // Stepping off costs nothing yet: what hurts comes after.
    if (gap && crossing && gap.state === "coming" && !this.hanging && !inside) gap.state = "hit";
    if (gap && crossing && gap.state === "hit" && gap.fellFrom === undefined) {
      gap.fellFrom = this.distance;
      this.fellAt = now;
    }
    const fallen = gap !== undefined && gap.fellFrom !== undefined;
    const held = (side: "left" | "right") =>
      puppet.arms[side] ?? (this.hanging && this.grip[side] ? HOLDING : null);
    this.arms = { left: held("left"), right: held("right") };
    this.pull += ((this.hanging ? 1 : 0) - this.pull) * (1 - Math.exp(-elapsed / 220));

    // Where the character is drawn about a hollow trunk it is in, beside, or just coming to.
    this.channel = null;
    for (const item of this.items) {
      const trunk = tube(item.obstacle);
      const ahead = item.obstacle.at - this.distance;
      if (trunk === null || item.state !== "coming" || ahead > RULES.lineUp) continue;
      if (this.distance >= item.obstacle.at + extent(item.obstacle)) continue;
      const weight = ahead > 0 ? 1 - ahead / RULES.lineUp : 1;
      if (item.met ? item.inside : puppet.lane === trunk)
        this.channel = { lane: trunk, side: 0, weight };
      else if (item.obstacle.kind === "trunk")
        this.channel = {
          lane: trunk,
          side: ((item.met ? item.beside : puppet.lane) ?? 0) > trunk ? 1 : -1,
          weight,
        };
    }

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
          (obstacle.lane === lane || obstacle.lane !== (side === "left" ? 1 : -1))
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
    } else if (this.hanging && chasm) {
      // The character hangs by its highest holding hand, and swings down and up again across.
      const hands = (["left", "right"] as const).flatMap((side) =>
        this.grip[side] ? [shape[side].hand.y] : [],
      );
      if (hands.length > 0) this.hung = RAIL_HEIGHT - Math.max(...hands);
      const across = landing - chasm.at;
      const share = Math.min(1, Math.max(0, (this.distance - chasm.at) / across));
      const dip = Math.min(SWING.most[chasm.over], across * SWING.dip);
      this.lift = this.hung - dip * Math.sin(Math.PI * share);
      this.swing = share;
    } else if (gap && chasm && fallen) {
      const from = gap.fellFrom ?? chasm.at;
      if (chasm.over === "ravine") {
        // Down and down, faster and faster, with the dark closing in. Short of where the far
        // wall may be it is gone from sight, and past the furthest the wall may be it is put
        // back above the road and comes down onto it. The road never stops.
        const vanish = Math.max(from, ideal - RAVINE.vanish);
        // It strikes the bottom unseen, as the dark closes over it.
        if (this.distance >= vanish) this.hurt(gap, now);
        if (this.distance < vanish) {
          const seconds = (this.distance - from) / SPEED;
          this.lift = -Math.min(RAVINE.deepest, (RAVINE.fall * seconds * seconds) / 2);
          this.dark = 0.8 * ((this.distance - from) / (vanish - from)) ** 2;
        } else if (this.distance < landing) {
          // Unseen, it is already where it will come back.
          this.dark = 1;
          this.lift = LANDING.from;
        } else {
          const share = Math.min(1, (this.distance - landing) / LANDING.drop);
          this.lift = LANDING.from * (1 - share * share);
          this.dark = Math.max(0, 1 - share * 2.5);
        }
      } else {
        // Down one bank into the water and up the other, to be out where the far bank may
        // first be. What lives in the water bites a moment after the character is in it.
        if (this.distance >= Math.min(from + RULES.bite, Math.max(from, ideal)))
          this.hurt(gap, now);
        const down = (this.distance - from) / (BANK / 2);
        const up = (ideal - this.distance - BANK / 2) / BANK;
        const sunk = Math.min(1, Math.max(0, Math.min(down, up)));
        this.lift = (WATER_LEVEL - POOL_DEPTH) * sunk * sunk * (3 - 2 * sunk);
      }
    } else if (inside) {
      this.lift = 0;
    } else {
      // A player the camera has lost is not taken to be still in the air.
      const rise = this.tracking ? puppet.rise : 0;
      this.lift = Math.min(RULES.hop.most, rise * FIGURE.torso * RULES.hop.gain);
    }

    if (!this.jump) this.arc = null;
    if (!this.hanging) this.swing = null;
    const wasFalling = this.falling;
    this.wading = fallen && chasm?.over === "river" && this.distance < ideal;
    this.falling = fallen && chasm?.over === "ravine";
    if (!this.falling) this.dark = 0;
    // Back on the road after a fall: it lands as after any drop.
    if (wasFalling && !this.falling) this.landedAt = now;
    this.inside = inside;
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
        this.judge(item, !obstacle.lanes.includes(lane), now);
      } else if (obstacle.kind === "fall") {
        // It is still coming down as it is passed: on the ground on the side it falls from,
        // head high over the middle, and well clear of the far side.
        this.judge(item, lane !== obstacle.from && (lane !== 0 || ducked), now);
      } else if (obstacle.kind === "monster") {
        // Unpunched, it strikes a moment after it arrives. A great one reaches across the
        // whole road and gets the character wherever it is; a small one only in its own lane.
        if (this.distance >= obstacle.at + RULES.punch.late)
          this.judge(item, obstacle.size === "small" && obstacle.lane !== lane, now);
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
      } else if (this.distance >= obstacle.at + extent(obstacle)) {
        // The far end of a trunk or a gap, come to without having struck or fallen.
        this.judge(item, true, now);
      }
    }
  }

  /** Where the character is across the road, in lanes, as it is drawn. */
  public get offset(): number {
    const puppet = this.puppet;
    if (!puppet) return 0;
    const offset = puppet.offset + (this.heldLane - puppet.offset) * this.pull;
    const channel = this.channel;
    if (!channel) return offset;
    const want =
      channel.side === 0
        ? Math.min(channel.lane + TRUNK.room, Math.max(channel.lane - TRUNK.room, offset))
        : channel.side > 0
          ? Math.max(offset, channel.lane + TRUNK.beside)
          : Math.min(offset, channel.lane - TRUNK.beside);
    return offset + (want - offset) * channel.weight;
  }

  private strike(trunk: Item, now: number): void {
    trunk.struck = true;
    this.judge(trunk, false, now);
  }

  private judge(item: Item, cleared: boolean, now: number): void {
    item.state = cleared ? "passed" : "hit";
    if (!cleared) this.hurt(item, now);
  }

  /** Takes the heart an obstacle costs, once. */
  private hurt(item: Item, now: number): void {
    if (item.hurt) return;
    item.hurt = true;
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
    this.falling = false;
    this.dark = 0;
    this.swing = null;
    this.inside = false;
    this.channel = null;
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
    this.falling = false;
    this.dark = 0;
    this.swing = null;
    this.inside = false;
    this.channel = null;
    this.stepped = null;
    this.lane = 0;
    this.wasJumping = false;
    this.remeasure = false;
    this.hung = 0;
    this.laid = 0;
    this.course = new Course(this.seed, this.length);
  }
}

import { expect, it } from "vitest";
import type { Body } from "@jojixplay/game-sdk";
import { makeCourse, RaceSession } from "../src/session";
import { body, frame } from "./fixtures";
function driver(s = new RaceSession()) {
  let now = 0;
  const step = (b: Body | null = body(), paused = false) => {
    now += 20;
    s.tick(now, b ? frame(now, b) : null, paused);
  };
  const hold = (ms: number, b: Body | null = body(), paused = false) => {
    for (let t = 0; t < ms; t += 20) step(b, paused);
  };
  const start = () => {
    hold(500);
    hold(3060, body({ duck: true }));
    hold(800);
    expect(s.phase).toBe("running");
  };
  const automatic = () => {
    const o = s.next,
      until = o ? o.at - s.elapsed : Infinity;
    step(
      body({
        duck: o?.kind === "duck" && until < 0.35 && until > -0.4,
        lift: o?.kind === "jump" && until < 0.35 && until > -0.25 ? 0.12 : 0,
        ...(o?.kind === "wall" ? { pose: o.pose } : {}),
      }),
    );
  };
  return { s, step, hold, start, automatic, now: () => now };
}
it("requires a continuous central crouch, tolerates a bad frame, and cancels on posture interruption, loss, or epoch change", () => {
  const d = driver();
  d.hold(500);
  d.hold(1500, body({ duck: true }));
  expect(d.s.phase).toBe("countdown");
  d.step();
  expect(d.s.phase).toBe("countdown");
  d.hold(500);
  expect(d.s.phase).toBe("ready");
  expect(d.s.countdown).toBe(0);
  d.hold(1000, body({ duck: true, x: 0.05 }));
  expect(d.s.phase).toBe("ready");
  d.hold(1500, body({ duck: true }));
  d.hold(300, null);
  expect(d.s.phase).toBe("ready");
  d.hold(1500, body({ duck: true }));
  d.s.tick(d.now() + 20, frame(d.now() + 20, body({ duck: true }), 1));
  expect(d.s.countdown).toBeLessThan(100);
});
it("plays the complete deterministic five-minute course with three levels, fixed points and victory", () => {
  const d = driver();
  d.start();
  const levels = new Set<number>();
  while (d.s.phase === "running" && d.now() < 310000) {
    d.automatic();
    levels.add(d.s.level);
    expect(d.s.lives).toBeLessThanOrEqual(3);
  }
  expect([...levels]).toEqual([1, 2, 3]);
  expect(d.s.phase).toBe("won");
  expect(d.s.elapsed).toBe(300);
  expect(d.s.score).toBe(d.s.course.length * 100);
  expect(d.s.lives).toBe(3);
  expect(
    makeCourse()
      .filter((o) => o.at < 60)
      .every((o) => o.kind === "duck"),
  ).toBe(true);
  expect(
    makeCourse()
      .filter((o) => o.at < 150)
      .some((o) => o.kind === "jump"),
  ).toBe(false);
});
it("ends on the third miss without negative lives or duplicate penalties", () => {
  const d = driver();
  d.start();
  d.hold(22000);
  expect(d.s.phase).toBe("lost");
  expect(d.s.lives).toBe(0);
  expect(d.s.score).toBe(0);
  const elapsed = d.s.elapsed;
  d.hold(10000);
  expect(d.s.elapsed).toBe(elapsed);
  expect(d.s.lives).toBe(0);
});
it("refills lives only on entering a new level, including level three, and victories can have different scores", () => {
  const d = driver();
  d.start();
  const failedLevels = new Set<number>();
  let failureId = -1;
  let previousLevel = 1;
  while (d.s.phase === "running" && d.now() < 310000) {
    if (d.s.level !== previousLevel) {
      expect(d.s.lives).toBe(3);
      previousLevel = d.s.level;
    }
    if (!failedLevels.has(d.s.level) && d.s.next) {
      failedLevels.add(d.s.level);
      failureId = d.s.next.id;
    }
    if (d.s.next?.id === failureId) d.step();
    else d.automatic();
  }
  expect(d.s.phase).toBe("won");
  expect(d.s.lives).toBe(2);
  expect(d.s.score).toBe((d.s.course.length - 3) * 100);
});
it("freezes time on tracking loss, modal pause and stale frames, and waits before resuming", () => {
  const d = driver();
  d.start();
  const elapsed = d.s.elapsed;
  d.hold(2000, null);
  expect(d.s.elapsed).toBe(elapsed);
  expect(d.s.movement.skeleton).toEqual({});
  d.hold(400);
  expect(d.s.elapsed).toBe(elapsed);
  d.hold(800);
  expect(d.s.elapsed).toBeGreaterThan(elapsed);
  d.hold(2000, body(), true);
  const paused = d.s.elapsed;
  const stale = frame(d.now() - 500);
  d.s.tick(d.now() + 20, stale);
  expect(d.s.elapsed).toBe(paused);
  expect(d.s.lives).toBe(3);
});
it("accepts early and late jumps inside the timing window, but not unrelated earlier jumps", () => {
  for (const offset of [-1.8, 0.65, -3]) {
    const d = driver();
    d.start();
    const index = d.s.course.findIndex((o) => o.kind === "jump");
    const first = d.s.course[index];
    if (!first) throw new Error("course");
    d.s.nextIndex = index;
    d.s.elapsed = first.at - 4;
    while (d.s.elapsed < first.at + 1.1) {
      const since = d.s.elapsed - (first.at + offset);
      d.step(body({ lift: since >= 0 && since < 0.4 ? 0.12 : 0 }));
    }
    expect(d.s.score).toBe(offset === -3 ? 0 : 100);
  }
});
it("wall preview requires observed arms, and only matching at arrival scores", () => {
  const d = driver();
  d.start();
  while (d.s.elapsed < 64) d.automatic();
  const wall = d.s.next;
  if (wall?.kind !== "wall") throw new Error("expected wall");
  d.hold(500, body({ pose: wall.pose }));
  expect(d.s.matching).toBe(true);
  const { leftWrist: _wrist, ...missing } = body({ pose: wall.pose });
  d.hold(200, missing);
  expect(d.s.matching).toBe(false);
  while (d.s.elapsed < wall.at + 0.1) d.step();
  expect(d.s.feedback?.success).toBe(false);
  expect(d.s.lives).toBe(2);
});

it("does not treat a previous two-person packet's array slot as the solo player", () => {
  const s = new RaceSession();
  for (let t = 0; t < 4000; t += 20)
    s.tick(t, { ...frame(t), bodies: [body({ duck: true }), body()] });
  expect(s.phase).toBe("ready");
  expect(s.countdown).toBe(0);
  expect(s.tracking).toBe(false);
});

it("accepts a symbolic dip-and-rise before a jump without ducking the camera", () => {
  const d = driver();
  d.start();
  const index = d.s.course.findIndex((o) => o.kind === "jump");
  const obstacle = d.s.course[index];
  if (!obstacle) throw new Error("jump");
  d.s.nextIndex = index;
  d.s.elapsed = obstacle.at - 2.5;
  d.hold(400);
  d.hold(250, body({ duck: true }));
  expect(d.s.cameraCrouched).toBe(false);
  d.hold(350);
  expect(d.s.jumpSerial).toBe(1);
  while (d.s.elapsed < obstacle.at + 1.3) d.step();
  expect(d.s.score).toBe(100);
});

it("keeps the camera upright outside the matching obstacle context", () => {
  const d = driver();
  d.hold(500);
  d.hold(1000, body({ duck: true }));
  expect(d.s.cameraCrouched).toBe(false);
  d.start();
  d.hold(300, body({ lift: 0.04 }));
  expect(d.s.jumpSerial).toBe(0);
  d.s.elapsed = 4;
  d.hold(300, body({ duck: true }));
  expect(d.s.cameraCrouched).toBe(true);
  const index = d.s.course.findIndex((o) => o.kind === "wall");
  const wall = d.s.course[index];
  if (!wall) throw new Error("wall");
  d.s.nextIndex = index;
  d.s.elapsed = wall.at - 3;
  d.hold(300, body({ duck: true }));
  expect(d.s.cameraCrouched).toBe(false);
  d.hold(300, body({ lift: 0.04 }));
  expect(d.s.jumpSerial).toBe(0);
});

import { expect, it } from "vitest";
import type { BodyFrame } from "@jojixplay/game-sdk";
import { SwingSession } from "../src/session";
import { studioHand } from "../src/studio-hand";
const ray = () => ({ origin: { x: 0, y: 100, z: 0 }, direction: { x: 48, y: 40, z: -48 } });
const frame = (time: number, closed = false, epoch = 0): BodyFrame => ({
  sequence: time,
  capturedAtMs: time,
  width: 1280,
  height: 720,
  epoch,
  bodies: [],
  hands: [studioHand(0.7, 0.5, closed), studioHand(0.3, 0.5, false)],
});
it("keeps tracked hands visible while gameplay gesture handling is disabled", () => {
  const session = new SwingSession();
  tick(session, 0, frame(0));
  const latest = frame(100, true);
  session.update(latest, 100);
  session.tick(100, ray, false);
  expect(session.tracking.detected).toBe(true);
  expect(session.tracking.hands.left).toBe(latest.hands?.[0]);
  expect(session.gestures.hands.left.closed).toBe(false);
});
it("gesture resets and unknown curl cannot remove or prevent reacquiring observations", () => {
  const session = new SwingSession();
  const right = studioHand(0.3, 0.5, false);
  const returning = {
    ...studioHand(0.7, 0.5, true),
    worldLandmarks: Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 })),
  };
  tick(session, 0, frame(0));
  tick(session, 10, { ...frame(10), hands: [right] });
  expect(session.tracking.hands.left).toBeNull();
  tick(session, 20, { ...frame(20), hands: [right, returning] });
  expect(session.tracking.hands.left).toBe(returning);
  expect(session.tracking.hands.right).toBe(right);
  expect(session.gestures.hands.left.open).toBe(false);
  expect(session.gestures.hands.left.closed).toBe(false);
  session.gestures.reset();
  session.tick(30, ray, true);
  expect(session.tracking.hands.left).toBe(returning);
  expect(session.tracking.hands.right).toBe(right);
  session.replay();
  expect(session.tracking.hands.left).toBe(returning);
});
function tick(session: SwingSession, now: number, input: BodyFrame | null, shot = ray) {
  session.update(input, now);
  session.tick(now, shot, true);
}
it("starts using two stable open hands with no body, then independently shoots and releases", () => {
  const session = new SwingSession();
  for (let t = 0; t <= 1600; t += 50) tick(session, t, frame(t), ray);
  expect(session.physics.phase).toBe("roof");
  for (let t = 1650; t <= 2500; t += 50) tick(session, t, frame(t), ray);
  expect(session.physics.phase).toBe("air");
  tick(session, 2550, frame(2550, true), ray);
  tick(session, 2650, frame(2650, true), ray);
  expect(session.physics.webs.left).not.toBeNull();
  expect(session.physics.webs.right).toBeNull();
  const height = session.physics.position.y;
  for (let t = 2700; t <= 3100; t += 50) tick(session, t, null, ray);
  expect(session.physics.webs.left).toBeNull();
  expect(session.tracking.detected).toBe(false);
  expect(session.physics.position.y).not.toBe(height);
});
it("epoch changes release attachments and require opening again", () => {
  const session = new SwingSession();
  session.physics.start();
  session.physics.phase = "air";
  session.physics.position = { x: 0, y: 100, z: 0 };
  tick(session, 0, frame(0), ray);
  tick(session, 100, frame(100), ray);
  tick(session, 150, frame(150, true), ray);
  tick(session, 250, frame(250, true), ray);
  expect(session.physics.webs.left).not.toBeNull();
  tick(session, 300, frame(300, true, 1), ray);
  tick(session, 400, frame(400, true, 1), ray);
  expect(session.physics.webs.left).toBeNull();
  tick(session, 450, frame(450, false, 1), ray);
  tick(session, 550, frame(550, false, 1), ray);
  const previousAim = session.gestures.hands.left.aim.x;
  const moved = frame(600, false, 1);
  tick(
    session,
    600,
    { ...moved, hands: [studioHand(0.65, 0.5, false), studioHand(0.3, 0.5, false)] },
    ray,
  );
  expect(session.gestures.hands.left.aim.x).toBeGreaterThan(previousAim);
});
it("a missed held shot never automatically attaches later", () => {
  const session = new SwingSession();
  session.physics.start();
  session.physics.phase = "air";
  session.physics.position = { x: 0, y: 100, z: 0 };
  const miss = () => ({ origin: { x: 0, y: 100, z: 0 }, direction: { x: 0, y: 1, z: 0 } });
  tick(session, 0, frame(0), ray);
  tick(session, 100, frame(100), ray);
  tick(session, 150, frame(150, true), miss);
  tick(session, 250, frame(250, true), miss);
  tick(session, 300, frame(300, true), ray);
  expect(session.physics.webs.left).toBeNull();
});
it("accepts a newly delivered result even when inference took longer than the old capture-age cutoffs", () => {
  const session = new SwingSession();
  tick(session, 1000, frame(500), ray);
  expect(session.tracking.detected).toBe(true);
});

it("clears a silent stream by receipt time without refreshing it from a repeated frame", () => {
  const session = new SwingSession();
  session.physics.start();
  session.physics.phase = "air";
  session.physics.position = { x: 0, y: 100, z: 0 };
  tick(session, 1000, frame(100), ray);
  tick(session, 1100, frame(200), ray);
  tick(session, 1150, frame(250, true), ray);
  const held = frame(350, true);
  tick(session, 1250, held, ray);
  expect(session.physics.webs.left).not.toBeNull();
  tick(session, 1500, held, ray);
  expect(session.tracking.hands.left).not.toBeNull();
  expect(session.physics.webs.left).not.toBeNull();
  tick(session, 2251, held, ray);
  expect(session.tracking.detected).toBe(false);
  expect(session.physics.webs.left).toBeNull();
});
it("an empty result releases both webs immediately, while reacquired fists must reopen", () => {
  const session = new SwingSession();
  session.physics.start();
  session.physics.phase = "air";
  session.physics.position = { x: 0, y: 100, z: 0 };
  tick(session, 0, frame(0), ray);
  tick(session, 100, frame(100), ray);
  tick(session, 150, frame(150, true), ray);
  tick(session, 250, frame(250, true), ray);
  expect(session.physics.webs.left).not.toBeNull();
  tick(session, 260, { ...frame(260), hands: [] }, ray);
  expect(session.physics.webs.left).toBeNull();
  expect(session.tracking.detected).toBe(false);
  tick(session, 300, frame(300, true), ray);
  tick(session, 400, frame(400, true), ray);
  expect(session.physics.webs.left).toBeNull();
});

it("a result omitting one hand releases only that hand's web", () => {
  const session = new SwingSession();
  session.physics.start();
  session.physics.phase = "air";
  session.physics.position = { x: 0, y: 100, z: 0 };
  tick(session, 0, frame(0), ray);
  tick(session, 100, frame(100), ray);
  const both = (time: number): BodyFrame => ({
    ...frame(time),
    hands: [studioHand(0.7, 0.5, true), studioHand(0.3, 0.5, true)],
  });
  tick(session, 150, both(150), ray);
  tick(session, 250, both(250), ray);
  expect(session.physics.webs.left).not.toBeNull();
  expect(session.physics.webs.right).not.toBeNull();
  tick(session, 260, { ...frame(260), hands: [studioHand(0.7, 0.5, true)] }, ray);
  expect(session.physics.webs.left).not.toBeNull();
  expect(session.physics.webs.right).toBeNull();
});
it("accepts a receipt newer than the animation frame's start timestamp", () => {
  const session = new SwingSession();
  session.update(frame(500), 1010);
  session.tick(1000, ray, true);
  expect(session.tracking.detected).toBe(true);
});

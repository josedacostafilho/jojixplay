import type { Body, BodyFrame, Joint } from "@jojixplay/game-sdk";
import { expect, it } from "vitest";
import { SwingSession } from "../src/session";

const joint = (x: number, y: number): Joint => ({ x, y, z: 0, confidence: 1 });
function body(drop = 0, raised = false, wrist = true): Body {
  return {
    leftShoulder: joint(0.4, 0.28 + drop),
    rightShoulder: joint(0.6, 0.28 + drop),
    leftHip: joint(0.43, 0.53 + drop),
    rightHip: joint(0.57, 0.53 + drop),
    leftElbow: joint(0.35, (raised ? 0.22 : 0.42) + drop),
    rightElbow: joint(0.65, 0.42 + drop),
    ...(wrist ? { leftWrist: joint(0.3, (raised ? 0.14 : 0.52) + drop) } : {}),
  };
}
function frame(pose: Body, now: number): BodyFrame {
  return { sequence: now, capturedAtMs: now, epoch: 1, width: 1280, height: 720, bodies: [pose] };
}

it("starts after three seconds of crouch and keeps simulating through body loss", () => {
  const session = new SwingSession();
  for (let now = 0; now <= 300; now += 20) session.tick(now, frame(body(), now));
  for (let now = 320; now <= 3440; now += 20) session.tick(now, frame(body(0.09), now));
  expect(session.physics.phase).not.toBe("ready");
  const before = { ...session.physics.position };
  for (let now = 3460; now <= 10500; now += 20) session.tick(now, null);
  expect(session.gestures.tracking).toBe(false);
  expect(session.physics.phase).toBe("lost");
  expect(session.physics.position.z).toBeLessThan(before.z);
});

it("holds a web with only its elbow visible, then releases on sustained tracking loss", () => {
  const session = new SwingSession();
  session.physics.start();
  for (let now = 0; now <= 1600; now += 20) session.tick(now, frame(body(0, true, false), now));
  expect(session.gestures.arms.left).toBe(true);
  expect(session.gestures.tracking).toBe(true);
  expect(session.physics.webs.left).not.toBeNull();
  const before = { ...session.physics.position };
  for (let now = 1620; now <= 2000; now += 20) session.tick(now, null);
  expect(session.gestures.arms.left).toBe(false);
  expect(session.physics.webs.left).toBeNull();
  expect(session.physics.position.z).not.toBe(before.z);
});

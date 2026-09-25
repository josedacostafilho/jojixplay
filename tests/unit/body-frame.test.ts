import { expect, it } from "vitest";
import { isFresh } from "@jojixplay/game-sdk";
import { toBodyFrame } from "../../apps/jojixplay/src/pose/body-frame";
import type { PosePacket } from "../../apps/jojixplay/src/domain/pose";

function upperBody(): PosePacket {
  return {
    sequence: 1,
    capturedAtMs: 100,
    frame: { width: 1280, height: 720, layout: "landscape", epoch: 0 },
    poses: [
      {
        landmarks: Array.from({ length: 33 }, (_, i) => ({
          x: 0.4,
          y: 0.3,
          z: 0,
          visibility: i >= 11 && i <= 16 ? 1 : 0,
        })),
      },
    ],
  };
}
it("retains visible arms with every hip, leg and foot unavailable", () => {
  const packet = upperBody();
  const frame = toBodyFrame(packet);
  expect(frame.bodies[0]?.leftWrist).toEqual({ x: 0.4, y: 0.3, z: 0, confidence: 1 });
  expect(frame.bodies[0]?.rightShoulder).toBeDefined();
  expect(frame.bodies[0]?.leftHip).toBeUndefined();
  expect(packet.poses[0]?.landmarks[15]?.x).toBe(0.4);
});
it("removes only low-confidence or out-of-frame joints, not their neighbours", () => {
  const packet = upperBody();
  const pose = packet.poses[0];
  if (!pose) throw new Error("Missing pose");
  pose.landmarks[15] = { x: 1.2, y: 0.3, z: 0, visibility: 1 };
  pose.landmarks[16] = { x: 0.6, y: 0.3, z: 0, visibility: 0.59 };
  const body = toBodyFrame(packet).bodies[0];
  expect(body?.leftWrist).toBeUndefined();
  expect(body?.rightWrist).toBeUndefined();
  expect(body?.leftElbow).toBeDefined();
});
it("expires input from capture time and rejects future timestamps", () => {
  const frame = toBodyFrame(upperBody());
  expect(isFresh(frame, 350)).toBe(true);
  expect(isFresh(frame, 351)).toBe(false);
  expect(isFresh(frame, 99)).toBe(false);
});

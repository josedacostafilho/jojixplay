import { expect, it } from "vitest";
import { isFresh } from "@jojixplay/game-sdk";
import { toFrame } from "../../apps/jojixplay/src/pose/frame";
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
  const frame = toFrame(packet, "body");
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
  const body = toFrame(packet, "body").bodies[0];
  expect(body?.leftWrist).toBeUndefined();
  expect(body?.rightWrist).toBeUndefined();
  expect(body?.leftElbow).toBeDefined();
});
it("expires input from capture time and rejects future timestamps", () => {
  const frame = toFrame(upperBody(), "body");
  expect(isFresh(frame, 350)).toBe(true);
  expect(isFresh(frame, 351)).toBe(false);
  expect(isFresh(frame, 99)).toBe(false);
});

it("names hand points and reports each hand by the person's own side", () => {
  const frame = toFrame(
    {
      sequence: 3,
      capturedAtMs: 100,
      frame: { width: 1280, height: 720, layout: "landscape", epoch: 4 },
      hands: [
        {
          label: "left",
          score: 0.8,
          landmarks: Array.from({ length: 21 }, (_, i) => ({ x: i / 100, y: 0.5, z: 0 })),
        },
      ],
    },
    "hands",
  );
  expect(frame.sensing).toBe("hands");
  expect(frame.bodies).toEqual([]);
  expect(frame.epoch).toBe(4);
  expect(frame.hands[0]?.side).toBe("left");
  expect(frame.hands[0]?.points.wrist.x).toBe(0);
  expect(frame.hands[0]?.points.indexTip.x).toBe(0.08);
  expect(frame.hands[0]?.points.pinkyTip.x).toBe(0.2);
  expect(toFrame(upperBody(), "body")).toMatchObject({
    sensing: "body",
    hands: [],
    silhouette: null,
  });
});

it("carries a silhouette with the pose model's joints and says what was sensed", () => {
  const alpha = new Uint8Array([0, 255, 128, 0]);
  const frame = toFrame(
    { ...upperBody(), silhouette: { width: 2, height: 2, alpha } },
    "silhouette",
  );
  expect(frame.sensing).toBe("silhouette");
  expect(frame.silhouette).toEqual({ width: 2, height: 2, alpha });
  expect(frame.bodies[0]?.leftWrist).toBeDefined();
});

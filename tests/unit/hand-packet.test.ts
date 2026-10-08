import { expect, it } from "vitest";
import { parsePosePacket } from "../../apps/jojixplay/src/domain/pose";
import { toBodyFrame } from "../../apps/jojixplay/src/pose/body-frame";
const packet = () => ({
  sequence: 1,
  capturedAtMs: 10,
  frame: { width: 1280, height: 720, layout: "landscape", epoch: 1 },
  poses: [],
  hands: [
    {
      handedness: "left",
      handednessScore: 0.8,
      landmarks: Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
      worldLandmarks: Array.from({ length: 21 }, () => ({ x: 0.02, y: -0.03, z: 0.01 })),
    },
  ],
});
it("publishes hand geometry without fabricating body joints", () => {
  const parsed = parsePosePacket(packet());
  if (!parsed.ok) throw new Error(parsed.error);
  const frame = toBodyFrame(parsed.value);
  expect(frame.bodies).toEqual([]);
  expect(frame.hands).toEqual(packet().hands);
  expect(frame.epoch).toBe(1);
});
it.each([
  (p: ReturnType<typeof packet>) => {
    p.hands[0]?.landmarks.pop();
  },
  (p: ReturnType<typeof packet>) => {
    const h = p.hands[0];
    if (h) h.handedness = "unknown";
  },
  (p: ReturnType<typeof packet>) => {
    const h = p.hands[0];
    if (h) h.handednessScore = 2;
  },
  (p: ReturnType<typeof packet>) => {
    const point = p.hands[0]?.landmarks[0];
    if (point) point.x = -1.1;
  },
  (p: ReturnType<typeof packet>) => {
    const point = p.hands[0]?.worldLandmarks[0];
    if (point) point.z = NaN;
  },
  (p: ReturnType<typeof packet>) => {
    Reflect.set(p.hands[0] ?? {}, "id", 1);
  },
  (p: ReturnType<typeof packet>) => {
    p.sequence = -1;
  },
  (p: ReturnType<typeof packet>) => {
    p.hands.push(...p.hands, ...p.hands);
  },
])("rejects malformed hand packets %#", (mutate) => {
  const value = packet();
  mutate(value);
  expect(parsePosePacket(value).ok).toBe(false);
});

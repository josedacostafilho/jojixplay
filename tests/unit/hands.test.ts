import { expect, it } from "vitest";
import type { HandPacket } from "../../apps/jojixplay/src/domain/hands";
import { parseSensedPacket } from "../../apps/jojixplay/src/domain/sensed-packet";

function handPacket(): HandPacket {
  return {
    sequence: 7,
    capturedAtMs: 12.5,
    frame: { width: 1280, height: 720, layout: "landscape", epoch: 0 },
    hands: [
      {
        label: "right",
        score: 0.9,
        // A hand at the image edge has fingers outside it.
        landmarks: Array.from({ length: 21 }, (_, i) => ({ x: 0.9 + i / 100, y: 0.5, z: -0.02 })),
      },
    ],
  };
}

it("accepts and clones a hand packet, including points beyond the image edge", () => {
  const packet = handPacket();
  const result = parseSensedPacket(packet);
  expect(result).toEqual({ ok: true, value: packet });
  if (result.ok) expect(result.value).not.toBe(packet);
  expect(parseSensedPacket({ ...packet, hands: [] }).ok).toBe(true);
});

it.each([
  ["a third hand", (p: HandPacket) => p.hands.push(p.hands[0] as never, p.hands[0] as never)],
  ["a missing landmark", (p: HandPacket) => p.hands[0]?.landmarks.pop()],
  ["an unknown label", (p: HandPacket) => Object.assign(p.hands[0] ?? {}, { label: "Left" })],
  ["a score above one", (p: HandPacket) => Object.assign(p.hands[0] ?? {}, { score: 1.2 })],
  [
    "a non-finite coordinate",
    (p: HandPacket) => Object.assign(p.hands[0]?.landmarks[4] ?? {}, { y: Number.NaN }),
  ],
  [
    "an absurd coordinate",
    (p: HandPacket) => Object.assign(p.hands[0]?.landmarks[4] ?? {}, { x: 9 }),
  ],
  [
    "an extra landmark field",
    (p: HandPacket) => Object.assign(p.hands[0]?.landmarks[4] ?? {}, { visibility: 1 }),
  ],
  ["both kinds of observation", (p: HandPacket) => Object.assign(p, { poses: [] })],
])("rejects %s", (_name, corrupt) => {
  const packet = handPacket();
  corrupt(packet);
  expect(parseSensedPacket(packet).ok).toBe(false);
});

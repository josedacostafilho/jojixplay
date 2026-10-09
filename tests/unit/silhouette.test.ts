import { expect, it } from "vitest";
import { rotateNormalizedPoint } from "../../apps/jojixplay/src/domain/camera";
import { parseSensedPacket } from "../../apps/jojixplay/src/domain/sensed-packet";
import { uprightGrid } from "../../apps/jojixplay/src/domain/silhouette";

function packet(silhouette: unknown) {
  return {
    sequence: 1,
    capturedAtMs: 5,
    frame: { width: 1280, height: 720, layout: "landscape", epoch: 0 },
    poses: [],
    silhouette,
  };
}

it("accepts a silhouette grid and keeps its transferred buffer", () => {
  const alpha = new Uint8Array(6);
  const result = parseSensedPacket(packet({ width: 3, height: 2, alpha }));
  expect(result.ok).toBe(true);
  if (result.ok && "silhouette" in result.value) expect(result.value.silhouette.alpha).toBe(alpha);
});

it.each([
  ["a grid whose size disagrees with its data", { width: 3, height: 3, alpha: new Uint8Array(6) }],
  ["a plain array in place of bytes", { width: 1, height: 2, alpha: [0, 255] }],
  ["a zero dimension", { width: 0, height: 2, alpha: new Uint8Array(0) }],
  ["an absurd dimension", { width: 5000, height: 1, alpha: new Uint8Array(5000) }],
  ["an extra field", { width: 1, height: 1, alpha: new Uint8Array(1), people: 2 }],
  ["no grid at all", null],
])("rejects %s", (_name, silhouette) => {
  expect(parseSensedPacket(packet(silhouette)).ok).toBe(false);
});

it.each([90, 180, 270] as const)(
  "turns a grid upright by %s° exactly as landmarks are turned",
  (rotation) => {
    // One marked cell in a 4 by 2 grid on the camera's own pixels.
    const width = 4;
    const height = 2;
    const alpha = new Uint8Array(width * height);
    alpha[1 * width + 3] = 255;
    const turned = uprightGrid({ width, height, alpha }, rotation);
    expect([turned.width, turned.height]).toEqual(rotation === 180 ? [4, 2] : [2, 4]);

    const centre = rotateNormalizedPoint({ x: 3.5 / width, y: 1.5 / height }, rotation);
    const column = Math.floor(centre.x * turned.width);
    const row = Math.floor(centre.y * turned.height);
    expect(turned.alpha[row * turned.width + column]).toBe(255);
    expect(turned.alpha.reduce((sum, value) => sum + value, 0)).toBe(255);
  },
);

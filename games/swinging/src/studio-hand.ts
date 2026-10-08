import type { TrackedHand } from "@jojixplay/game-sdk";

/** Synthetic studio input only; runtime camera controls never fabricate joints. */
export function studioHand(x: number, y: number, closed: boolean): TrackedHand {
  const world = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (let finger = 0; finger < 5; finger++) {
    const base = 1 + finger * 4;
    for (let joint = 0; joint < 4; joint++) {
      world[base + joint] = {
        x: (finger - 2) * 0.018,
        y: -0.04 - (closed && joint > 1 ? (3 - joint) * 0.018 : joint * 0.02),
        z: closed && joint > 1 ? -(joint - 1) * 0.015 : 0,
      };
    }
  }
  return {
    handedness: x > 0.5 ? "left" : "right",
    handednessScore: 1,
    worldLandmarks: world,
    landmarks: world.map((p) => ({ x: x + p.x, y: y + p.y, z: p.z })),
  };
}

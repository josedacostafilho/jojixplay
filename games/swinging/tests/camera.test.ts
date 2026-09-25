import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { travelYaw } from "../src/scene";

describe("swing camera heading", () => {
  it.each([
    { direction: "forward", x: 0, z: -1 },
    { direction: "right", x: 1, z: 0 },
    { direction: "left", x: -1, z: 0 },
  ])("faces the player's $direction travel", ({ x, z }) => {
    const camera = new THREE.PerspectiveCamera();
    camera.rotation.order = "YXZ";
    camera.rotation.y = travelYaw({ x, y: 0, z });
    const facing = camera.getWorldDirection(new THREE.Vector3());
    expect(facing.dot(new THREE.Vector3(x, 0, z))).toBeGreaterThan(0.99);
  });
});

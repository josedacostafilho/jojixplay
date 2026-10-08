import { describe, expect, it } from "vitest";
import { buildings, rayTarget, RADIUS, STEP, SwingPhysics } from "../src/physics";

describe("manual web physics", () => {
  it("hits the first building on the exact ray and misses empty sky", () => {
    const origin = { x: 0, y: 100, z: -48 };
    const target = rayTarget(origin, { x: 1, y: 0, z: 0 });
    const building = buildings.find((b) => b.x === 48 && b.z === -48);
    expect(target).toEqual({ x: 48 - (building?.width ?? 0) / 2, y: 100, z: -48 });
    expect(rayTarget(origin, { x: 0, y: 1, z: 0 })).toBeNull();
    expect(rayTarget({ x: 500, y: 100, z: -48 }, { x: -1, y: 0, z: 0 })).toBeNull();
  });
  it("accepts a deliberate shot during the rooftop run", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.shoot("right", simulation.position, { x: 48, y: 30, z: -83 });
    expect(simulation.webs.right).not.toBeNull();
  });
  it("holds fixed independent anchors and preserves velocity on release", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.phase = "air";
    simulation.position = { x: 0, y: 100, z: -48 };
    simulation.shoot("left", simulation.position, { x: -1, y: 0.8, z: 0 });
    simulation.shoot("right", simulation.position, { x: 1, y: 0.8, z: 0 });
    const anchor = simulation.webs.right?.point;
    expect(anchor).toBeDefined();
    expect(simulation.webs.left).not.toBeNull();
    simulation.advance(0.1);
    expect(simulation.webs.right?.point).toEqual(anchor);
    const velocity = { ...simulation.velocity };
    simulation.release("right");
    expect(simulation.webs.right).toBeNull();
    expect(simulation.webs.left).not.toBeNull();
    expect(simulation.velocity).toEqual(velocity);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z)).toBeLessThanOrEqual(50);
  });
  it("runs off the roof and loses without attaching a web", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    for (let i = 0; i < 700; i++) simulation.advance(STEP);
    expect(simulation.phase).toBe("lost");
    expect(simulation.position.y).toBe(RADIUS);
  });
  it("lands on a roof and automatically runs onward", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    const building = buildings[1];
    if (!building) throw new Error("Missing test building");
    simulation.phase = "air";
    simulation.position = { x: building.x, y: building.height + RADIUS + 2, z: building.z };
    simulation.velocity = { x: 0, y: -15, z: -20 };
    for (let i = 0; i < 40; i++) simulation.advance(STEP);
    expect(simulation.phase).toBe("roof");
    expect(simulation.position.y).toBe(building.height + RADIUS);
    for (let i = 0; i < 180; i++) simulation.advance(STEP);
    expect(simulation.phase).toBe("air");
  });
  it("continues falling while sliding down a facade", () => {
    const building = buildings.find((entry) => entry.x === 48 && entry.z === -48);
    if (!building) throw new Error("Missing test building");
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.phase = "air";
    simulation.position = { x: building.x - building.width / 2 - RADIUS - 0.001, y: 50, z: -48 };
    simulation.velocity = { x: 30, y: -30, z: 0 };
    simulation.advance(STEP);
    expect(simulation.position.y).toBeLessThan(49.8);
  });
  it("bounds a long frame and prevents high-speed wall tunneling", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    const before = { ...simulation.position };
    simulation.advance(2);
    expect(
      Math.hypot(simulation.position.x - before.x, simulation.position.z - before.z),
    ).toBeLessThan(5);
    const building = buildings.find((entry) => entry.x === 48 && entry.z === -48);
    if (!building) throw new Error("Missing test building");
    simulation.phase = "air";
    simulation.position = { x: 0, y: 40, z: building.z };
    simulation.velocity = { x: 500, y: 0, z: 0 };
    simulation.advance(1);
    expect(simulation.position.x).toBeLessThan(building.x - building.width / 2 - RADIUS + 0.01);
  });
});

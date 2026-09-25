import { describe, expect, it } from "vitest";
import { buildings, RADIUS, STEP, SwingPhysics, type Side } from "../src/physics";

function run(seconds: number, arms: (time: number) => Partial<Record<Side, boolean>>) {
  const simulation = new SwingPhysics();
  simulation.start();
  for (let step = 0; step < seconds / STEP; step++) {
    const time = step * STEP,
      raised = arms(time);
    simulation.setArm("left", !!raised.left);
    simulation.setArm("right", !!raised.right);
    simulation.advance(STEP);
  }
  return simulation;
}

describe("two-arm swing prototype", () => {
  it("runs off the starting roof and loses on ground without a web", () => {
    const simulation = run(7, () => ({}));
    expect(simulation.phase).toBe("lost");
    expect(simulation.position.y).toBe(RADIUS);
    expect(simulation.webs.left).toBeNull();
    expect(simulation.webs.right).toBeNull();
  });

  it("attaches each held arm to a building and releases it independently", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.setArm("right", true);
    for (let i = 0; i < 110; i++) simulation.advance(STEP);
    const anchor = simulation.webs.right?.point;
    expect(anchor).toBeDefined();
    expect(
      buildings.some(
        (building) =>
          anchor &&
          Math.abs(anchor.y - (building.height - 1)) < 0.001 &&
          Math.abs(anchor.x - building.x) === building.width / 2 &&
          Math.abs(anchor.z - building.z) === building.depth / 2,
      ),
    ).toBe(true);
    simulation.setArm("left", true);
    for (let i = 0; i < 30; i++) simulation.advance(STEP);
    expect(simulation.webs.right?.point).toEqual(anchor);
    simulation.setArm("right", false);
    expect(simulation.webs.right).toBeNull();
    expect(simulation.raised.left).toBe(true);
  });

  it("allows two held webs without an explosive sideways impulse", () => {
    const simulation = run(2.5, () => ({ left: true, right: true }));
    expect(simulation.webs.left).not.toBeNull();
    expect(simulation.webs.right).not.toBeNull();
    expect(
      (simulation.webs.left?.point.x ?? 0) * (simulation.webs.right?.point.x ?? 0),
    ).toBeLessThan(0);
    expect(Math.abs(simulation.position.x)).toBeLessThan(5);
  });

  it("alternating balanced shots carries the player forward through several blocks", () => {
    const simulation = run(6, (time) => {
      const period = 0.6,
        index = Math.floor((time - 1) / period),
        active = time >= 1 && (time - 1) % period < period * 0.9;
      return { left: active && index % 2 === 1, right: active && index % 2 === 0 };
    });
    expect(simulation.phase).toBe("air");
    expect(simulation.position.z).toBeLessThan(-180);
    expect(Math.abs(simulation.position.x)).toBeLessThan(25);
  });

  it.each(["left", "right"] as const)(
    "a %s web turns a drop toward that side and release carries the climb",
    (side) => {
      const simulation = new SwingPhysics();
      simulation.start();
      simulation.setArm(side, true);
      const startHeight = simulation.position.y;
      let lowPoint = startHeight;
      let releasedAt: number | null = null;
      for (let step = 0; step < 540 && simulation.phase !== "lost"; step++) {
        simulation.advance(STEP);
        lowPoint = Math.min(lowPoint, simulation.position.y);
        if (lowPoint < startHeight - 8 && simulation.velocity.y > 3) {
          releasedAt = simulation.position.y;
          const direction = side === "right" ? 1 : -1;
          expect(simulation.position.x * direction).toBeGreaterThan(8);
          expect(
            Math.atan2(simulation.velocity.x, -simulation.velocity.z) * direction,
          ).toBeGreaterThan(0.35);
          simulation.setArm(side, false);
          break;
        }
      }
      expect(releasedAt).not.toBeNull();
      if (releasedAt === null) return;
      for (let step = 0; step < 18; step++) simulation.advance(STEP);
      expect(simulation.position.y).toBeGreaterThan(releasedAt + 0.3);
    },
  );

  it.each(["left", "right"] as const)("a timed %s shot can clear a 90-degree corner", (side) => {
    const direction = side === "right" ? 1 : -1;
    let clearTurn = false;
    for (let drop = 2; drop <= 34 && !clearTurn; drop += 2) {
      const simulation = new SwingPhysics();
      simulation.start();
      const startHeight = simulation.position.y;
      let touchedFacade = false,
        airborne = false;
      for (let step = 0; step < 900 && simulation.phase !== "lost"; step++) {
        if (simulation.phase === "air" && startHeight - simulation.position.y > drop) {
          simulation.setArm(side, true);
        }
        simulation.advance(STEP);
        if (airborne && simulation.phase === "roof") break;
        if (simulation.phase !== "air") continue;
        airborne = true;
        touchedFacade ||= buildings.some(
          (building) =>
            Math.abs(simulation.position.x - building.x) < building.width / 2 + RADIUS + 0.005 &&
            Math.abs(simulation.position.z - building.z) < building.depth / 2 + RADIUS + 0.005 &&
            simulation.position.y < building.height + RADIUS,
        );
        const heading = Math.atan2(simulation.velocity.x, -simulation.velocity.z) * direction;
        if (simulation.position.x * direction > 40 && heading > Math.PI / 2) {
          clearTurn = !touchedFacade;
          break;
        }
      }
    }
    expect(clearTurn).toBe(true);
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

  it("jumps off a roof but cannot double-jump in empty air", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.jump();
    simulation.advance(STEP);
    expect(simulation.phase).toBe("air");
    expect(simulation.velocity.y).toBeGreaterThan(8);
    const before = simulation.velocity.y;
    simulation.jump();
    simulation.advance(STEP);
    expect(simulation.velocity.y).toBeLessThan(before);
  });

  it("preserves a taut-web tug when the arm releases in the same step", () => {
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.phase = "air";
    simulation.position = { x: 0, y: 85, z: 0 };
    simulation.velocity = { x: 0, y: 0, z: -20 };
    simulation.setArm("right", true);
    simulation.webs.right = {
      point: { x: 45, y: 170, z: -45 },
      length: Math.hypot(45, 85, 45),
    };
    simulation.jump();
    simulation.setArm("right", false);
    simulation.advance(STEP);
    expect(simulation.webs.right).toBeNull();
    expect(simulation.velocity.y).toBeGreaterThan(4);
    expect(simulation.velocity.x).toBeGreaterThan(2);
  });

  it("uses wall contact for an outward jump while keeping ordinary wall collision", () => {
    const building = buildings.find((entry) => entry.x === 48 && entry.z === -48);
    if (!building) throw new Error("Missing test building");
    const simulation = new SwingPhysics();
    simulation.start();
    simulation.phase = "air";
    simulation.position = { x: building.x - building.width / 2 - RADIUS - 0.2, y: 50, z: -48 };
    simulation.velocity = { x: 30, y: 0, z: 0 };
    simulation.advance(STEP);
    expect(simulation.position.x).toBeLessThan(building.x - building.width / 2 - RADIUS);
    simulation.jump();
    simulation.advance(STEP);
    expect(simulation.velocity.x).toBeLessThan(-8);
    const outward = simulation.velocity.x;
    simulation.jump();
    simulation.advance(STEP);
    expect(simulation.velocity.x).toBeGreaterThan(outward - 1);
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

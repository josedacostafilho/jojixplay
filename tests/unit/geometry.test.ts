import { describe, expect, it } from "vitest";
import { calculateContainTransform, mapNormalizedPoint } from "../../src/render/geometry";

describe("contain geometry", () => {
  it("letterboxes a landscape frame inside a square target", () => {
    const transform = calculateContainTransform(1920, 1080, 1000, 1000);

    expect(transform.scale).toBeCloseTo(1000 / 1920);
    expect(transform.offsetX).toBeCloseTo(0);
    expect(transform.offsetY).toBeCloseTo(218.75);
    expect(mapNormalizedPoint(0.5, 0.5, 1920, 1080, transform)).toEqual({
      x: 500,
      y: 500,
    });
  });

  it("pillarboxes a portrait frame inside a landscape target", () => {
    const transform = calculateContainTransform(720, 1280, 1920, 1080);

    expect(transform.scale).toBeCloseTo(1080 / 1280);
    expect(transform.offsetX).toBeCloseTo(656.25);
    expect(transform.offsetY).toBeCloseTo(0);
  });
});

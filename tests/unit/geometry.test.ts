import { describe, expect, it } from "vitest";
import {
  createPoseProjection,
  frameNormalizedDistance,
  projectedFrameBounds,
  projectNormalizedPoint,
} from "../../src/render/geometry";

describe("contain geometry", () => {
  it("letterboxes a landscape frame inside a square target", () => {
    const projection = createPoseProjection(1920, 1080, 1000, 1000, false);

    expect(projection.scale).toBeCloseTo(1000 / 1920);
    expect(projection.offsetX).toBeCloseTo(0);
    expect(projection.offsetY).toBeCloseTo(218.75);
    expect(projectNormalizedPoint(0.5, 0.5, projection)).toEqual({
      x: 500,
      y: 500,
    });
  });

  it("pillarboxes a portrait frame inside a landscape target", () => {
    const projection = createPoseProjection(720, 1280, 1920, 1080, false);

    expect(projection.scale).toBeCloseTo(1080 / 1280);
    expect(projection.offsetX).toBeCloseTo(656.25);
    expect(projection.offsetY).toBeCloseTo(0);
    expect(projectedFrameBounds(projection)).toEqual({
      x: 656.25,
      y: 0,
      width: 607.5,
      height: 1080,
    });
  });

  it("mirrors television x coordinates without changing y", () => {
    const projection = createPoseProjection(1920, 1080, 1920, 1080, true);

    expect(projectNormalizedPoint(0.2, 0.65, projection)).toEqual({ x: 1536, y: 702 });
    const mirroredRight = projectNormalizedPoint(0.8, 0.65, projection);
    expect(mirroredRight.x).toBeCloseTo(384);
    expect(mirroredRight.y).toBe(702);
  });

  it("measures normalized body distances with camera-aspect correction", () => {
    expect(
      frameNormalizedDistance(
        { x: 0.25, y: 0.5 },
        { x: 0.75, y: 0.5 },
        {
          width: 1_280,
          height: 720,
        },
      ),
    ).toBeCloseTo(8 / 9);
    expect(
      frameNormalizedDistance(
        { x: 0.5, y: 0.25 },
        { x: 0.5, y: 0.75 },
        {
          width: 1_280,
          height: 720,
        },
      ),
    ).toBeCloseTo(0.5);
  });
});

import { expect, it } from "vitest";
import { cameraCover, estimateIndexPoint } from "../../apps/jojixplay/src/domain/camera-view";
import {
  resolveCameraFrameNormalization,
  rotateNormalizedPoint,
} from "../../apps/jojixplay/src/domain/camera";

it.each([0, 90, 270] as const)(
  "camera and hand projection agree after %s° source normalization and fullscreen cropping",
  (rotation) => {
    const source = rotation === 0 ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
    const n = resolveCameraFrameNormalization(
      source.width,
      source.height,
      {
        type: rotation === 270 ? "landscape-secondary" : "landscape-primary",
        layout: "landscape",
        angle: rotation,
      },
      0,
    );
    const cover = cameraCover(n.frame.width, n.frame.height, 844, 390);
    expect(cover.width).toBeGreaterThanOrEqual(844);
    expect(cover.height).toBeGreaterThanOrEqual(390);
    expect(cover.width / cover.height).toBeCloseTo(n.frame.width / n.frame.height);
    const original = { x: 0.3, y: 0.4 };
    const normalized = rotateNormalizedPoint(original, n.rotation);
    const projected = {
      x: cover.left + (1 - normalized.x) * cover.width,
      y: cover.top + normalized.y * cover.height,
    };
    // Independent CSS math: center source, clockwise rotation, mirror, then cover scaling.
    const x = (original.x - 0.5) * source.width * cover.scale;
    const y = (original.y - 0.5) * source.height * cover.scale;
    const a = (rotation * Math.PI) / 180;
    expect(projected.x).toBeCloseTo(422 - (x * Math.cos(a) - y * Math.sin(a)));
    expect(projected.y).toBeCloseTo(195 + x * Math.sin(a) + y * Math.cos(a));
  },
);
it("estimates near the index, supports wrist-only input and bounds reach without mutating joints", () => {
  const wrist = Object.freeze({ x: 0.4, y: 0.5, z: 0, confidence: 1 });
  expect(estimateIndexPoint({}, false, 2)).toBeUndefined();
  expect(estimateIndexPoint({ rightWrist: wrist }, false, 2)?.y).toBeCloseTo(0.465);
  const index = estimateIndexPoint(
    { rightWrist: wrist, rightIndex: { ...wrist, y: 0.44 } },
    false,
    2,
  );
  expect(index?.y).toBeCloseTo(0.434);
  const elbow = estimateIndexPoint({ leftWrist: wrist, leftElbow: { ...wrist, y: 0.7 } }, true, 2);
  expect(elbow?.y).toBeCloseTo(0.456);
  const far = estimateIndexPoint({ rightWrist: wrist, rightIndex: { ...wrist, x: 1 } }, false, 2);
  expect(far?.x).toBeCloseTo(0.44);
  expect(estimateIndexPoint({ leftWrist: { ...wrist, y: 0.01 } }, true, 2)?.y).toBe(0);
  expect(wrist.y).toBe(0.5);
});

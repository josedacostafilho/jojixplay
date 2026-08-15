import { describe, expect, it } from "vitest";
import {
  cameraLayoutForDimensions,
  isCameraFrame,
  parseCameraLayoutMessage,
  parseScreenCameraOrientation,
  resolveCameraFrameNormalization,
  rotateNormalizedPoint,
  sameCameraFrameBasis,
} from "../../src/domain/camera";

describe("camera domain", () => {
  it("derives only non-square layouts and validates an exact frame contract", () => {
    expect(cameraLayoutForDimensions(1_280, 720)).toBe("landscape");
    expect(cameraLayoutForDimensions(720, 1_280)).toBe("portrait");
    expect(cameraLayoutForDimensions(1_000, 1_000)).toBeNull();

    expect(isCameraFrame({ width: 1_280, height: 720, layout: "landscape", epoch: 3 })).toBe(true);
    expect(isCameraFrame({ width: 1_280, height: 720, layout: "portrait", epoch: 3 })).toBe(false);
    expect(isCameraFrame({ width: 1_000, height: 1_000, layout: "landscape", epoch: 3 })).toBe(
      false,
    );
    expect(isCameraFrame({ width: 1_280, height: 720, layout: "landscape", epoch: -1 })).toBe(
      false,
    );
    expect(
      isCameraFrame({
        width: 1_280,
        height: 720,
        layout: "landscape",
        epoch: 3,
        legacyRotation: 0,
      }),
    ).toBe(false);
  });

  it("strictly parses screen orientation and layout messages", () => {
    expect(parseScreenCameraOrientation("portrait-primary", 0)).toEqual({
      ok: true,
      value: { type: "portrait-primary", layout: "portrait", angle: 0 },
    });
    expect(parseScreenCameraOrientation("landscape-secondary", 270)).toEqual({
      ok: true,
      value: { type: "landscape-secondary", layout: "landscape", angle: 270 },
    });
    expect(parseScreenCameraOrientation("portrait", 0).ok).toBe(false);
    expect(parseScreenCameraOrientation("portrait-primary", 45).ok).toBe(false);

    expect(parseCameraLayoutMessage({ cameraLayout: "landscape" })).toEqual({
      ok: true,
      value: { cameraLayout: "landscape" },
    });
    expect(parseCameraLayoutMessage({ cameraLayout: "landscape", legacy: true }).ok).toBe(false);
    expect(parseCameraLayoutMessage({ cameraLayout: "square" }).ok).toBe(false);
  });

  it("resolves raw and browser-corrected frames into one upright basis", () => {
    const portrait = resolveCameraFrameNormalization(
      720,
      1_280,
      { type: "portrait-primary", layout: "portrait", angle: 0 },
      0,
    );
    expect(portrait).toMatchObject({
      source: { width: 720, height: 1_280 },
      rotation: 0,
      frame: { width: 720, height: 1_280, layout: "portrait", epoch: 0 },
    });

    const rotatedLandscape = resolveCameraFrameNormalization(
      720,
      1_280,
      { type: "landscape-primary", layout: "landscape", angle: 90 },
      1,
    );
    expect(rotatedLandscape).toMatchObject({
      rotation: 90,
      frame: { width: 1_280, height: 720, layout: "landscape", epoch: 1 },
    });

    const browserCorrectedLandscape = resolveCameraFrameNormalization(
      1_280,
      720,
      { type: "landscape-primary", layout: "landscape", angle: 90 },
      2,
    );
    expect(browserCorrectedLandscape).toMatchObject({
      rotation: 0,
      frame: { width: 1_280, height: 720, layout: "landscape", epoch: 2 },
    });

    const browserCorrectedSecondaryPortrait = resolveCameraFrameNormalization(
      720,
      1_280,
      { type: "portrait-secondary", layout: "portrait", angle: 180 },
      3,
    );
    expect(browserCorrectedSecondaryPortrait.rotation).toBe(0);
  });

  it("maps every clockwise quarter-turn into canonical normalized coordinates", () => {
    const point = { x: 0.2, y: 0.3 };
    expect(rotateNormalizedPoint(point, 0)).toEqual({ x: 0.2, y: 0.3 });
    expect(rotateNormalizedPoint(point, 90)).toEqual({ x: 0.7, y: 0.2 });
    expect(rotateNormalizedPoint(point, 180)).toEqual({ x: 0.8, y: 0.7 });
    expect(rotateNormalizedPoint(point, 270)).toEqual({ x: 0.3, y: 0.8 });
  });

  it("treats epoch changes as camera-basis changes", () => {
    const frame = { width: 1_280, height: 720, layout: "landscape" as const, epoch: 4 };
    expect(sameCameraFrameBasis(frame, { ...frame })).toBe(true);
    expect(sameCameraFrameBasis(frame, { ...frame, epoch: 5 })).toBe(false);
  });
});

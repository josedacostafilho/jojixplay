import { describe, expect, it } from "vitest";
import {
  gameSupportsCameraLayout,
  requiredCameraLayout,
  supportedCameraLayouts,
} from "../../src/games/catalog";

describe("game camera-layout catalog", () => {
  it("allows Draw and one-player Bubbles in either layout", () => {
    expect(supportedCameraLayouts("draw", 1)).toEqual(["portrait", "landscape"]);
    expect(supportedCameraLayouts("draw", 2)).toEqual(["portrait", "landscape"]);
    expect(supportedCameraLayouts("bubbles", 1)).toEqual(["portrait", "landscape"]);
    expect(gameSupportsCameraLayout("bubbles", 1, "portrait")).toBe(true);
    expect(requiredCameraLayout("draw", 2)).toBeNull();
  });

  it("requires landscape for two-player Bubbles", () => {
    expect(supportedCameraLayouts("bubbles", 2)).toEqual(["landscape"]);
    expect(gameSupportsCameraLayout("bubbles", 2, "portrait")).toBe(false);
    expect(requiredCameraLayout("bubbles", 2)).toBe("landscape");
  });
});

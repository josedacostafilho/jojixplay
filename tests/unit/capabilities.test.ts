import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  inspectLocalPlayCapabilities,
  inspectPhoneControllerCapabilities,
  inspectTvDisplayCapabilities,
} from "../../src/platform/capabilities";

describe("mode-specific capability checks", () => {
  beforeEach(() => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      {} as CanvasRenderingContext2D,
    );
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn() } });
    vi.stubGlobal("screen", {
      orientation: { type: "landscape-primary", angle: 0 },
    });
    vi.stubGlobal("Worker", class WorkerMock {});
    vi.stubGlobal("createImageBitmap", vi.fn());
    vi.stubGlobal("ResizeObserver", class ResizeObserverMock {});
    vi.stubGlobal("WebSocket", undefined);
    vi.stubGlobal("RTCPeerConnection", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "isSecureContext");
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
  });

  it("allows local play without peer-network APIs while paired modes still require them", () => {
    expect(inspectLocalPlayCapabilities()).toEqual({ supported: true, missing: [] });
    expect(inspectPhoneControllerCapabilities()).toMatchObject({
      supported: false,
      missing: expect.arrayContaining(["WebSockets", "WebRTC DataChannels"]),
    });
    expect(inspectTvDisplayCapabilities()).toMatchObject({
      supported: false,
      missing: expect.arrayContaining(["WebSockets", "WebRTC DataChannels"]),
    });
  });
});

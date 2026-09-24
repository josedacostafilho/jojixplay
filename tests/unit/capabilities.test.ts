import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inspectLocalPlayCapabilities } from "../../src/platform/capabilities";

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
    vi.stubGlobal(
      "AudioContext",
      class AudioContextMock {
        public createGain(): void {}
        public createOscillator(): void {}
        public createStereoPanner(): void {}
      },
    );
    vi.stubGlobal("WebSocket", undefined);
    vi.stubGlobal("RTCPeerConnection", undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, "isSecureContext");
    Reflect.deleteProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback");
  });

  it("runs without peer-network APIs", () => {
    expect(inspectLocalPlayCapabilities()).toEqual({ supported: true, missing: [] });
  });
  it("requires native Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(inspectLocalPlayCapabilities().missing).toContain("Web Audio");
  });
});

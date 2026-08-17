import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalImmersiveSession } from "../../src/platform/local-immersive-session";

describe("local immersive session", () => {
  const requestFullscreen = vi.fn();
  const exitFullscreen = vi.fn();
  const requestWakeLock = vi.fn();
  const releaseWakeLock = vi.fn();
  let fullscreenElement: Element | null;

  beforeEach(() => {
    fullscreenElement = null;
    requestFullscreen.mockReset().mockImplementation(async () => {
      fullscreenElement = document.documentElement;
    });
    exitFullscreen.mockReset().mockImplementation(async () => {
      fullscreenElement = null;
    });
    releaseWakeLock.mockReset().mockResolvedValue(undefined);
    requestWakeLock.mockReset().mockResolvedValue({
      released: false,
      release: releaseWakeLock,
      addEventListener: vi.fn(),
    } as unknown as WakeLockSentinel);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement,
    });
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    Object.defineProperty(document, "exitFullscreen", {
      configurable: true,
      value: exitFullscreen,
    });
    vi.stubGlobal("navigator", { wakeLock: { request: requestWakeLock } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    Reflect.deleteProperty(document, "exitFullscreen");
    Reflect.deleteProperty(document, "fullscreenElement");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("acquires optional fullscreen and wake ownership and releases both on stop", async () => {
    const session = new LocalImmersiveSession();

    session.start();
    await vi.waitFor(() => expect(requestWakeLock).toHaveBeenCalledWith("screen"));
    await vi.waitFor(() => expect(requestFullscreen).toHaveBeenCalledOnce());
    await session.stop();

    expect(releaseWakeLock).toHaveBeenCalledOnce();
    expect(exitFullscreen).toHaveBeenCalledOnce();
  });

  it("keeps local play nonfatal when optional immersive requests are rejected", async () => {
    requestFullscreen.mockRejectedValue(new DOMException("Fullscreen denied"));
    requestWakeLock.mockRejectedValue(new DOMException("Wake lock denied"));
    const session = new LocalImmersiveSession();

    expect(() => session.start()).not.toThrow();
    await Promise.resolve();
    await expect(session.stop()).resolves.toBeUndefined();

    expect(releaseWakeLock).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });
});

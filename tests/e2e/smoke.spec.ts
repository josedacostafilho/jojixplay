import { expect, test } from "@playwright/test";
import { readdir } from "node:fs/promises";

test("landing page exposes all three application modes", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Turn a phone and TV into a motion playground." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the TV/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the phone/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Play on this phone/ })).toBeVisible();
});

test("television enters TV mode and creates QR and manual pairing surfaces", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => {
        Reflect.set(window, "__jojixplayFullscreenRequested", true);
        return Promise.reject(new DOMException("Fullscreen unavailable in the test browser."));
      },
    });
  });
  await page.goto("/?mode=tv");

  await expect(
    page.getByRole("heading", { name: "Make this screen the playground." }),
  ).toBeVisible();
  await expect(page.getByLabel("TV pairing key")).toHaveCount(0);
  await page.getByRole("button", { name: "Start TV mode" }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__jojixplayFullscreenRequested")))
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Connect your phone" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Phone pairing QR code" })).toBeVisible();
  await expect(page.getByLabel("TV pairing key")).toHaveText(
    /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){4}$/,
  );
  await expect(page.getByText("Camera pixels never leave the phone.")).toBeVisible();
});

test("phone route offers manual pairing without a QR fragment", async ({ page }) => {
  await page.goto("/?mode=phone");

  await expect(page.getByRole("heading", { name: "Enter the key from your TV." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "TV pairing key" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start body tracking/ })).toHaveCount(0);
});

test("phone accepts a manually entered TV pairing key", async ({ page }) => {
  await page.goto("/?mode=phone");

  await page.getByRole("textbox", { name: "TV pairing key" }).fill("m7pkj3tdw9hxq4fv6r2c");
  await page.getByRole("button", { name: "Connect to TV" }).click();

  await expect(page.getByRole("button", { name: "Start body tracking" })).toBeVisible();
});

test("phone starts the camera and local pose worker after user activation", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      Reflect.set(window, "__jojixplayCameraConstraints", JSON.stringify(constraints));
      return originalGetUserMedia(constraints);
    };
  });
  await page.goto("/?mode=phone#key=M7PKJ3TDW9HXQ4FV6R2C");

  const startButton = page.getByRole("button", { name: "Start body tracking" });
  await expect(startButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
  await startButton.click();

  await expect(page.getByRole("button", { name: "Stop tracking" })).toBeVisible({
    timeout: 30_000,
  });
  const requestedConstraints = await page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__jojixplayCameraConstraints");
    return typeof value === "string" ? value : null;
  });
  expect(requestedConstraints).not.toBeNull();
  expect(JSON.parse(requestedConstraints ?? "null")).toMatchObject({
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      frameRate: { ideal: 30, max: 30 },
    },
  });
  await expect(page.getByText(/visible · (portrait|landscape)$/)).toBeVisible();
});

test("all-in-one phone mode reaches a real local pose packet without preview or peer transport", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Reflect.set(window, "__jojixplayTrackStopCount", 0);
    Reflect.set(window, "__jojixplayWakeReleaseCount", 0);
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "RTCPeerConnection", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => {
        Reflect.set(window, "__jojixplayFullscreenRequested", true);
        return Promise.reject(new DOMException("Fullscreen unavailable in the test browser."));
      },
    });
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async () => ({
          released: false,
          addEventListener: () => undefined,
          release: async () => {
            Reflect.set(
              window,
              "__jojixplayWakeReleaseCount",
              Number(Reflect.get(window, "__jojixplayWakeReleaseCount")) + 1,
            );
          },
        }),
      },
    });
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      Reflect.set(window, "__jojixplayCameraConstraints", JSON.stringify(constraints));
      const stream = await originalGetUserMedia(constraints);
      for (const track of stream.getTracks()) {
        const originalStop = track.stop.bind(track);
        track.stop = () => {
          Reflect.set(
            window,
            "__jojixplayTrackStopCount",
            Number(Reflect.get(window, "__jojixplayTrackStopCount")) + 1,
          );
          originalStop();
        };
      }
      return stream;
    };
  });
  await page.goto("/?mode=local");

  await expect(page.getByRole("heading", { name: "Play right here on your phone." })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0);
  await expect(page.getByLabel("TV pairing key")).toHaveCount(0);
  await expect(page.getByLabel(/camera preview/i)).toHaveCount(0);
  const captureSource = page.locator("video.local-camera-source");
  await expect(captureSource).toHaveAttribute("aria-hidden", "true");
  await expect(captureSource).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Start local play" }).click();
  await expect(page.getByRole("button", { name: "Stop local play" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator(".body-playfield")).toHaveAttribute(
    "data-camera-layout",
    /portrait|landscape/,
    { timeout: 30_000 },
  );
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__jojixplayFullscreenRequested")))
    .toBe(true);
  expect(
    await page.evaluate(() => ({
      webSocket: typeof window.WebSocket,
      peerConnection: typeof window.RTCPeerConnection,
    })),
  ).toEqual({ webSocket: "undefined", peerConnection: "undefined" });

  await page.getByRole("button", { name: "Stop local play" }).click();
  await expect(page.getByRole("heading", { name: "Play right here on your phone." })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayTrackStopCount"))))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayWakeReleaseCount"))))
    .toBeGreaterThan(0);
});

test("actionable game messages stay high and behind body-control buttons", async ({ page }) => {
  await page.goto("/");
  const layouts = await page.evaluate(() => {
    const controls = document.createElement("fieldset");
    controls.className = "pose-control-targets";
    document.body.append(controls);
    return ["bubbles-round-message", "racing-round-message"].map((className) => {
      const panel = document.createElement("section");
      panel.className = className;
      panel.textContent = "Ready";
      document.body.append(panel);
      const panelStyle = getComputedStyle(panel);
      const result = {
        className,
        top: panel.getBoundingClientRect().top,
        panelZIndex: Number(panelStyle.zIndex),
        controlsZIndex: Number(getComputedStyle(controls).zIndex),
      };
      panel.remove();
      return result;
    });
  });

  for (const layout of layouts) {
    expect(layout.top).toBeLessThan(80);
    expect(layout.panelZIndex).toBeLessThan(layout.controlsZIndex);
  }
});

test("production Racing chunk stays lazy and boots one forced Canvas runtime", async ({ page }) => {
  const racingAsset = (await readdir("dist/assets")).find((name) =>
    /^racing-runtime-.*\.js$/u.test(name),
  );
  expect(racingAsset).toBeDefined();
  await page.goto("/");
  const initiallyLoaded = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map(({ name }) => name)
      .some((name) => name.includes("racing-runtime")),
  );
  expect(initiallyLoaded).toBe(false);

  const result = await page.evaluate(async (assetUrl) => {
    const racingModule = (await import(assetUrl)) as unknown as {
      RacingRuntime: new (options: {
        parent: HTMLElement;
        session: {
          tick: (nowMs: number) => unknown;
          setSystemPaused: (paused: boolean, nowMs: number) => unknown;
        };
        playerCount: 1 | 2;
        onReady: () => void;
        onSnapshot: (snapshot: unknown) => void;
        onError: (message: string) => void;
      }) => { destroy: () => void };
    };
    const host = document.createElement("div");
    Object.assign(host.style, { position: "fixed", inset: "0", width: "960px", height: "540px" });
    document.body.replaceChildren(host);
    const snapshot = {
      enabled: true,
      playerCount: 2,
      phase: "racing",
      paused: false,
      orientationPaused: false,
      systemPaused: false,
      readyToStart: true,
      visibleDrivers: 2,
      leanReadyDrivers: 2,
      calibrationPurpose: null,
      startingRemainingMs: 0,
      elapsedMs: 1_230,
      trackLength: 3_024,
      cars: [
        {
          slot: "left",
          distance: 163,
          lateral: -0.15,
          speed: 34,
          steering: -0.2,
          trackingAvailable: true,
          progress: 163 / 3_024,
          finishedAtMs: null,
        },
        {
          slot: "right",
          distance: 175,
          lateral: 0.2,
          speed: 36,
          steering: 0.25,
          trackingAvailable: true,
          progress: 175 / 3_024,
          finishedAtMs: null,
        },
      ],
      result: null,
    };
    let ready = false;
    let runtimeError: string | null = null;
    let snapshotCount = 0;
    const session = {
      tick: () => snapshot,
      setSystemPaused: () => snapshot,
    };
    const runtime = new racingModule.RacingRuntime({
      parent: host,
      session,
      playerCount: 2,
      onReady: () => {
        ready = true;
      },
      onSnapshot: () => {
        snapshotCount += 1;
      },
      onError: (message) => {
        runtimeError = message;
      },
    });
    for (let attempt = 0; attempt < 200 && !ready && runtimeError === null; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    }
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    const canvas = host.querySelector("canvas");
    const mountedCanvasCount = host.querySelectorAll("canvas").length;
    const context = canvas?.getContext("2d") ?? null;
    const hasCanvas2d = context !== null;
    const centerPixelAlpha =
      context === null || canvas === null
        ? 0
        : context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1)
            .data[3];
    const bottomRoadPixel =
      context === null || canvas === null
        ? [0, 0, 0, 0]
        : Array.from(
            context.getImageData(Math.floor(canvas.width / 4), canvas.height - 2, 1, 1).data,
          );
    runtime.destroy();
    for (let attempt = 0; attempt < 10 && host.querySelector("canvas") !== null; attempt += 1) {
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(undefined)));
    }
    return {
      ready,
      runtimeError,
      snapshotCount,
      mountedCanvasCount,
      hasCanvas2d,
      centerPixelAlpha,
      bottomRoadPixel,
      remainingCanvasCount: host.querySelectorAll("canvas").length,
    };
  }, `/assets/${racingAsset}`);

  expect(result).toMatchObject({
    ready: true,
    runtimeError: null,
    mountedCanvasCount: 1,
    hasCanvas2d: true,
    remainingCanvasCount: 0,
  });
  expect(result.snapshotCount).toBeGreaterThan(0);
  expect(result.centerPixelAlpha).toBeGreaterThan(0);
  expect(result.bottomRoadPixel[3]).toBeGreaterThan(0);
  expect(result.bottomRoadPixel.slice(0, 3)).not.toEqual([23, 37, 84]);
});

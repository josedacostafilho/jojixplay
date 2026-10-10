import { expect, test } from "@playwright/test";

test("requires landscape before exposing camera activation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vire o celular" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Ligar a câmera" })).toBeVisible();
});

test("phone play reaches a real local pose packet with a fullscreen menu camera and no peer transport", async ({
  page,
}) => {
  const textureRequests: string[] = [];
  // Anything the page's own security policy refuses, such as a model's textures.
  const refused: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /Content Security Policy|GLTFLoader/.test(message.text()))
      refused.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.endsWith(".glb")) textureRequests.push(request.url());
  });
  // This journey starts two real GPU sessions, each with bounded model warm-up.
  test.setTimeout(120_000);
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
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Prepare a brincadeira" })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0);
  await expect(page.getByLabel("TV pairing key")).toHaveCount(0);
  await expect(page.getByLabel(/camera preview/i)).toHaveCount(0);
  const captureSource = page.locator("video.camera-backdrop");
  await expect(captureSource).toHaveAttribute("aria-hidden", "true");
  await expect(captureSource).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  // The adult's last touch step: the camera's picture, the phone's cameras by name, and no menu.
  await expect(page.getByRole("button", { name: "Câmera 1" })).toHaveAttribute(
    "aria-pressed",
    "true",
    { timeout: 30_000 },
  );
  await expect(captureSource).toHaveCSS("opacity", "1");
  await expect(page.getByRole("button", { name: "Encerrar brincadeira" })).toHaveCount(0);
  await page.getByRole("button", { name: "Começar" }).click();
  await expect(page.getByRole("button", { name: "Encerrar brincadeira" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(captureSource).toHaveCSS("opacity", "1");
  await expect(page.locator(".menu-diagnostic")).toContainText(/ms desde a captura/, {
    timeout: 30_000,
  });
  // The test camera shows no person, so the body-anchored menu has nothing to hang on and its
  // objects stay hidden; this journey activates them directly.
  await expect(page.getByRole("button", { name: "Jogar Desenhar" })).toBeHidden();
  const choose = (name: string) =>
    page.getByRole("button", { name, includeHidden: true }).dispatchEvent("click");
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__jojixplayFullscreenRequested")))
    .toBe(true);
  expect(
    await page.evaluate(() => ({
      webSocket: typeof window.WebSocket,
      peerConnection: typeof window.RTCPeerConnection,
    })),
  ).toEqual({ webSocket: "undefined", peerConnection: "undefined" });

  await choose("Jogar Desenhar");
  await choose("1 pessoa");
  await expect(page.getByRole("heading", { name: "Desenhar", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByText("Suas cores", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await page.getByRole("button", { name: "Sair e apagar" }).click();
  await choose("Jogar Desenhar");
  await choose("2 pessoas");
  await expect(page.getByText("Lado esquerdo", { exact: true })).toBeVisible();
  await expect(page.getByText("Lado direito", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await page.getByRole("button", { name: "Sair e apagar" }).click();
  expect(textureRequests).toEqual([]);
  await choose("Próximo jogo");
  await choose("Jogar Corrida dos Blocos");
  // The forest's models are read and first drawn by software here, beside the pose model.
  await expect(page.locator(".race-prompt")).toBeVisible({ timeout: 40_000 });
  await expect.poll(() => new Set(textureRequests).size).toBe(22);
  // The models' pictures are inside their files and are read through blob addresses.
  await expect(page.locator(".race-prompt")).not.toHaveText("Preparando a pista…", {
    timeout: 40_000,
  });
  expect(refused).toEqual([]);
  expect(textureRequests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(
    true,
  );

  await expect(captureSource).toHaveCSS("opacity", "0");
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.getByRole("button", { name: "Voltar", exact: true }).click();
  await page.getByRole("button", { name: "Encerrar brincadeira" }).click();
  await expect(page.getByRole("heading", { name: "Prepare a brincadeira" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayTrackStopCount"))))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayWakeReleaseCount"))))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await page.getByRole("button", { name: "Começar" }).click({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Encerrar brincadeira" })).toBeVisible();
  await choose("Próximo jogo");
  await choose("Jogar Corrida dos Blocos");
  await expect(page.locator(".race-prompt")).toBeVisible({ timeout: 40_000 });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Vire o celular" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayTrackStopCount"))))
    .toBeGreaterThan(1);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayWakeReleaseCount"))))
    .toBeGreaterThan(1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Ligar a câmera" })).toBeVisible();
});

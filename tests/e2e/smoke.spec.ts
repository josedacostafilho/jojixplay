import { expect, test } from "@playwright/test";

test("requires landscape before exposing camera activation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vire o celular" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Vamos começar" })).toBeVisible();
});

test("phone play reaches a real local pose packet without preview or peer transport", async ({
  page,
}) => {
  // This journey starts two real GPU sessions, each with bounded model warm-up.
  test.setTimeout(90_000);
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

  await expect(page.getByRole("heading", { name: "Preparar… brincar!" })).toBeVisible();
  await expect(page.getByRole("img", { name: /QR code/i })).toHaveCount(0);
  await expect(page.getByLabel("TV pairing key")).toHaveCount(0);
  await expect(page.getByLabel(/camera preview/i)).toHaveCount(0);
  const captureSource = page.locator("video.local-camera-source");
  await expect(captureSource).toHaveAttribute("aria-hidden", "true");
  await expect(captureSource).toHaveCSS("opacity", "0");

  await page.getByRole("button", { name: "Vamos começar" }).click();
  await expect(page.getByRole("button", { name: "Encerrar o teste" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Para os adultos" }).click();
  await expect(page.locator(".diagnostic")).toContainText(/ms desde a captura/, {
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Fechar orientações" }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__jojixplayFullscreenRequested")))
    .toBe(true);
  expect(
    await page.evaluate(() => ({
      webSocket: typeof window.WebSocket,
      peerConnection: typeof window.RTCPeerConnection,
    })),
  ).toEqual({ webSocket: "undefined", peerConnection: "undefined" });

  await page.getByRole("button", { name: "✎ Desenhar sozinho" }).click();
  await expect(page.getByRole("heading", { name: "Desenhar", exact: true })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(page.getByText("Suas cores", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await page.getByRole("button", { name: "Sair e apagar" }).click();
  await page.getByRole("button", { name: "✎ Desenhar em dupla" }).click();
  await expect(page.getByText("Lado esquerdo", { exact: true })).toBeVisible();
  await expect(page.getByText("Lado direito", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "← Voltar" }).click();
  await page.getByRole("button", { name: "Sair e apagar" }).click();
  await page.getByRole("button", { name: "Encerrar o teste" }).click();
  await expect(page.getByRole("heading", { name: "Preparar… brincar!" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayTrackStopCount"))))
    .toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayWakeReleaseCount"))))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Vamos começar" }).click();
  await expect(page.getByRole("button", { name: "Encerrar o teste" })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Vire o celular" })).toBeVisible();
  await expect(page.locator("video")).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayTrackStopCount"))))
    .toBeGreaterThan(1);
  await expect
    .poll(() => page.evaluate(() => Number(Reflect.get(window, "__jojixplayWakeReleaseCount"))))
    .toBeGreaterThan(1);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole("button", { name: "Vamos começar" })).toBeVisible();
});

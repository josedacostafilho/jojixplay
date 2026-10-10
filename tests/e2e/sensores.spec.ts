import { expect, type Page, test } from "@playwright/test";

test("the bench runs real pose, hand and silhouette sensing in turn and hands bodies back to the menu", async ({
  page,
}) => {
  // Several real graphs are built in turn, each with bounded warm-up.
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: () => Promise.reject(new Error("Test viewport")),
    });
  });
  const models: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".task")) models.push(new URL(request.url()).pathname);
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await page.getByRole("button", { name: "Começar" }).click({ timeout: 30_000 });
  await expect(page.locator(".menu-diagnostic")).toContainText(/ms desde a captura/, {
    timeout: 30_000,
  });
  // The test camera shows no person, so the menu objects stay hidden and are activated directly.
  const choose = (name: string) =>
    page.getByRole("button", { name, includeHidden: true }).dispatchEvent("click");
  await choose("Próximo jogo");
  await choose("Próximo jogo");
  await choose("Jogar Sensores");

  const status = page.locator(".sense-status");
  const camera = page.locator("video.camera-backdrop");
  await expect(status).toContainText("0 pessoas");
  await expect(camera).toHaveCSS("opacity", "1");
  expect(models).toEqual([expect.stringContaining("pose_landmarker_full.task")]);

  await page.getByRole("button", { name: "Mãos" }).click();
  await expect(status).toContainText(/0 mãos · \d+ leituras?\/s/, { timeout: 60_000 });
  expect(models.at(-1)).toContain("hand-landmarker-float16-1/hand_landmarker.task");

  // The pose model again, this time with its mask read from the GPU.
  await page.getByRole("button", { name: "Silhueta", exact: true }).click();
  await expect(status).toContainText(/silhueta em \d+% da imagem · \d+ leituras?\/s/, {
    timeout: 60_000,
  });
  await expect(page.locator("canvas.sense-silhouette")).toHaveCount(1);

  await page.getByRole("button", { name: "Ver fundo" }).click();
  await expect(camera).toHaveCSS("opacity", "0");
  await expect(page.getByRole("button", { name: "Ver câmera" })).toBeVisible();

  await page.getByRole("button", { name: "Voltar" }).click();
  await expect(camera).toHaveCSS("opacity", "1");
  // No game opens until the pose model is back; the bench then reads bodies at once.
  await expect(
    page.getByRole("button", { name: "Jogar Desenhar", includeHidden: true }),
  ).toBeEnabled({ timeout: 60_000 });
  await choose("Próximo jogo");
  await choose("Próximo jogo");
  await choose("Jogar Sensores");
  await expect(status).toContainText("0 pessoas", { timeout: 30_000 });
});

/** Puts the synthetic index fingertip at a viewport position, whatever the camera crop. */
async function pointAt(page: Page, x: number, y: number) {
  await page.evaluate(
    ([x, y]) => {
      const video = document.querySelector("video");
      if (!video?.videoWidth) throw new Error("Missing capture");
      const scale = Math.max(innerWidth / video.videoWidth, innerHeight / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      Reflect.set(window, "testTip", {
        x: 1 - (x - (innerWidth - width) / 2) / width,
        y: (y - (innerHeight - height) / 2) / height,
      });
    },
    [x, y] as const,
  );
}

test("the bench draws what is sensed and is operated by movement in body, hand and silhouette modes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: () => Promise.reject(new Error("Test viewport")),
    });
    Reflect.set(window, "testTip", { x: 0.5, y: 0.8 });
    class SyntheticWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      sensing = "body";
      postMessage(request: {
        type: string;
        frame?: ImageBitmap;
        poseLimit?: number;
        sensing?: string;
        sequence?: number;
        capturedAtMs?: number;
        cameraFrame?: unknown;
      }) {
        let response: unknown;
        if (request.type === "initialize") {
          // Each kind of sensing runs in its own worker.
          this.sensing = request.sensing ?? "body";
          response = { type: "ready" };
        } else if (request.type === "set-pose-limit")
          response = { type: "pose-limit-set", poseLimit: request.poseLimit };
        else if (request.type === "reset-tracking") response = { type: "tracking-reset" };
        else {
          request.frame?.close();
          const tip: { x: number; y: number } = Reflect.get(window, "testTip");
          const header = {
            sequence: request.sequence,
            capturedAtMs: request.capturedAtMs,
            frame: request.cameraFrame,
          };
          // A silhouette is a blob around the same point, on a 64 by 36 grid.
          const alpha = new Uint8Array(64 * 36);
          for (let row = 0; row < 36; row += 1)
            for (let column = 0; column < 64; column += 1)
              if (
                Math.hypot(
                  ((column + 0.5) / 64 - tip.x) / 0.05,
                  ((row + 0.5) / 36 - tip.y) / 0.08,
                ) < 1
              )
                alpha[row * 64 + column] = 255;
          response = {
            type: "result",
            packet: this.sensing.startsWith("silhouette")
              ? { ...header, poses: [], silhouette: { width: 64, height: 36, alpha } }
              : this.sensing === "hands"
                ? {
                    ...header,
                    hands: [
                      {
                        label: "right",
                        score: 0.9,
                        landmarks: Array.from({ length: 21 }, (_, i) => ({
                          x: tip.x + (8 - i) * 0.004,
                          y: tip.y + (i === 8 ? 0 : 0.06),
                          z: 0,
                        })),
                      },
                    ],
                  }
                : {
                    ...header,
                    poses: [
                      {
                        landmarks: Array.from({ length: 33 }, (_, i) => ({
                          x: i === 20 ? tip.x : i === 11 ? 0.55 : 0.45,
                          y: i === 20 ? tip.y : 0.5,
                          z: 0,
                          visibility: [11, 12, 20].includes(i) ? 1 : 0,
                        })),
                        world: Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 })),
                      },
                    ],
                  },
          };
        }
        setTimeout(() => this.onmessage?.({ data: response }), 0);
      }
      terminate() {
        this.onmessage = null;
      }
    }
    Object.defineProperty(window, "Worker", { value: SyntheticWorker });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Ligar a câmera" }).click();
  await page.getByRole("button", { name: "Começar" }).click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Próximo jogo" }).click();
  await page.getByRole("button", { name: "Próximo jogo" }).click();
  await page.getByRole("button", { name: "Jogar Sensores" }).click();

  // From here on only the synthetic fingertip moves; nothing is clicked.
  async function hold(name: string) {
    await pointAt(page, 422, 300);
    await expect(page.locator(".movement-pointer:visible")).toHaveCount(0);
    const box = await page.getByRole("button", { name, exact: true }).boundingBox();
    if (!box) throw new Error(`Missing ${name}`);
    await pointAt(page, box.x + box.width / 2, box.y + box.height / 2);
  }
  const status = page.locator(".sense-status");
  const dots = page.locator(".sense-dots circle");
  await expect(status).toContainText("1 pessoa ·");
  await expect(page.locator("video.camera-backdrop")).toHaveCSS("opacity", "1");
  // Both shoulders and the fingertip, each exactly where the mirrored camera image shows it.
  await expect(dots).toHaveCount(3);
  await pointAt(page, 600, 200);
  await expect(page.locator('.sense-dots circle[data-side="right"]').last()).toHaveAttribute(
    "cx",
    "600.0",
  );
  await expect(page.locator('.sense-dots circle[data-side="right"]').last()).toHaveAttribute(
    "cy",
    "200.0",
  );

  // The same readings in the person's own space: three views of the same three joints.
  await hold("Corpo 3D");
  await expect(page.getByRole("button", { name: "Corpo 3D" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dots).toHaveCount(9);
  await expect(page.locator(".sense-labels text").first()).toHaveText("De frente");

  await hold("Mãos");
  await expect(page.getByRole("button", { name: "Mãos" })).toHaveAttribute("aria-pressed", "true");
  await expect(status).toContainText("1 mão ·");
  await expect(dots).toHaveCount(21);
  await expect(page.locator(".sense-labels text")).toHaveText("Direita");

  await hold("Ver fundo");
  await expect(page.locator("video.camera-backdrop")).toHaveCSS("opacity", "0");
  await expect(dots).toHaveCount(21);

  // A silhouette has no fingertip: it presses a button by covering it.
  await hold("Silhueta");
  await expect(status).toContainText(/silhueta em [1-9]\d*% da imagem/);
  await expect(dots).toHaveCount(0);
  await expect(page.locator("canvas.sense-silhouette")).toHaveCount(1);

  await hold("Voltar");
  await expect(page.getByRole("button", { name: "Jogar Desenhar" })).toBeVisible();
  await expect(page.locator(".sense-game")).toHaveCount(0);
});

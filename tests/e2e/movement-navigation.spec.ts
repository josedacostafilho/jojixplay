import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 320 },
]) {
  test(`every post-setup action works with movement alone at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    await page.addInitScript(() => {
      Object.defineProperty(Element.prototype, "requestFullscreen", {
        value: () => Promise.reject(new Error("Test viewport")),
      });
      Reflect.set(window, "testWrist", { x: 0.5, y: 0.5 });
      Reflect.set(window, "testLost", false);
      Reflect.set(window, "testHandsOnly", true);
      class SyntheticWorker {
        onmessage: ((event: { data: unknown }) => void) | null = null;
        postMessage(request: {
          type: string;
          frame?: ImageBitmap;
          poseLimit?: number;
          sequence?: number;
          capturedAtMs?: number;
          cameraFrame?: unknown;
        }) {
          let response: unknown;
          if (request.type === "initialize") response = { type: "ready" };
          else if (request.type === "set-pose-limit")
            response = { type: "pose-limit-set", poseLimit: request.poseLimit };
          else if (request.type === "reset-tracking") response = { type: "tracking-reset" };
          else {
            request.frame?.close();
            const wrist: { x: number; y: number } = Reflect.get(window, "testWrist");
            response = {
              type: "result",
              packet: {
                sequence: request.sequence,
                capturedAtMs: request.capturedAtMs,
                frame: request.cameraFrame,
                poses: Reflect.get(window, "testLost")
                  ? []
                  : [
                      {
                        landmarks: Array.from({ length: 33 }, (_, i) => ({
                          x: i === 16 ? 1 - wrist.x : i === 11 ? 0.7 : i === 12 ? 0.8 : 0.6,
                          y: i === 16 ? wrist.y : i === 15 ? 0.7 : 0.4,
                          z: 0,
                          visibility: (Reflect.get(window, "testHandsOnly")
                            ? [15, 16]
                            : [11, 12, 15, 16]
                          ).includes(i)
                            ? 1
                            : 0,
                        })),
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
    await page.getByRole("button", { name: "Vamos começar" }).click();
    await expect(page.getByRole("button", { name: "Desenhar · 1 ou 2 pessoas" })).toBeVisible();
    await expect(page.locator(".movement-pointer").first()).toBeVisible();
    await expect(page.locator(".movement-pointer").first()).toHaveText("");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator(".camera-backdrop")).toHaveCSS("opacity", "1");
    await expect(page.getByText("Em breve", { exact: true })).toHaveCount(2);
    expect(await page.locator(".game-card--soon button").count()).toBe(0);
    const cameraBounds = await page.locator("video").boundingBox();
    expect(cameraBounds?.x).toBeLessThanOrEqual(0);
    expect(cameraBounds?.y).toBeLessThanOrEqual(0);
    expect(cameraBounds?.width).toBeGreaterThanOrEqual(viewport.width);
    expect(cameraBounds?.height).toBeGreaterThanOrEqual(viewport.height);

    // All further selections change only synthetic camera joints, never click/tap.
    async function select(name: string) {
      const neutral = await page.evaluate(() => {
        const paper = document.querySelector(".draw-paper")?.getBoundingClientRect();
        const video = document.querySelector("video");
        if (!video) throw new Error("Missing capture");
        const aspect = video.videoWidth / video.videoHeight;
        const width = paper
          ? Math.min(paper.width, paper.height * aspect)
          : Math.max(innerWidth, innerHeight * aspect);
        const height = width / aspect;
        const left = paper ? paper.left + (paper.width - width) / 2 : (innerWidth - width) / 2;
        const top = paper ? paper.top + (paper.height - height) / 2 : (innerHeight - height) / 2;
        for (const y of [0.4, 0.3, 0.5, 0.6])
          for (const x of [0.5, 0.4, 0.6, 0.3]) {
            if (!document.elementFromPoint(left + x * width, top + y * height)?.closest("button")) {
              Reflect.set(window, "testWrist", { x, y: y + (paper ? 0 : 0.035) });
              return { x: left + x * width, y: top + y * height };
            }
          }
        throw new Error("No reachable neutral area");
      });
      await expect
        .poll(() =>
          page.evaluate(
            ({ x, y }) =>
              [...document.querySelectorAll<HTMLElement>(".movement-pointer")].some(
                (pointer) =>
                  Math.abs(parseFloat(pointer.style.left) - x) < 1 &&
                  Math.abs(parseFloat(pointer.style.top) - y) < 1,
              ),
            neutral,
          ),
        )
        .toBe(true);
      const point = await page.getByRole("button", { name, exact: true }).evaluate((button) => {
        Reflect.set(window, "testSelected", false);
        button.addEventListener("click", () => Reflect.set(window, "testSelected", true), {
          once: true,
        });
        const b = button.getBoundingClientRect();
        const paper = document.querySelector(".draw-paper")?.getBoundingClientRect();
        const video = document.querySelector("video");
        if (!video) throw new Error("Missing capture");
        const aspect = video.videoWidth / video.videoHeight;
        const width = paper
          ? Math.min(paper.width, paper.height * aspect)
          : Math.max(innerWidth, innerHeight * aspect);
        const height = width / aspect;
        const left = paper ? paper.left + (paper.width - width) / 2 : (innerWidth - width) / 2;
        const top = paper ? paper.top + (paper.height - height) / 2 : (innerHeight - height) / 2;
        return {
          x: (b.x + b.width / 2 - left) / width,
          y: (b.y + b.height / 2 - top) / height + (paper ? 0 : 0.035),
        };
      });
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(1);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(1);
      await page.evaluate((point) => Reflect.set(window, "testWrist", point), point);
      await expect
        .poll(() => page.evaluate(() => Reflect.get(window, "testSelected")), { timeout: 10000 })
        .toBe(true);
    }
    await select("Para os adultos");
    await expect(page.getByRole("heading", { name: "Uma ajudinha sua" })).toBeVisible();
    await select("↓ Ler mais");
    await select("↑ Subir");
    await select("Fechar orientações");
    await expect(page.getByRole("heading", { name: "Uma ajudinha sua" })).not.toBeVisible();
    await select("Desenhar · 1 ou 2 pessoas");
    await expect(page.getByRole("heading", { name: "Quem vai brincar?" })).toBeVisible();
    await select("← Todos os jogos");
    await expect(page.getByRole("heading", { name: "Vamos brincar?" })).toBeVisible();
    await select("Desenhar · 1 ou 2 pessoas");
    await page.evaluate(() => Reflect.set(window, "testHandsOnly", false));
    await select("Desenhar sozinho");
    await expect(page.locator("video")).toHaveCSS("opacity", "0");
    await expect(page.getByText("Suas cores", { exact: true })).toBeVisible();
    await select("Verde");
    await expect(page.getByRole("button", { name: "Verde", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await select("Pincel fino");
    await expect(page.getByRole("button", { name: "Pincel grosso", exact: true })).toBeVisible();
    await select("Pincel grosso");
    await select("Desfazer");
    await select("Nova folha");
    await expect(page.getByRole("dialog")).toBeVisible();
    await select("Continuar desenhando");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await select("Nova folha");
    await select("Apagar desenho");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await select("← Voltar");
    await select("Continuar desenhando");
    await expect(page.getByText("Suas cores", { exact: true })).toBeVisible();
    await select("← Voltar");
    await select("Sair e apagar");
    await expect(page.locator("video")).toHaveCSS("opacity", "1");
    await expect(page.locator(".movement-pointer").first()).toBeVisible();
    await select("Desenhar · 1 ou 2 pessoas");
    await select("Desenhar em dupla");
    await expect(page.getByText("Lado esquerdo", { exact: true })).toBeVisible();
    await select("Verde · esquerda");
    await expect(
      page.getByRole("button", { name: "Verde · esquerda", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await select("← Voltar");
    await select("Sair e apagar");
    await select("Encerrar brincadeira");
    await expect(page.getByRole("button", { name: "Vamos começar" })).toBeVisible();
  });
}

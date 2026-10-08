import { expect, test } from "@playwright/test";

test("independent swing studio starts, fires a building web and releases it", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4177");
  await expect(page.locator("canvas")).toBeVisible();
  const canvas = await page.locator("canvas").boundingBox();
  expect(canvas?.width).toBeGreaterThanOrEqual(844);
  expect(canvas?.height).toBeGreaterThanOrEqual(390);
  await expect(page.locator("#status")).toContainText("Pronto para começar");
  await page.screenshot({ path: info.outputPath("swinging-roof.png") });
  await page.getByRole("button", { name: /Começar/ }).click();
  await expect(page.locator("#status")).toContainText("No ar");
  await page.locator("#right-x").fill("0.73");
  await page.locator("#right-y").fill("0.4");
  await page.keyboard.down("d");
  await expect(page.getByRole("button", { name: /Punho direito/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#status")).toContainText("D presa", { timeout: 5000 });
  await page.screenshot({ path: info.outputPath("swinging-web.png") });
  await page.keyboard.up("d");
  await expect(page.locator("#status")).toContainText("D solta");
  await page.getByRole("button", { name: /Punho direito/ }).focus();
  await page.keyboard.down("Space");
  await expect(page.getByRole("button", { name: /Punho direito/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.up("Space");
  await expect(page.getByRole("button", { name: /Punho direito/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(errors).toEqual([]);
});

test("hand-only host input calibrates, aims, fires a rotated fist and releases", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: () => Promise.reject(new Error("Test viewport")),
    });
    Reflect.set(window, "closedFist", false);
    Reflect.set(window, "reverseHands", false);
    Reflect.set(window, "handY", 0.418);
    class HandWorker {
      mode = "pose";
      onmessage: ((event: { data: unknown }) => void) | null = null;
      postMessage(request: {
        type: string;
        mode?: string;
        poseLimit?: number;
        frame?: ImageBitmap;
        sequence?: number;
        capturedAtMs?: number;
        cameraFrame?: unknown;
      }) {
        let data: unknown;
        if (request.type === "initialize") {
          this.mode = request.mode ?? "pose";
          data = { type: "ready" };
        } else if (request.type === "set-pose-limit")
          data = { type: "pose-limit-set", poseLimit: request.poseLimit };
        else if (request.type === "reset-tracking") data = { type: "tracking-reset" };
        else {
          request.frame?.close();
          const hands = [0.7, 0.17].map((x) => {
            const closed = x < 0.5 && Boolean(Reflect.get(window, "closedFist"));
            const world = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
            for (let finger = 0; finger < 5; finger++) {
              for (let joint = 0; joint < 4; joint++) {
                // Sideways hand: finger extension runs horizontally, curl still bends in depth.
                world[1 + finger * 4 + joint] = {
                  x: 0.04 + (closed && joint > 1 ? (3 - joint) * 0.018 : joint * 0.02),
                  y: (finger - 2) * 0.018,
                  z: closed && joint > 1 ? -(joint - 1) * 0.015 : 0,
                };
              }
            }
            return {
              handedness: x > 0.5 ? "left" : "right",
              handednessScore: 0.9,
              worldLandmarks: world,
              landmarks: world.map((p) => ({
                x: x + p.x,
                y: Number(Reflect.get(window, "handY")) + p.y,
                z: p.z,
              })),
            };
          });
          if (Reflect.get(window, "reverseHands")) hands.reverse();
          data = {
            type: "result",
            packet: {
              sequence: request.sequence,
              // Delayed inference must still reach the game as a newly delivered result.
              capturedAtMs: Math.max(
                0,
                (request.capturedAtMs ?? 0) - (this.mode === "hands" ? 500 : 0),
              ),
              frame: request.cameraFrame,
              poses: [],
              ...(this.mode === "hands" ? { hands } : {}),
            },
          };
        }
        setTimeout(() => this.onmessage?.({ data }), 0);
      }
      terminate() {
        this.onmessage = null;
      }
    }
    Object.defineProperty(window, "Worker", { value: HandWorker });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Vamos começar" }).click();
  await page.getByRole("button", { name: "Protótipo de teias · 1 pessoa" }).click();
  await expect(page.getByRole("heading", { name: "Mostre as mãos abertas" })).toBeVisible();
  await expect(page.locator(".swing-crosshair:visible")).toHaveCount(2);
  const rightAim = page.locator(".swing-crosshair").filter({ hasText: "D" });
  await expect.poll(() => rightAim.evaluate((el) => parseFloat(el.style.left))).toBeCloseTo(73);
  await expect.poll(() => rightAim.evaluate((el) => parseFloat(el.style.top))).toBeCloseTo(40);
  await page.screenshot({ path: info.outputPath("hand-calibration.png") });
  await expect(page.locator(".swing-hud")).toContainText("Direita livre");
  await expect(page.locator(".game-stage button:visible")).toHaveCount(0);
  await expect(page.locator(".movement-pointer")).toHaveCount(0);
  await expect(page.locator(".swing-crosshair").filter({ hasText: "D" })).toHaveAttribute(
    "data-state",
    "target",
  );
  await page.evaluate(() => Reflect.set(window, "closedFist", true));
  await expect(page.locator(".swing-hud")).toContainText("Teia direita presa");
  await page.evaluate(() => Reflect.set(window, "reverseHands", true));
  await expect(page.locator(".swing-crosshair").filter({ hasText: "D" })).toHaveAttribute(
    "data-state",
    "held",
  );
  await page.screenshot({ path: info.outputPath("hand-shot.png") });
  await page.evaluate(() => Reflect.set(window, "closedFist", false));
  await expect(page.locator(".swing-hud")).toContainText("Direita livre");
  await page.evaluate(() => Reflect.set(window, "handY", 0.01));
  await expect(page.locator(".swing-crosshair:visible")).toHaveCount(2);
  await expect.poll(() => rightAim.evaluate((el) => parseFloat(el.style.top))).toBeCloseTo(5.8);
  await page.screenshot({ path: info.outputPath("hand-edge.png") });
  await expect(page.locator(".game-stage button:visible")).toHaveCount(0);
  await expect(page.locator(".movement-pointer")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Vamos de novo?" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("button", { name: "Recomeçar ↻" })).toBeVisible();
  await expect(page.getByRole("button", { name: "? Como jogar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Voltar" })).toBeVisible();
  await expect(page.locator(".swing-game .movement-pointer:visible")).toHaveCount(2);
  await page.getByRole("button", { name: "Recomeçar ↻" }).click();
  await expect(page.getByRole("heading", { name: "Mostre as mãos abertas" })).toBeVisible();
  await expect(page.getByRole("button", { name: "← Voltar" })).toBeVisible();
  await page.getByRole("button", { name: "? Como jogar" }).click();
  await expect(page.getByRole("heading", { name: "Balance com as teias" })).toBeVisible();
  await expect(page.locator(".swing-crosshair:visible")).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const world = document.querySelector(".swing-world")?.getBoundingClientRect();
        if (!world) return false;
        const pointers = [
          ...document.querySelectorAll<HTMLElement>(".swing-game .movement-pointer"),
        ];
        return [...document.querySelectorAll<HTMLElement>(".swing-crosshair")].every((aim) =>
          pointers.some(
            (pointer) =>
              Math.abs(
                parseFloat(pointer.style.left) -
                  (world.left + (parseFloat(aim.style.left) * world.width) / 100),
              ) < 1 &&
              Math.abs(
                parseFloat(pointer.style.top) -
                  (world.top + (parseFloat(aim.style.top) * world.height) / 100),
              ) < 1,
          ),
        );
      }),
    )
    .toBe(true);
});

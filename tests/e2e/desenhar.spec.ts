import { expect, test } from "@playwright/test";

test("independent Desenhar paints, preserves art through tracking loss and clears only after confirmation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:4175");
  await page.locator("#lost").check();
  await expect(page.getByRole("status")).toHaveText("Dê um tchauzinho para o celular.");
  const paper = await page.locator(".draw-paper").boundingBox();
  if (!paper) throw new Error("Missing drawing surface");
  const capture = () =>
    page.screenshot({
      clip: { x: paper.x + 130, y: paper.y + 50, width: paper.width - 260, height: 100 },
    });
  const blank = await capture();
  await page.locator("#lost").uncheck();
  await page.mouse.move(320, 150);
  await page.locator("#paint").check();
  for (let i = 0; i < 20; i++) {
    await page.mouse.move(330 + i * 8, 150 + Math.sin(i / 4) * 30);
    await page.waitForTimeout(40);
  }
  await page.locator("#lost").check();
  await expect(page.getByRole("status")).toHaveText("Dê um tchauzinho para o celular.");
  const painted = await capture();
  expect(painted.equals(blank)).toBe(false);
  await page.getByRole("button", { name: "Nova folha" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Continuar desenhando" }).click();
  expect((await capture()).equals(painted)).toBe(true);
  await page.getByRole("button", { name: "Nova folha" }).click();
  await page.getByRole("button", { name: "Apagar desenho" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect((await capture()).equals(blank)).toBe(true);
  await page.locator("#lost").uncheck();
  await page.locator("#paint").uncheck();
  await page.mouse.move(420, 150);
  // Invert the game's aspect-preserving projection for the synthetic wrist driver.
  const hoverPoint = await page
    .getByRole("button", { name: "Verde", exact: true })
    .evaluate((button) => {
      const canvas = document.querySelector("canvas");
      const stage = document.querySelector("main");
      if (!canvas || !stage) throw new Error("Missing scene");
      const r = canvas.getBoundingClientRect(),
        s = stage.getBoundingClientRect(),
        b = button.getBoundingClientRect();
      const aspect = 16 / 9,
        halfHeight = Math.max(1, aspect / (r.width / r.height));
      const x =
        0.5 +
        (((b.x + b.width / 2 - r.x) / r.width - 0.5) * halfHeight * (r.width / r.height)) / aspect;
      const y = 0.5 + ((b.y + b.height / 2 - r.y) / r.height - 0.5) * halfHeight;
      return { x: s.x + x * s.width, y: s.y + y * s.height };
    });
  await page.waitForTimeout(100);
  await page.mouse.move(hoverPoint.x, hoverPoint.y);
  await expect(page.getByRole("button", { name: "Verde", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#lost").check();
  await page.locator("#players").selectOption("2");
  await expect(page.getByText("Lado esquerdo", { exact: true })).toBeVisible();
  await expect(page.getByText("Lado direito", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Verde · esquerda" }).click();
  await expect(page.getByRole("button", { name: "Verde · esquerda" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Azul · direita" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(errors).toEqual([]);
});

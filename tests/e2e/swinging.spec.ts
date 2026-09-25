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
  await page.keyboard.down("d");
  await expect(page.getByRole("button", { name: /Braço direito/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#status")).toContainText("D presa", { timeout: 5000 });
  await page.screenshot({ path: info.outputPath("swinging-web.png") });
  await page.keyboard.up("d");
  await expect(page.locator("#status")).toContainText("D solta");
  await page.getByRole("button", { name: /Braço direito/ }).focus();
  await page.keyboard.down("Space");
  await expect(page.getByRole("button", { name: /Braço direito/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.up("Space");
  await expect(page.getByRole("button", { name: /Braço direito/ })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(errors).toEqual([]);
});

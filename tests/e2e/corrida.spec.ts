import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 320 },
]) {
  test(`Corrida studio: the character starts where the player stands and follows steps, crouches, jumps, punches and losses at ${viewport.width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:4176");
    const stage = await page.locator("main").boundingBox();
    if (!stage) throw new Error("Missing stage");
    const across = (share: number) =>
      page.mouse.move(stage.x + stage.width * share, stage.y + stage.height / 2, { steps: 6 });
    const prompt = page.locator(".race-prompt");
    const reading = page.locator(".race-reading");

    // Far to one side there is no room for three lanes: the run waits.
    await across(0.92);
    await expect(prompt).toHaveText("Venha para o meio");
    await expect(reading).toHaveCount(0);
    await across(0.5);
    await expect(reading).toContainText("faixa meio", { timeout: 10_000 });
    // While running the road is clear of words.
    await expect(prompt).toHaveCount(0);
    await expect(page.locator(".race-game canvas")).toHaveCount(1);

    // The studio's person is about a tenth of the view wide; a lane is a little more than that.
    await across(0.36);
    await expect(reading).toContainText("faixa esquerda");
    await across(0.64);
    await expect(reading).toContainText("faixa direita");
    await across(0.5);
    await expect(reading).toContainText("faixa meio");

    await page.locator("#crouch").check();
    await expect(reading).toContainText("✓");
    await page.locator("#crouch").uncheck();
    await expect(reading).not.toContainText("✓");
    await page.locator("#jump").check();
    await expect(reading).toContainText(/pulo \d+% ✓/);
    await page.locator("#jump").uncheck();
    await expect(reading).toContainText("pulo 0%");
    // An arm thrown out at the camera is a punch by that arm.
    await page.locator("#punch").selectOption("right");
    await expect(reading).toContainText(/último D \+\d+% em \d+ ms/);
    await page.locator("#punch").selectOption("none");
    await expect(reading).not.toContainText("✓");
    // Leaning the torso is not a step.
    await page.locator("#lean").selectOption("1");
    await expect(reading).toContainText("faixa meio");
    await page.locator("#lean").selectOption("0");

    await page.locator("#lost").check();
    await expect(prompt).toContainText("Cadê você?");
    await page.locator("#lost").uncheck();
    await expect(prompt).toHaveCount(0);
    await expect(reading).toContainText("faixa meio");

    // Standing still in the middle, something soon runs into the character and costs a heart.
    await expect(page.locator(".race-heart--lost").first()).toBeVisible({ timeout: 40_000 });

    // The one button is not smaller than a hand can hold from across the room.
    const back = await page.getByRole("button", { name: "Voltar" }).boundingBox();
    expect(back?.height).toBeGreaterThanOrEqual(54);
    expect(errors).toEqual([]);
  });
}

test("the road waits for its pictures and says so when one cannot be loaded", async ({ page }) => {
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/assets/leaves-*.png", async (route) => {
    await pending;
    await route.fulfill({ status: 503, body: "Unavailable" });
  });
  // The page's own load waits for the held picture, so it is not waited for.
  await page.goto("http://127.0.0.1:4176", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("status")).toHaveText("Preparando a pista…");
  release();
  await expect(page.getByRole("alert")).toContainText("Volte ao menu");
  await expect(page.locator(".race-world")).toBeHidden();
  await expect(page.getByRole("button", { name: "Voltar" })).toBeVisible();
});

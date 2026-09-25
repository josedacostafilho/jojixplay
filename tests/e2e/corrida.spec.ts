import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 844, height: 390 },
  { width: 667, height: 320 },
]) {
  test(`Corrida studio: held crouch, camera feedback, score, loss, replay and help at ${viewport.width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(120000);
    await page.setViewportSize(viewport);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-09-25T12:00:00Z") });
    await page.clock.pauseAt(new Date("2026-09-25T12:00:01Z"));
    await page.goto("http://127.0.0.1:4176");
    await page.clock.runFor(600);
    await expect(page.getByRole("heading", { name: "Pronto para ir mais longe?" })).toBeVisible();
    const canvas = page.getByLabel("Pista de Corrida dos Blocos");
    const upright = await canvas.screenshot();
    const panel = await page.locator(".race-start").boundingBox();
    const footer = await page.locator(".race-route").boundingBox();
    expect(panel && footer && panel.y + panel.height < footer.y).toBe(true);
    await page.screenshot({ path: info.outputPath("ready.png") });
    await page.locator("#crouch").check();
    await page.clock.runFor(1200);
    expect((await canvas.screenshot()).equals(upright)).toBe(false);
    await expect(page.locator(".race-countdown")).toBeVisible();
    await page.locator("#crouch").uncheck();
    await page.clock.runFor(600);
    await expect(page.locator(".race-countdown")).toHaveCount(0);
    await page.locator("#crouch").check();
    await page.clock.runFor(3100);
    await page.locator("#crouch").uncheck();
    await page.clock.runFor(900);
    await expect(page.getByText("Bora pular!", { exact: true })).toBeVisible();
    const progress = page.getByRole("progressbar", { name: "Percurso" });
    while (Number(await progress.getAttribute("aria-valuenow")) < 6) await page.clock.runFor(100);
    await page.clock.runFor(500);
    await page.getByRole("button", { name: "Pular (Espaço)" }).click();
    await page.clock.runFor(1300);
    await expect(page.locator(".race-score strong")).toHaveText("100");
    await page.screenshot({ path: info.outputPath("jump-success.png") });
    await page.locator("#lost").check();
    await page.clock.runFor(500);
    const beforeLoss = await progress.getAttribute("aria-valuenow");
    await page.clock.runFor(1500);
    expect(await progress.getAttribute("aria-valuenow")).toBe(beforeLoss);
    await expect(page.getByText("Cadê você?", { exact: true })).toBeVisible();
    await page.locator("#lost").uncheck();
    await page.clock.runFor(1200);
    await page.getByRole("button", { name: "? Como jogar" }).click();
    await page.clock.runFor(100);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({ path: info.outputPath("help.png") });
    const paused = await progress.getAttribute("aria-valuenow");
    await page.clock.runFor(1500);
    expect(await progress.getAttribute("aria-valuenow")).toBe(paused);
    await page.getByRole("button", { name: "Vamos nessa →" }).click();
    await page.clock.runFor(1000);
    await page.clock.runFor(19000);
    await expect(page.getByRole("heading", { name: "Valeu a aventura!" })).toBeVisible();
    await expect(page.getByRole("img", { name: "0 vidas" })).toBeVisible();
    await page.screenshot({ path: info.outputPath("result.png") });
    await page.getByRole("button", { name: "Correr de novo ↻" }).click();
    await page.clock.runFor(200);
    await expect(page.getByRole("img", { name: "3 vidas" })).toBeVisible();
    await expect(page.locator(".race-score strong")).toHaveText("0");
    await expect(page.getByRole("heading", { name: "Pronto para ir mais longe?" })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("approaching pose wall carries the live skeleton and turns green only for the matching arms", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.clock.install({ time: new Date("2026-09-25T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-09-25T12:00:01Z"));
  await page.goto("http://127.0.0.1:4176");
  await page.clock.runFor(600);
  await page.locator("#crouch").check();
  await page.clock.runFor(3100);
  await page.locator("#crouch").uncheck();
  await page.clock.runFor(800);
  const progress = page.getByRole("progressbar", { name: "Percurso" });
  // The course is fixed; trigger each early jump using visible whole-second run time.
  for (let at = 7; at < 57; at += Math.max(4, 6 - at / 150)) {
    const target = Math.floor(at - 0.2);
    while (Number(await progress.getAttribute("aria-valuenow")) < target)
      await page.clock.runFor(100);
    await page.clock.runFor(400);
    await page.locator("#jump").click();
    await page.clock.runFor(1100);
  }
  while (Number(await progress.getAttribute("aria-valuenow")) < 65) await page.clock.runFor(100);
  await expect(page.getByRole("img", { name: "3 vidas" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("wall-unmatched.png") });
  const action = await page.locator(".race-action strong").textContent();
  const pose =
    action === "Braços para os lados"
      ? "asas"
      : action === "Faça uma estrela"
        ? "estrela"
        : action === "Mostre sua força"
          ? "forte"
          : "alto";
  await page.locator("#pose").selectOption(pose);
  await page.clock.runFor(400);
  await expect(page.getByText("Isso! Segure a pose", { exact: true })).toBeVisible();
  await page.screenshot({ path: info.outputPath("wall-matched.png") });
  const before = Number(
    (await page.locator(".race-score strong").textContent())?.replace(/\./g, ""),
  );
  await page.clock.runFor(2000);
  await expect(page.locator(".race-score strong")).toHaveText(
    (before + 100).toLocaleString("pt-BR"),
  );
});

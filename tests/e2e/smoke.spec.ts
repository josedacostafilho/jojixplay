import { expect, test } from "@playwright/test";

test("landing page exposes both device roles", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Turn a phone and TV into a motion playground." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the TV/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the phone/ })).toBeVisible();
});

test("television creates a QR pairing surface", async ({ page }) => {
  await page.goto("/?role=tv");

  await expect(page.getByRole("heading", { name: "Scan with your phone" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Phone pairing QR code" })).toBeVisible();
  await expect(page.getByText("Camera pixels never leave the phone.")).toBeVisible();
});

test("phone route rejects a missing session", async ({ page }) => {
  await page.goto("/?role=phone");

  await expect(page.getByRole("heading", { name: "Open the link from your TV." })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start body tracking/ })).toHaveCount(0);
});

test("phone starts the camera and local pose worker after user activation", async ({ page }) => {
  await page.goto(
    "/?role=phone#room=abcdefghijklmnopqrstuv&secret=abcdefghijklmnopqrstuvwxyzABCDEF",
  );

  const startButton = page.getByRole("button", { name: "Start body tracking" });
  await expect(startButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
  await startButton.click();

  await expect(page.getByRole("button", { name: "Stop tracking" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/visible$/)).toBeVisible();
});

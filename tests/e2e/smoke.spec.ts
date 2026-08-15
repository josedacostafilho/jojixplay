import { expect, test } from "@playwright/test";

test("landing page exposes both device roles", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Turn a phone and TV into a motion playground." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the TV/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open on the phone/ })).toBeVisible();
});

test("television enters TV mode and creates QR and manual pairing surfaces", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      configurable: true,
      value: () => {
        Reflect.set(window, "__jojixplayFullscreenRequested", true);
        return Promise.reject(new DOMException("Fullscreen unavailable in the test browser."));
      },
    });
  });
  await page.goto("/?role=tv");

  await expect(
    page.getByRole("heading", { name: "Make this screen the playground." }),
  ).toBeVisible();
  await expect(page.getByLabel("TV pairing key")).toHaveCount(0);
  await page.getByRole("button", { name: "Start TV mode" }).click();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "__jojixplayFullscreenRequested")))
    .toBe(true);
  await expect(page.getByRole("heading", { name: "Connect your phone" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Phone pairing QR code" })).toBeVisible();
  await expect(page.getByLabel("TV pairing key")).toHaveText(
    /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){4}$/,
  );
  await expect(page.getByText("Camera pixels never leave the phone.")).toBeVisible();
});

test("phone route offers manual pairing without a QR fragment", async ({ page }) => {
  await page.goto("/?role=phone");

  await expect(page.getByRole("heading", { name: "Enter the key from your TV." })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "TV pairing key" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Start body tracking/ })).toHaveCount(0);
});

test("phone accepts a manually entered TV pairing key", async ({ page }) => {
  await page.goto("/?role=phone");

  await page.getByRole("textbox", { name: "TV pairing key" }).fill("m7pkj3tdw9hxq4fv6r2c");
  await page.getByRole("button", { name: "Connect to TV" }).click();

  await expect(page.getByRole("button", { name: "Start body tracking" })).toBeVisible();
});

test("phone starts the camera and local pose worker after user activation", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      Reflect.set(window, "__jojixplayCameraConstraints", JSON.stringify(constraints));
      return originalGetUserMedia(constraints);
    };
  });
  await page.goto("/?role=phone#key=M7PKJ3TDW9HXQ4FV6R2C");

  const startButton = page.getByRole("button", { name: "Start body tracking" });
  await expect(startButton).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
  await startButton.click();

  await expect(page.getByRole("button", { name: "Stop tracking" })).toBeVisible({
    timeout: 30_000,
  });
  const requestedConstraints = await page.evaluate(() => {
    const value: unknown = Reflect.get(window, "__jojixplayCameraConstraints");
    return typeof value === "string" ? value : null;
  });
  expect(requestedConstraints).not.toBeNull();
  expect(JSON.parse(requestedConstraints ?? "null")).toMatchObject({
    audio: false,
    video: {
      facingMode: { ideal: "user" },
      frameRate: { ideal: 30, max: 30 },
    },
  });
  await expect(page.getByText(/visible · (portrait|landscape)$/)).toBeVisible();
});

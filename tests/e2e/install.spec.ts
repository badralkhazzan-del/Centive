import { devices, expect, test } from "@playwright/test";

// PiringTani installs as an app (PWA). Chrome must accept the manifest; the Install
// button must open Chrome's own dialog when Chrome offers installation, and show the
// Add to Home Screen steps on an iPhone, where Safari has no install event.

test("Chrome sees an installable app", async ({ page, context }) => {
  await page.goto("/");
  const cdp = await context.newCDPSession(page);
  await expect.poll(async () => (await cdp.send("Page.getAppManifest")).url).toContain("/manifest.webmanifest");
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
  expect(installabilityErrors).toEqual([]);
  const manifest = JSON.parse((await cdp.send("Page.getAppManifest")).data!) as { name: string; display: string; icons: { src: string }[] };
  expect(manifest).toMatchObject({ name: "PiringTani", display: "standalone" });
  for (const icon of manifest.icons) expect((await page.request.get(icon.src)).ok()).toBe(true);
});

test("Install button opens the browser's install dialog", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("install-app")).toHaveCount(0);
  // What Chrome and Edge do when the app can be installed.
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt", { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => void ((window as unknown as { __prompted: boolean }).__prompted = true);
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByTestId("install-app").click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
  // Installed: the button goes away.
  await expect(page.getByTestId("install-app")).toHaveCount(0);
});

test("On an iPhone, Install shows the Add to Home Screen steps", async ({ browser }) => {
  const iphone = devices["iPhone 13"];
  const ctx = await browser.newContext({ userAgent: iphone.userAgent, viewport: iphone.viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto("/");
  await page.getByTestId("install-app").click();
  await expect(page.getByTestId("install-steps")).toContainText(/Add to Home Screen|Tambahkan ke Layar Utama/);
  await ctx.close();
});

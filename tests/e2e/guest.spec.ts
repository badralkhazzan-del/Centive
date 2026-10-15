import { expect, test, type Page } from "@playwright/test";

// A visitor with no account: one click opens a private copy of the sample region.
// The Kopdes sends egg offers on the laptop, a phone opens the farmer's inbox from the
// QR link and accepts, and the laptop's board updates. Another visitor's copy is untouched.

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/^Failed to load resource/.test(m.text())) return;
    errors.push(m.text());
  });
  return errors;
}

interface Data {
  data: { chat: { farmerId: string }[]; commitments: { farmerId: string; ingredientId: string; status: string }[] };
}

const eggOffer = (d: Data) => d.data.commitments.find((c) => c.ingredientId === "eggs" && c.status === "offered");

test("guest: open the platform, send offers, answer on a phone, see it live", async ({ browser }) => {
  const laptopCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const laptop = await laptopCtx.newPage();
  const errors = watchErrors(laptop);

  // A workspace screen without a session offers to open the platform.
  await laptop.goto("/kopdes");
  await expect(laptop.getByTestId("open-card")).toBeVisible();

  // The landing page has no demo left, and one click opens the platform.
  await laptop.goto("/");
  await expect(laptop.locator("body")).not.toContainText(/\bdemo\b/i);
  await laptop.getByTestId("hero-open-platform").click();
  await laptop.waitForURL(/\/explore/);
  await expect(laptop.getByTestId("phone-card")).toBeVisible();
  await expect(laptop.getByTestId("sample-banner")).toBeVisible();

  // Scan first: the default farmer has no offer yet, and both screens say so.
  await expect(laptop.getByTestId("phone-waiting")).toBeVisible();
  await expect(laptop.getByTestId("phone-qr")).toBeVisible();
  const phoneUrl = (await laptop.getByTestId("phone-url").textContent())!;
  expect(phoneUrl).toContain("/phone?t=");
  const phoneCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const phone = await phoneCtx.newPage();
  const phoneErrors = watchErrors(phone);
  await phone.goto(phoneUrl);
  await phone.waitForURL(/\/farmer$/);
  await expect(phone.getByTestId("waiting-offer")).toBeVisible();

  // Kopdes on the laptop: eggs are short; send offers.
  await laptop.goto("/kopdes");
  const eggs = laptop.getByTestId("board-card-eggs");
  await expect(eggs).toHaveAttribute("data-coverage", "62");
  await laptop.getByTestId("send-offers-eggs").click();
  await expect(eggs).toContainText(/Offered|Ditawarkan/);
  await expect.poll(async () => eggOffer((await (await laptop.request.get("/api/data")).json()) as Data)?.farmerId).toBeTruthy();

  // The offer reaches the open phone without a reload, and the farmer accepts.
  await expect(phone.getByTestId("reply-1").last()).toBeVisible({ timeout: 15_000 });
  await expect(phone.getByTestId("farmer-phone")).toContainText("telur");
  await phone.getByTestId("reply-1").last().click();
  await expect(phone.getByTestId("farmer-phone")).toContainText(/Terima kasih|Tercatat/);

  // The laptop's board moves without a reload.
  await laptop.goto("/kopdes");
  await expect(eggs).not.toHaveAttribute("data-coverage", "62", { timeout: 15_000 });

  // A second visitor gets a fresh copy: none of the first visitor's offers.
  const otherCtx = await browser.newContext();
  const other = await otherCtx.newPage();
  expect((await other.request.post("/api/guest", { data: {} })).ok()).toBe(true);
  const theirs = (await (await other.request.get("/api/data")).json()) as Data;
  const mine = (await (await laptop.request.get("/api/data")).json()) as Data;
  expect(theirs.data.chat.length).toBeLessThan(mine.data.chat.length);

  expect([...errors, ...phoneErrors]).toEqual([]);
  await Promise.all([laptopCtx.close(), phoneCtx.close(), otherCtx.close()]);
});

import { expect, test, type Page } from "@playwright/test";

const STEPS = 8;

/** Collect page errors and console errors. Map tiles come from the internet; a blocked
 * tile request is a network failure the dashboard handles with its list view. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    if (/^Failed to load resource: net::ERR_/.test(m.text())) return;
    errors.push(m.text());
  });
  return errors;
}

async function savedState(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem("piringtani-demo");
    return raw ? (JSON.parse(raw).state.data as { overrides: unknown[]; auditLog: { action: string }[]; payments: { batchId: string }[]; batches: { id: string; deliveredAt?: string }[] }) : null;
  });
}

/** After the tour: eggs reach 69%, the menu shows catfish, and a delivery started the Payment Clock. */
async function expectDemoOutcome(page: Page, errors: string[]) {
  const state = await savedState(page);
  expect(state).not.toBeNull();
  expect(state!.overrides.length).toBe(1);
  expect(state!.auditLog.some((a) => a.action === "menu_switch_approved")).toBe(true);
  const received = state!.batches.filter((b) => b.deliveredAt && state!.payments.some((p) => p.batchId === b.id));
  expect(received.length).toBeGreaterThan(0);

  await page.goto("/kopdes");
  await expect(page.getByTestId("board-card-eggs")).toHaveAttribute("data-coverage", "69");

  await page.goto("/kitchen/menu");
  await expect(page.getByTestId("menu-day-3-0")).toContainText("catfish");

  await page.goto("/kopdes/payments");
  const newest = state!.payments[state!.payments.length - 1];
  await expect(page.getByTestId(`payment-${newest.batchId}`)).toBeVisible();

  expect(errors).toEqual([]);
}

test("Demo Mode plays start to finish on autoplay, from a fresh reset, with no input", async ({ page }) => {
  // Speed the 20-second steps up 10x; every timed action still runs in order.
  await page.addInitScript(() => {
    (window as unknown as { __PT_DEMO_SPEED: number }).__PT_DEMO_SPEED = 10;
  });
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByTestId("play-demo").click();

  const card = page.getByTestId("demo-card");
  for (let i = 1; i <= STEPS; i++) {
    await expect(card).toHaveAttribute("data-step", String(i));
    await expect(page.locator('[data-tour-active="true"]').first()).toBeVisible();
  }
  await expect(page.getByTestId("demo-end")).toBeVisible({ timeout: 10_000 });
  await expect(page).toHaveURL(/\/regency$/);

  await page.getByTestId("demo-finish").click();
  await expect(card).toBeHidden();
  await expectDemoOutcome(page, errors);
});

test("Demo Mode controls: Back, Next ahead of the timer, and Exit", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.getByTestId("play-demo").click();
  const card = page.getByTestId("demo-card");
  await expect(card).toHaveAttribute("data-step", "1");

  await page.getByTestId("demo-pause").click();
  await page.getByTestId("demo-next").click();
  await expect(card).toHaveAttribute("data-step", "2");
  await expect(page).toHaveURL(/\/kitchen\/forecast$/);
  await page.getByTestId("demo-back").click();
  await expect(card).toHaveAttribute("data-step", "1");

  // Pressing Next before a step's timed actions run still applies them, in order.
  for (let i = 2; i <= STEPS; i++) {
    await page.getByTestId("demo-next").click();
    await expect(card).toHaveAttribute("data-step", String(i));
  }
  await page.getByTestId("demo-next").click();
  await expect(page.getByTestId("demo-end")).toBeVisible();
  await page.getByTestId("demo-back").click();
  await expect(card).toHaveAttribute("data-step", String(STEPS));
  await page.keyboard.press("Escape");
  await expect(card).toBeHidden();

  await expectDemoOutcome(page, errors);
});

import { expect, test, type Browser, type Page } from "@playwright/test";

// A real multi-user flow on a live workspace: an administrator creates the workspace
// and invites a Kopdes manager and a farmer, each in their own browser. The Kopdes
// sends offers, the farmer accepts on their phone, and the board updates live.

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

async function command(page: Page, name: string, args: unknown[]) {
  const res = await page.request.post("/api/command", { data: { name, args } });
  expect(res.ok(), `${name}: ${res.status()}`).toBe(true);
  return res.json();
}

async function invite(page: Page, name: string, role: string, entityId: string) {
  const res = await page.request.post("/api/users", { data: { name, role, entityId } });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { token: string }).token;
}

async function join(browser: Browser, token: string, login: string, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = watchErrors(page);
  await page.goto(`/join?token=${token}`);
  await page.fill("#login", login);
  await page.fill("#password", "secret123");
  await page.getByTestId("join-submit").click();
  await page.waitForURL((u) => !u.pathname.startsWith("/join"));
  return { ctx, page, errors };
}

test("live workspace: invites, roles, an offer answered by a farmer and seen live by the Kopdes", async ({ browser }) => {
  const stamp = Date.now();
  const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const admin = await adminCtx.newPage();
  const adminErrors = watchErrors(admin);

  // 1. Create an empty workspace.
  await admin.goto("/signup");
  await admin.fill("#ws", "Pilot MBG Test");
  await admin.fill("#region", "Banyumas");
  await admin.fill("#name", "Badr");
  await admin.fill("#login", `admin${stamp}@example.com`);
  await admin.fill("#password", "secret123");
  await admin.getByTestId("signup-submit").click();
  await admin.waitForURL(/\/manage/);
  await expect(admin.getByTestId("manage-tab-team")).toBeVisible();

  // 2. Real data: one Kopdes, one kitchen ordering all local food from it, one farmer.
  await command(admin, "saveKopdes", [{ id: "kd-ledug", name: "Kopdes Merah Putih Ledug", village: "Ledug", subdistrict: "Kembaran" }]);
  await command(admin, "saveKitchen", [
    { id: "k-ledug", name: "SPPG Ledug", beneficiaries: { small: 800, large: 1200 }, linkedKopdesIds: ["kd-ledug"], kopdesOrderShare: { "kd-ledug": 1 } },
  ]);
  await command(admin, "saveFarmer", [
    { id: "f-sri", displayName: "Sri", village: "Ledug", kopdesId: "kd-ledug", commodities: [{ ingredientId: "eggs", weeklyCapacityKg: 60 }], phone: "081234567001", consentGiven: true },
  ]);

  // 3. Invite the Kopdes manager and the farmer; each joins in their own browser.
  const kopdesToken = await invite(admin, "Siti", "kopdes", "kd-ledug");
  const farmerToken = await invite(admin, "Sri", "farmer", "f-sri");
  const kopdes = await join(browser, kopdesToken, `kopdes${stamp}@example.com`);
  const farmer = await join(browser, farmerToken, `0812${String(stamp).slice(-8)}`);

  // 4. The Kopdes manager lands on their own board and sends egg offers.
  await kopdes.page.goto("/kopdes");
  const eggs = kopdes.page.getByTestId("board-card-eggs");
  await expect(eggs).toBeVisible();
  await expect(eggs).toHaveAttribute("data-coverage", "0");
  await kopdes.page.getByTestId("send-offers-eggs").click();
  await expect(eggs).toContainText(/Offered|Ditawarkan/);

  // A Kopdes manager cannot open kitchen screens.
  await kopdes.page.goto("/kitchen");
  await kopdes.page.waitForURL(/\/kopdes$/);

  // 5. The farmer sees only their own offer and accepts it.
  await farmer.page.goto("/farmer");
  await expect(farmer.page.getByTestId("farmer-phone")).toContainText("telur");
  await expect(farmer.page.getByTestId("farmer-select")).toBeHidden();
  await farmer.page.getByTestId("reply-1").click();
  await expect(farmer.page.getByTestId("farmer-phone")).toContainText(/Terima kasih|Tercatat/);

  // 6. The Kopdes board updates without a reload (polling).
  await kopdes.page.goto("/kopdes");
  await expect(eggs).not.toHaveAttribute("data-coverage", "0", { timeout: 15_000 });

  // 7. Data persisted on the server and is shared: the admin sees the accepted commitment.
  const data = (await (await admin.request.get("/api/data")).json()) as { data: { commitments: { farmerId: string; status: string }[] } };
  expect(data.data.commitments.some((c) => c.farmerId === "f-sri" && c.status === "accepted")).toBe(true);

  // 8. A farmer is not allowed to change settings.
  const forbidden = await farmer.page.request.post("/api/command", { data: { name: "updateSettings", args: [{ safetyBuffer: 0.3 }] } });
  expect(forbidden.status()).toBe(403);

  expect([...adminErrors, ...kopdes.errors, ...farmer.errors]).toEqual([]);
  await Promise.all([adminCtx.close(), kopdes.ctx.close(), farmer.ctx.close()]);
});

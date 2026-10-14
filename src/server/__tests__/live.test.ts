import { beforeAll, describe, expect, it } from "vitest";
import { createSessionToken, readSessionToken, todayIn } from "../auth";
import { getDb } from "../db";
import { acceptInvite, createAdmin, inviteUser, listUsers, login, reinvite, UserError } from "../users";
import { CommandError, createWorkspace, loadFor, readWorkspace, resetWorkspace, runCommand } from "../workspace";
import type { SessionUser } from "../auth";

// Runs against an in-memory PGlite database (NODE_ENV=test).

let admin: SessionUser;
let wsId: string;

beforeAll(async () => {
  const ws = await createWorkspace({ name: "Dinas Test", region: "Banyumas", start: "sample" });
  wsId = ws.id;
  admin = await createAdmin(wsId, "Badr", "admin@example.com", "secret123");
}, 60_000);

describe("live workspaces", () => {
  it("creates a sample workspace on the real date", async () => {
    const loaded = await loadFor(admin);
    expect(loaded!.data.today).toBe(todayIn("Asia/Jakarta"));
    expect(loaded!.data.workspace?.sample).toBe(true);
    expect(loaded!.data.kitchens.length).toBeGreaterThan(0);
  });

  it("logs in with the right password only", async () => {
    await expect(login("admin@example.com", "wrong-pass")).rejects.toBeInstanceOf(UserError);
    const u = await login("ADMIN@example.com ", "secret123");
    expect(u.id).toBe(admin.id);
  });

  it("signs and verifies session tokens", () => {
    const t = createSessionToken(admin.id, wsId);
    expect(readSessionToken(t)).toEqual({ userId: admin.id, workspaceId: wsId });
    expect(readSessionToken(t.slice(0, -2) + "xx")).toBeNull();
    expect(readSessionToken(createSessionToken(admin.id, wsId, -1))).toBeNull();
  });

  it("invites a Kopdes manager who can act only on their own Kopdes", async () => {
    const inv = await inviteUser(admin, { name: "Siti", role: "kopdes", entityId: "kd-sumbangsari" });
    const kopdes = await acceptInvite(inv.token, "0812 3456 7890", "kopdes123");
    expect(kopdes.login).toBe("6281234567890");
    expect(kopdes.entityId).toBe("kd-sumbangsari");

    const r = await runCommand(kopdes, "sendOffers", ["kd-sumbangsari", "eggs"]);
    expect((r.result as { created: unknown[] }).created.length).toBeGreaterThan(0);
    await expect(runCommand(kopdes, "sendOffers", ["kd-karangmulya", "eggs"])).rejects.toBeInstanceOf(CommandError);
    await expect(runCommand(kopdes, "updateSettings", [{ safetyBuffer: 0.2 }])).rejects.toBeInstanceOf(CommandError);

    // Kopdes may invite farmers of their own Kopdes, nobody else.
    await expect(inviteUser(kopdes, { name: "X", role: "kitchen", entityId: "k-sumbang-1" })).rejects.toBeInstanceOf(UserError);
    const farmerInv = await inviteUser(kopdes, { name: "Darto", role: "farmer", entityId: "f-darto" });
    expect(farmerInv.token.length).toBeGreaterThan(10);
    const visible = await listUsers(kopdes);
    expect(visible.map((u) => u.name).sort()).toEqual(["Darto", "Siti"]);
  });

  it("shows a farmer only their own messages and hides other farmers", async () => {
    const inv = await inviteUser(admin, { name: "Wati", role: "farmer", entityId: "f-wati" });
    const farmer = await acceptInvite(inv.token, "wati@example.com", "farmer123");
    const loaded = await loadFor(farmer);
    expect(loaded!.data.chat.every((m) => m.farmerId === "f-wati")).toBe(true);
    expect(loaded!.data.auditLog).toEqual([]);
    const others = loaded!.data.farmers.filter((f) => f.id !== "f-wati");
    expect(others.every((f) => f.displayName === "•••" && !f.phone)).toBe(true);
    // A farmer cannot answer someone else's message.
    const full = await readWorkspace(await getDb(), wsId);
    const othersMsg = full!.data.chat.find((m) => m.farmerId !== "f-wati" && m.buttons && !m.answered);
    if (othersMsg) await expect(runCommand(farmer, "chatReply", [othersMsg.id, "1"])).rejects.toBeInstanceOf(CommandError);
  });

  it("applies concurrent commands without losing either", async () => {
    const before = (await readWorkspace(await getDb(), wsId))!;
    await Promise.all([
      runCommand(admin, "toggleHoliday", ["k-sumbang-1", "2027-01-05"]),
      runCommand(admin, "toggleHoliday", ["k-sumbang-2", "2027-01-05"]),
    ]);
    const after = (await readWorkspace(await getDb(), wsId))!;
    expect(after.version).toBe(before.version + 2);
    for (const id of ["k-sumbang-1", "k-sumbang-2"]) {
      expect(after.data.kitchens.find((k) => k.id === id)!.schoolCalendar.holidays.some((h) => h.date === "2027-01-05")).toBe(true);
    }
  });

  it("re-invites (password reset) and resets the workspace", async () => {
    const users = await listUsers(admin);
    const siti = users.find((u) => u.name === "Siti")!;
    const { token } = await reinvite(admin, siti.id);
    await acceptInvite(token, "6281234567890", "newpass99");
    await expect(login("081234567890", "newpass99")).resolves.toMatchObject({ name: "Siti" });

    const r = await resetWorkspace(admin, "empty");
    expect(r.data.kitchens).toEqual([]);
    expect(r.data.workspace?.sample).toBe(false);
  });

  it("adds real kitchens, cooperatives and farmers to an empty workspace", async () => {
    await runCommand(admin, "saveKopdes", [{ name: "Kopdes Merah Putih Ledug", village: "Ledug", subdistrict: "Kembaran" }]);
    const kd = (await loadFor(admin))!.data.kopdes[0];
    await runCommand(admin, "saveKitchen", [{ name: "SPPG Ledug", beneficiaries: { small: 1000, large: 1500 }, linkedKopdesIds: [kd.id], kopdesOrderShare: { [kd.id]: 0.6 } }]);
    await runCommand(admin, "saveFarmer", [{ displayName: "Sri Lestari", village: "Ledug", kopdesId: kd.id, commodities: [{ ingredientId: "eggs", weeklyCapacityKg: 80 }], phone: "081298765432", consentGiven: true }]);
    const d = (await loadFor(admin))!.data;
    expect(d.kitchens).toHaveLength(1);
    expect(d.menuCycles).toHaveLength(1);
    expect(d.farmers[0].displayName).toBe("Sri");
    expect(d.farmers[0].phoneMasked).toBe("08xx-xxxx-5432");
    expect(d.kopdes[0].memberFarmerIds).toEqual([d.farmers[0].id]);
    const r = await runCommand(admin, "sendOffers", [kd.id, "eggs"]);
    expect((r.result as { created: unknown[] }).created.length).toBe(1);
  });
});

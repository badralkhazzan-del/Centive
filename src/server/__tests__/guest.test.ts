import { describe, expect, it } from "vitest";
import { getDb } from "../db";
import { claimPhone, cleanupGuests, phoneLink, startGuest } from "../guest";
import { getUser, UserError } from "../users";
import { createWorkspace, loadFor, runCommand } from "../workspace";
import { createAdmin } from "../users";

// Runs against an in-memory PGlite database (NODE_ENV=test).

describe("guest workspaces", () => {
  it("gives each visitor a private copy of the sample region", async () => {
    const a = await startGuest("10.0.0.1");
    const b = await startGuest("10.0.0.1");
    expect(a.workspaceId).not.toBe(b.workspaceId);
    expect((await getUser(a.id))?.guest).toBe(true);
    const da = (await loadFor(a))!.data;
    expect(da.workspace?.sample).toBe(true);
    expect(da.kitchens.length).toBeGreaterThan(0);

    // A change in one copy does not reach the other.
    await runCommand(a, "sendOffers", ["kd-sumbangsari", "eggs"]);
    const offersA = (await loadFor(a))!.data.chat.length;
    const offersB = (await loadFor(b))!.data.chat.length;
    expect(offersA).toBeGreaterThan(offersB);
  }, 60_000);

  it("limits how many copies one address can open per hour", async () => {
    for (let i = 0; i < 30; i++) await startGuest("10.0.0.9");
    await expect(startGuest("10.0.0.9")).rejects.toBeInstanceOf(UserError);
  }, 120_000);

  it("opens a phone as a farmer of the same workspace with a reusable link", async () => {
    const admin = await startGuest("10.0.0.2");
    const link = await phoneLink(admin, "farmer", "f-wati");
    expect(link.name).toBe("Wati");
    expect((await phoneLink(admin, "farmer", "f-wati")).token).toBe(link.token);
    const phone = await claimPhone(link.token);
    const again = await claimPhone(link.token);
    expect(again.id).toBe(phone.id);
    expect(phone).toMatchObject({ workspaceId: admin.workspaceId, role: "farmer", entityId: "f-wati", guest: true });
    const view = (await loadFor(phone))!.data;
    expect(view.chat.every((m) => m.farmerId === "f-wati")).toBe(true);
    await expect(phoneLink(admin, "farmer", "nobody")).rejects.toBeInstanceOf(UserError);
  });

  it("never makes sign-in links for real workspaces", async () => {
    const ws = await createWorkspace({ name: "Real", region: "Banyumas", start: "sample" });
    const admin = await createAdmin(ws.id, "Admin", "real-admin@example.com", "secret123");
    await expect(phoneLink(admin, "farmer", "f-wati")).rejects.toBeInstanceOf(UserError);
    await expect(claimPhone("not-a-token")).rejects.toBeInstanceOf(UserError);
  });

  it("deletes guest copies that sat unused for a week, and only those", async () => {
    const old = await startGuest("10.0.0.3");
    const real = await createWorkspace({ name: "Kept", region: "", start: "empty" });
    const db = await getDb();
    await db.query(`update pt_workspaces set updated_at = now() - interval '8 days' where id in ($1, $2)`, [old.workspaceId, real.id]);
    expect(await cleanupGuests()).toBeGreaterThanOrEqual(1);
    expect(await getUser(old.id)).toBeNull();
    expect((await db.query(`select 1 from pt_workspaces where id = $1`, [real.id])).length).toBe(1);
  });
});

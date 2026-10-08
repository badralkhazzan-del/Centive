import { describe, expect, it } from "vitest";
import { derive } from "@/engines/derive";
import { cellOf } from "@/engines/forecast";
import { resolveDay } from "@/engines/menu";
import * as cmd from "@/lib/repo/commands";
import { seed } from "./fixtures";

const NOW = "2026-10-26T09:00:00.000Z";

describe("Repository commands (demo flows)", () => {
  it("sends Pak Darto an eggs offer of 50 kg/week for weeks 3-6", () => {
    const r = cmd.sendOffers(seed(), NOW, "kd-sumbangsari", "eggs");
    expect(r.offerWeeks).toEqual([3, 4, 5, 6]);
    const darto = r.created.find((c) => c.farmerId === "f-darto")!;
    expect(darto.kgPerWeek).toBe(50);
    expect(darto.status).toBe("offered");
    const msg = r.data.chat.find((m) => m.commitmentId === darto.id)!;
    expect(msg.textId).toContain("Halo Pak Darto");
    expect(msg.textId).toContain("telur 50 kg/minggu");
    expect(msg.textId).toContain("minggu 3–6");
    expect(msg.textId).toContain("Rp 26.600–30.800/kg");
    expect(msg.buttons?.map((b) => b.value)).toEqual(["1", "2", "3"]);
    expect(r.data.auditLog[0].action).toBe("offers_sent");
  });

  it("updates the Commitment Board as soon as the farmer replies 2 -> 20 kg", () => {
    let data = cmd.sendOffers(seed(), NOW, "kd-sumbangsari", "eggs").data;
    const before = derive(data).windowCoverage("kd-sumbangsari", "eggs", [3, 4, 5, 6]);
    const offer = data.chat.find((m) => m.farmerId === "f-darto" && m.kind === "offer")!;
    data = cmd.chatReply(data, NOW, offer.id, "2");
    const ask = data.chat.find((m) => m.kind === "ask_partial")!;
    expect(ask.buttons?.map((b) => b.value)).toEqual(["10", "20", "30"]);
    data = cmd.chatReply(data, NOW, ask.id, "20");
    const after = derive(data).windowCoverage("kd-sumbangsari", "eggs", [3, 4, 5, 6]);
    expect(Math.round(before.pct * 100)).toBe(62);
    expect(after.committed - before.committed).toBeCloseTo(80, 6); // 20 kg x 4 weeks
    expect(after.offered).toBe(0);
    expect(data.chat.at(-1)?.kind).toBe("confirm");
    // Replying twice to the same message does nothing.
    expect(cmd.chatReply(data, NOW, ask.id, "30")).toBe(data);
  });

  it("records a decline and does not re-offer the same farmer", () => {
    let data = cmd.sendOffers(seed(), NOW, "kd-sumbangsari", "eggs").data;
    const offer = data.chat.find((m) => m.farmerId === "f-darto" && m.kind === "offer")!;
    data = cmd.chatReply(data, NOW, offer.id, "3");
    expect(data.commitments.find((c) => c.id === offer.commitmentId)!.status).toBe("declined");
    const again = cmd.sendOffers(data, NOW, "kd-sumbangsari", "eggs");
    expect(again.created.some((c) => c.farmerId === "f-darto")).toBe(false);
  });

  it("approving a Menu Switch changes the menu, the forecast and the audit log consistently", () => {
    const data = seed();
    const d0 = derive(data);
    const s = d0.suggestions.get("k-sumbang-1")![0];
    const next = cmd.approveSuggestion(data, NOW, s);
    const d1 = derive(next);
    // menu
    const k = d1.kitchensById.get("k-sumbang-1")!;
    const day = resolveDay(k, d1.cyclesByKitchen.get(k.id)!, d1.dishesById, next.overrides, next.today, s.week, (s.dayIndex - 1) % 5);
    expect(day.dishes.some((x) => x.dishId === s.toDishId && x.switchedFromDishId === s.fromDishId)).toBe(true);
    // forecast
    const t0 = d0.kitchenTables.get(k.id)!;
    const t1 = d1.kitchenTables.get(k.id)!;
    expect(cellOf(t1, "chicken", s.week).kgExpected).toBeLessThan(cellOf(t0, "chicken", s.week).kgExpected);
    expect(cellOf(t1, "catfish", s.week).kgExpected).toBeGreaterThan(cellOf(t0, "catfish", s.week).kgExpected);
    expect(cellOf(t1, "chicken", s.week + 1).kgExpected).toBeCloseTo(cellOf(t0, "chicken", s.week + 1).kgExpected, 6);
    // audit log and inbox
    expect(next.auditLog.some((l) => l.action === "menu_switch_approved")).toBe(true);
    expect(d1.suggestions.get(k.id)!.some((x) => x.id === s.id)).toBe(false);
    // the switch asks member farmers for the extra catfish
    expect(next.commitments.some((c) => c.ingredientId === "catfish" && c.status === "offered")).toBe(true);
    // approving twice is a no-op
    expect(cmd.approveSuggestion(next, NOW, s)).toBe(next);
  });

  it("rejecting keeps the menu and logs the decision", () => {
    const data = seed();
    const s = derive(data).suggestions.get("k-sumbang-1")![0];
    const next = cmd.rejectSuggestion(data, NOW, s);
    expect(next.overrides).toHaveLength(0);
    expect(next.auditLog[0].action).toBe("menu_switch_rejected");
    expect(derive(next).suggestions.get("k-sumbang-1")!.some((x) => x.id === s.id)).toBe(false);
  });

  it("creates a batch, receives it and starts the Payment Clock", () => {
    const data = seed();
    const { data: withBatch, batch } = cmd.createBatch(data, NOW, {
      kopdesId: "kd-sumbangsari",
      kitchenId: "k-sumbang-1",
      ingredientId: "eggs",
      farmerIds: ["f-darto", "f-sri"],
      kg: 70,
      grade: "A",
      coldChainChecked: true,
      harvestDate: "2026-10-26",
      plannedDeliveryDate: "2026-10-27",
    });
    expect(batch.id).toMatch(/^PT-[A-Z2-9]{4}$/);
    expect(withBatch.chat.filter((m) => m.kind === "reminder")).toHaveLength(2);
    const missing = cmd.receiveBatch(withBatch, NOW, batch.id, { receivedChecked: true, coldChainChecked: false, receivedBy: "x" });
    expect(missing.ok).toBe(false);
    expect(missing.error).toBe("checks_missing");
    const ok = cmd.receiveBatch(withBatch, NOW, batch.id.toLowerCase(), { receivedChecked: true, coldChainChecked: true, receivedBy: "x" });
    expect(ok.ok).toBe(true);
    const pay = ok.data.payments.find((p) => p.batchId === batch.id)!;
    expect(pay.verifiedAt).toBeDefined();
    expect(pay.amountRp).toBeGreaterThan(0);
    expect(cmd.receiveBatch(ok.data, NOW, batch.id, { receivedChecked: true, coldChainChecked: true, receivedBy: "x" }).error).toBe("already_received");
    expect(cmd.receiveBatch(ok.data, NOW, "PT-NONE", { receivedChecked: true, coldChainChecked: true, receivedBy: "x" }).error).toBe("not_found");
    // payment chain
    let next = cmd.markFarmersPaid(ok.data, NOW, batch.id);
    expect(next).toBe(ok.data); // kitchen must pay first
    next = cmd.markFarmersPaid(cmd.markKitchenPaid(ok.data, NOW, batch.id), NOW, batch.id);
    expect(next.payments.find((p) => p.batchId === batch.id)!.farmerPaidAt).toBeDefined();
    expect(next.chat.filter((m) => m.kind === "payment" && m.textId.includes(batch.id))).toHaveLength(2);
  });

  it("asks members without consent before sending them offers", () => {
    const r = cmd.inviteMoreFarmers(seed(), NOW, "kd-karangmulya", "chicken");
    expect(r.invited).toEqual(["f-warsono"]);
    expect(r.created.some((c) => c.farmerId === "f-warsono")).toBe(false);
    const msg = r.data.chat.find((m) => m.farmerId === "f-warsono" && m.kind === "info")!;
    const agreed = cmd.chatReply(r.data, NOW, msg.id, "consent_yes");
    expect(agreed.farmers.find((f) => f.id === "f-warsono")!.consentGiven).toBe(true);
    const offers = cmd.sendOffers(agreed, NOW, "kd-karangmulya", "chicken");
    expect(offers.created.some((c) => c.farmerId === "f-warsono")).toBe(true);
  });

  it("logs settings changes and applies attendance to all kitchens", () => {
    const next = cmd.updateSettings(seed(), NOW, { attendanceRate: 0.9 });
    expect(next.kitchens.every((k) => k.attendanceRate === 0.9)).toBe(true);
    expect(next.auditLog[0].action).toBe("settings_changed");
  });
});

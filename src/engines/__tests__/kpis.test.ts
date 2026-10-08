import { describe, expect, it } from "vitest";
import { derive } from "@/engines/derive";
import { regencyKpis } from "@/engines/kpis";
import * as cmd from "@/lib/repo/commands";
import { seed } from "./fixtures";

describe("Regency KPIs", () => {
  it("computes bounded indicators from the seed", () => {
    const k = regencyKpis(derive(seed()));
    expect(k.localShare).toBeGreaterThan(0.1);
    expect(k.localShare).toBeLessThan(0.6);
    expect(k.fillRate).toBeGreaterThan(0.5);
    expect(k.fillRate).toBeLessThanOrEqual(1);
    expect(k.weekly).toHaveLength(8);
    expect(k.retainedRp).toBeGreaterThan(0);
    expect(k.priceAlerts).toBeGreaterThanOrEqual(1);
    expect(k.leftoverByWeek.length).toBeGreaterThanOrEqual(4);
    expect(k.farmersEngaged).toBeGreaterThan(10);
  });

  it("rises when a farmer accepts an offer", () => {
    const data = seed();
    const before = regencyKpis(derive(data));
    let next = cmd.sendOffers(data, "2026-10-26T09:00:00.000Z", "kd-sumbangsari", "eggs").data;
    const offer = next.chat.find((m) => m.kind === "offer")!;
    next = cmd.chatReply(next, "2026-10-26T09:00:00.000Z", offer.id, "1");
    const after = regencyKpis(derive(next));
    expect(after.retainedRp).toBeGreaterThan(before.retainedRp);
    expect(after.fillRate).toBeGreaterThan(before.fillRate);
  });
});

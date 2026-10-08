import { describe, expect, it } from "vitest";
import { FACTS } from "@/content/facts";
import { derive } from "@/engines/derive";
import { allComponents, resolveDay } from "@/engines/menu";
import { portionCost } from "@/engines/nutrition";
import { BUDGET_RP } from "@/engines/substitution";
import { seed } from "./fixtures";

describe("Seed data", () => {
  it("keeps every menu day within the raw-food budget at seed prices", () => {
    const data = seed();
    const d = derive(data);
    for (const k of data.kitchens) {
      const cycle = d.cyclesByKitchen.get(k.id)!;
      for (let week = 1; week <= 4; week++) {
        for (let dow = 0; dow < 5; dow++) {
          const day = resolveDay(k, cycle, d.dishesById, [], data.today, week, dow);
          for (const size of ["small", "large"] as const) {
            // seed (normal) prices: the 4-week reference before the planning window
            const cost = portionCost(allComponents(day), size, d.ingredientsById, (id) => d.commitmentBand(id).ref, k.seasoningCostRp[size]);
            expect(cost, `${k.id} day ${day.dayIndex} ${size}`).toBeLessThanOrEqual(BUDGET_RP[size]);
          }
        }
      }
    }
  });

  it("starts the demo with eggs at 62% for Kopdes Sumbangsari, weeks 3-6", () => {
    const d = derive(seed());
    const c = d.windowCoverage("kd-sumbangsari", "eggs", d.windowWeeks);
    expect(Math.round(c.pct * 100)).toBe(62);
    expect(c.status).toBe("red");
  });

  it("uses first names only and masked phone numbers", () => {
    for (const f of seed().farmers) {
      expect(f.displayName).not.toMatch(/\s/);
      expect(f.phoneMasked).toMatch(/^08xx-xxxx-\d{4}$/);
    }
  });

  it("labels organizations as demo and every price as a placeholder", () => {
    const data = seed();
    for (const kd of data.kopdes) expect(kd.name).toMatch(/\(demo\)$/);
    for (const k of data.kitchens) expect(k.name).toMatch(/Demo/);
    expect(data.prices.every((p) => p.source === "PLACEHOLDER")).toBe(true);
    expect(data.prices.length).toBe(data.ingredients.length * 12);
  });

  it("gives every fact a source URL and a date", () => {
    for (const f of FACTS) {
      expect(f.sourceUrl).toMatch(/^https:\/\//);
      expect(f.date).toMatch(/^\d{4}/);
      expect(f.textEn.length).toBeGreaterThan(10);
      expect(f.textId.length).toBeGreaterThan(10);
    }
  });

  it("has unique batch codes and respects the fairness cap in seed commitments", () => {
    const data = seed();
    const codes = data.batches.map((b) => b.id);
    expect(new Set(codes).size).toBe(codes.length);
    const d = derive(data);
    for (const c of data.commitments) {
      for (const w of c.weeks) {
        const needed = d.coverage(c.kopdesId, c.ingredientId, w).needed;
        if (needed > 0 && c.weeks.length > 1) {
          const held = data.commitments
            .filter((x) => x.farmerId === c.farmerId && x.kopdesId === c.kopdesId && x.ingredientId === c.ingredientId && x.weeks.includes(w))
            .reduce((s, x) => s + x.kgPerWeek, 0);
          expect(held, `${c.farmerId} ${c.ingredientId} w${w}`).toBeLessThanOrEqual(needed * data.settings.fairnessCapPct + 1);
        }
      }
    }
  });
});

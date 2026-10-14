import { describe, expect, it } from "vitest";
import { buildEmptyState, buildSeedState } from "@/data/seed";
import { derive } from "../derive";
import { regencyKpis } from "../kpis";
import { resolveDay } from "../menu";
import { rollForward } from "../rollover";
import { addDays, DEMO_TODAY } from "../time";

describe("rollForward (live workspaces on the real calendar)", () => {
  const data = buildSeedState();

  it("does nothing within the same week, except moving today", () => {
    const next = rollForward(data, addDays(DEMO_TODAY, 3));
    expect(next.today).toBe(addDays(DEMO_TODAY, 3));
    expect(next.commitments).toEqual(data.commitments);
  });

  it("ignores a clock that goes backwards", () => {
    expect(rollForward(data, addDays(DEMO_TODAY, -7))).toBe(data);
  });

  it("keeps every plan on the same calendar dates after a week passes", () => {
    const next = rollForward(data, addDays(DEMO_TODAY, 7));
    const before = derive(data);
    const after = derive(next);
    for (const kd of data.kopdes) {
      for (const ing of before.kopdesCommodities.get(kd.id) ?? []) {
        for (const w of [2, 3, 4, 5, 6, 7]) {
          const a = before.coverage(kd.id, ing, w);
          const b = after.coverage(kd.id, ing, w - 1);
          expect(b.committed, `${kd.id} ${ing} w${w}`).toBeCloseTo(a.committed, 6);
          expect(b.needed, `${kd.id} ${ing} w${w}`).toBeCloseTo(a.needed, 6);
        }
      }
    }
  });

  it("keeps the 4-week menu cycle aligned with the calendar", () => {
    const next = rollForward(data, addDays(DEMO_TODAY, 14));
    const dishes = new Map(data.dishes.map((d) => [d.id, d]));
    for (const k of data.kitchens) {
      const cycle = data.menuCycles.find((c) => c.kitchenId === k.id)!;
      for (const w of [3, 4, 5, 6]) {
        for (const dow of [0, 1, 2, 3, 4]) {
          const a = resolveDay(k, cycle, dishes, data.overrides, data.today, w, dow);
          const b = resolveDay(k, cycle, dishes, next.overrides, next.today, w - 2, dow);
          expect(b.date).toBe(a.date);
          expect(b.dishes.map((x) => x.dishId)).toEqual(a.dishes.map((x) => x.dishId));
        }
      }
    }
  });

  it("drops plans that fall far into the past", () => {
    const next = rollForward(data, addDays(DEMO_TODAY, 7 * 40));
    expect(next.commitments).toEqual([]);
  });
});

describe("empty live workspace", () => {
  it("derives without kitchens, cooperatives or farmers", () => {
    const empty = buildEmptyState("2026-10-14");
    const d = derive(empty);
    expect(d.kitchenTables.size).toBe(0);
    const k = regencyKpis(d);
    expect(Number.isFinite(k.localShare)).toBe(true);
    expect(empty.ingredients.length).toBeGreaterThan(0);
  });

  it("builds the sample region on any date", () => {
    const sample = buildSeedState("2027-02-08");
    const d = derive(sample);
    expect(d.windowWeeks.length).toBeGreaterThan(0);
    expect(sample.menuCycles[0].anchorMonday).toBe("2027-02-15");
  });
});

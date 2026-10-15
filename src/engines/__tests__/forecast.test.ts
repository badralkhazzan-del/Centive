import { describe, expect, it } from "vitest";
import { aggregateForKopdes, forecastKitchenWeek, mape, tableFrom, cellOf } from "@/engines/forecast";
import { derive } from "@/engines/derive";
import { SAMPLE_DATE, schoolDayDate } from "@/engines/time";
import { mini, seed } from "./fixtures";

function ctxFor(kitchenPatch = {}) {
  const { ingredient, dish, kitchen, cycle } = mini();
  return {
    today: SAMPLE_DATE,
    kitchen: { ...kitchen, ...kitchenPatch },
    cycle,
    dishesById: new Map([[dish.id, dish]]),
    ingredientsById: new Map([[ingredient.id, ingredient]]),
    overrides: [],
    safetyBuffer: 0.05,
  };
}

describe("Menu-to-Field Forecast", () => {
  it("applies the rawKg formula, safety buffer and low/high band", () => {
    const [f] = forecastKitchenWeek(ctxFor(), 1);
    // per day: (100 g x 10 + 200 g x 20) x 0.9 / 0.5 / 1000 = 9 kg; 5 school days
    const raw = 5 * ((100 * 10 + 200 * 20) * 0.9) / 0.5 / 1000;
    expect(f.kgExpected).toBeCloseTo(raw * 1.05, 6);
    expect(f.kgLow).toBeCloseTo((raw / 0.9) * 0.85, 6);
    expect(f.kgHigh).toBeCloseTo((raw / 0.9) * 0.93 * 1.05, 6);
    expect(f.kgLow).toBeLessThan(f.kgExpected);
    expect(f.kgHigh).toBeGreaterThan(f.kgExpected);
  });

  it("gives zero demand on a holiday and less in a week with one", () => {
    const holiday = schoolDayDate(SAMPLE_DATE, 1, 2);
    const full = forecastKitchenWeek(ctxFor(), 1)[0].kgExpected;
    const withHoliday = forecastKitchenWeek(
      ctxFor({ schoolCalendar: { operatingWeekdays: [1, 2, 3, 4, 5], holidays: [{ date: holiday, nameEn: "h", nameId: "h" }] } }),
      1,
    )[0].kgExpected;
    expect(withHoliday).toBeCloseTo((full * 4) / 5, 6);
  });

  it("returns no demand for a full holiday week", () => {
    const holidays = [0, 1, 2, 3, 4].map((d) => ({ date: schoolDayDate(SAMPLE_DATE, 2, d), nameEn: "h", nameId: "h" }));
    const out = forecastKitchenWeek(ctxFor({ schoolCalendar: { operatingWeekdays: [1, 2, 3, 4, 5], holidays } }), 2);
    expect(out).toHaveLength(0);
  });

  it("respects the seed school calendar (Christmas, Friday 25 Dec 2026, week 8)", () => {
    const d = derive(seed());
    expect(schoolDayDate(SAMPLE_DATE, 8, 4)).toBe("2026-12-25");
    const k = "k-sumbang-1";
    const t = d.kitchenTables.get(k)!;
    // Friday of cycle week 4 serves chicken; the holiday removes one of two chicken days.
    expect(cellOf(t, "chicken", 8).kgExpected).toBeCloseTo(cellOf(t, "chicken", 4).kgExpected / 2, 6);
  });

  it("aggregates kitchens linked to a Kopdes with their order share", () => {
    const c = ctxFor();
    const f = forecastKitchenWeek(c, 1);
    const table = aggregateForKopdes("kd", [c.kitchen], new Map([[c.kitchen.id, f]]));
    expect(cellOf(table, "x", 1).kgExpected).toBeCloseTo(f[0].kgExpected * 0.5, 6);
    const other = aggregateForKopdes("other", [c.kitchen], new Map([[c.kitchen.id, f]]));
    expect(other.size).toBe(0);
    expect(cellOf(tableFrom(f), "x", 1).kgExpected).toBeCloseTo(f[0].kgExpected, 6);
  });

  it("computes MAPE and skips zero actuals", () => {
    expect(mape([{ forecast: 90, actual: 100 }, { forecast: 110, actual: 100 }])).toBeCloseTo(0.1, 6);
    expect(mape([{ forecast: 5, actual: 0 }])).toBeNull();
    expect(mape([])).toBeNull();
  });

  it("shows a realistic MAPE on the seed history", () => {
    const d = derive(seed());
    expect(d.regionalMape).not.toBeNull();
    expect(d.regionalMape!).toBeGreaterThan(0.01);
    expect(d.regionalMape!).toBeLessThan(0.1);
  });
});

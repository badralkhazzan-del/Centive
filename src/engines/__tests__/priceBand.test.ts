import { describe, expect, it } from "vitest";
import { buildPrices } from "@/data/prices";
import { commitmentBand, indexPrices, makeBand, priceBand, priceForWeek, settlementPrice, trailingAverage } from "@/engines/priceBand";
import { DEMO_TODAY } from "@/engines/time";

const idx = indexPrices(buildPrices());

describe("Price Band", () => {
  it("builds floor 95% and ceiling 110% of the reference", () => {
    expect(makeBand(28000)).toEqual({ ref: 28000, floor: 26600, ceiling: 30800 });
  });

  it("clamps the settlement price inside the band", () => {
    const band = makeBand(28000);
    expect(settlementPrice(band, 25000)).toBe(26600);
    expect(settlementPrice(band, 29000)).toBe(29000);
    expect(settlementPrice(band, 35000)).toBe(30800);
  });

  it("uses configurable percentages", () => {
    expect(makeBand(10000, { floorPct: 0.9, ceilingPct: 1.2 })).toEqual({ ref: 10000, floor: 9000, ceiling: 12000 });
  });

  it("anchors the eggs commitment band on the 4-week average (Rp 26,600 to 30,800)", () => {
    expect(commitmentBand(idx, "eggs", DEMO_TODAY)).toEqual({ ref: 28000, floor: 26600, ceiling: 30800 });
  });

  it("uses the 4 weeks before the week as reference", () => {
    expect(trailingAverage(idx, "chicken", DEMO_TODAY, 3)).toBeCloseTo((35000 + 35000 + 35500 + 36500) / 4, 6);
    const b = priceBand(idx, "chicken", DEMO_TODAY, 3);
    expect(b.marketPrice).toBe(42000);
    expect(b.marketPrice).toBeGreaterThan(b.ceiling);
    expect(b.settlement).toBe(b.ceiling);
  });

  it("carries the last known price forward beyond the data", () => {
    expect(priceForWeek(idx, "chicken", DEMO_TODAY, 8)).toBe(priceForWeek(idx, "chicken", DEMO_TODAY, 4));
    expect(priceForWeek(idx, "chicken", DEMO_TODAY, -20)).toBe(priceForWeek(idx, "chicken", DEMO_TODAY, -7));
    expect(priceForWeek(idx, "unknown", DEMO_TODAY, 1)).toBe(0);
  });
});

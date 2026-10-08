import type { CommitmentBand, PriceBand, PricePoint } from "@/types";
import { weekStart } from "./time";

// 6.3 Price Band.
//   ref        = 4-week moving average market price (the 4 weeks before the week)
//   floor      = ref x 0.95
//   ceiling    = ref x 1.10
//   settlement = clamp(market price of the week, floor, ceiling)
// A commitment's band is fixed when the offer is made, from the latest 4 weeks of
// prices (weeks -3..0), so farmers and kitchens know the range in advance.

export interface BandPct {
  floorPct: number;
  ceilingPct: number;
}

export const DEFAULT_BAND: BandPct = { floorPct: 0.95, ceilingPct: 1.1 };

export function roundRp(value: number, step = 50): number {
  return Math.round(value / step) * step;
}

export type PriceIndex = Map<string, Map<string, number>>; // ingredientId -> weekStart -> price

export function indexPrices(prices: PricePoint[]): PriceIndex {
  const idx: PriceIndex = new Map();
  for (const p of prices) {
    let m = idx.get(p.ingredientId);
    if (!m) {
      m = new Map();
      idx.set(p.ingredientId, m);
    }
    m.set(p.weekStart, p.priceRpPerKg);
  }
  return idx;
}

/**
 * Market price of an ingredient in a planning week. Weeks beyond the data carry the
 * latest known value forward (and weeks before it use the earliest value).
 */
export function priceForWeek(idx: PriceIndex, ingredientId: string, today: string, week: number): number {
  const series = idx.get(ingredientId);
  if (!series || series.size === 0) return 0;
  const key = weekStart(today, week);
  const exact = series.get(key);
  if (exact !== undefined) return exact;
  const keys = [...series.keys()].sort();
  if (key < keys[0]) return series.get(keys[0])!;
  let last = keys[0];
  for (const k of keys) {
    if (k <= key) last = k;
  }
  return series.get(last)!;
}

/** Average price over the n weeks before `week` (weeks week-n .. week-1). */
export function trailingAverage(idx: PriceIndex, ingredientId: string, today: string, week: number, n = 4): number {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += priceForWeek(idx, ingredientId, today, week - i);
  return sum / n;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function makeBand(ref: number, pct: BandPct = DEFAULT_BAND): CommitmentBand {
  return { ref: roundRp(ref), floor: roundRp(ref * pct.floorPct), ceiling: roundRp(ref * pct.ceilingPct) };
}

export function settlementPrice(band: CommitmentBand, marketPrice: number): number {
  return clamp(marketPrice, band.floor, band.ceiling);
}

/** The weekly band for a planning week. */
export function priceBand(
  idx: PriceIndex,
  ingredientId: string,
  today: string,
  week: number,
  pct: BandPct = DEFAULT_BAND,
): PriceBand {
  const ref = trailingAverage(idx, ingredientId, today, week);
  const band = makeBand(ref, pct);
  const marketPrice = priceForWeek(idx, ingredientId, today, week);
  return { ingredientId, week, ...band, settlement: settlementPrice(band, marketPrice), marketPrice };
}

/** Band fixed at offer time (today): reference = average of weeks -3..0. */
export function commitmentBand(idx: PriceIndex, ingredientId: string, today: string, pct: BandPct = DEFAULT_BAND): CommitmentBand {
  return makeBand(trailingAverage(idx, ingredientId, today, 1), pct);
}

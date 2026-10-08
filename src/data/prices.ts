import type { PricePoint } from "@/types";
import { DEMO_TODAY, weekStart } from "@/engines/time";

// 12 weeks of weekly market prices per ingredient: 8 weeks of history (weeks -7..0,
// where week 0 is the demo's current week) and 4 weeks ahead (weeks 1..4).
//
// EVERY VALUE IS A PLACEHOLDER (source: "PLACEHOLDER"). Replace them with real
// exports from PIHPS, Bank Indonesia (https://www.bi.go.id/hargapangan): choose
// Jawa Tengah, then Kab. Banyumas or Kota Purwokerto, export the weekly series and
// paste the numbers below (see README, "Replacing price data with PIHPS").
//
// Chicken is anchored on the reported Pasar Wage Purwokerto figures (December 2025):
// about Rp35,000/kg normally, Rp42,000/kg during the spike (placed in week 3).
// Prices are Rp per kg, except cooking oil (Rp per litre).

export const PRICE_WEEKS = [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4];

export const PRICE_TABLE: Record<string, number[]> = {
  //            -7     -6     -5     -4     -3     -2     -1      0  |   1      2      3      4
  rice:        [12900, 12900, 13000, 13000, 13000, 13100, 13000, 13000, 13000, 13100, 13100, 13200],
  chicken:     [34500, 35000, 35500, 35000, 35000, 35000, 35000, 35000, 35500, 36500, 42000, 38000],
  eggs:        [27500, 27800, 28000, 28200, 28000, 28000, 28000, 28000, 28000, 28500, 29000, 29000],
  catfish:     [25000, 25000, 24500, 25000, 25000, 25000, 25000, 25000, 25000, 24500, 24500, 24500],
  tilapia:     [32000, 32000, 32500, 32000, 32000, 32000, 32000, 32000, 32000, 32000, 32500, 32500],
  tempe:       [14000, 14000, 14000, 14200, 14000, 14000, 14000, 14000, 14000, 14000, 14200, 14200],
  tofu:        [12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000, 12000],
  spinach:     [10000, 10500, 10000,  9500, 10000, 10000, 10000, 10000,  9500,  9500,  9000,  9000],
  kangkung:    [ 8000,  8000,  8500,  8000,  8000,  8000,  7500,  8000,  7500,  7000,  7000,  6500],
  long_beans:  [10000, 10000, 10500, 10000, 10000, 10000, 10000, 10000, 10000, 10500, 10500, 10500],
  carrots:     [12000, 12000, 12000, 12500, 12000, 12000, 12000, 12000, 12500, 12500, 12500, 12500],
  cabbage:     [ 8000,  8000,  8000,  8000,  8000,  8000,  8000,  8000,  8000,  8000,  8500,  8500],
  bananas:     [13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000, 13000],
  oranges:     [20000, 20000, 20500, 20000, 20000, 20000, 20000, 20000, 20000, 20000, 20500, 20500],
  cooking_oil: [17500, 17500, 17500, 17500, 17500, 17500, 17500, 17500, 17500, 17500, 17500, 17500],
};

export function buildPrices(today = DEMO_TODAY): PricePoint[] {
  const out: PricePoint[] = [];
  for (const [ingredientId, values] of Object.entries(PRICE_TABLE)) {
    PRICE_WEEKS.forEach((w, i) => {
      out.push({ ingredientId, weekStart: weekStart(today, w), priceRpPerKg: values[i], source: "PLACEHOLDER" });
    });
  }
  return out;
}

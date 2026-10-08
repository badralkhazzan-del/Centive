import type { Ingredient, LocalizedText } from "@/types";
import { formatRp, formatWeeks } from "./format";
import { priceForWeek, trailingAverage, type PriceIndex } from "./priceBand";

// 6.5 Price Shield. An alert is raised for an ingredient and week when either
//   - the market price is >= 10% above its 4-week moving average, or
//   - the kitchens' demand is > 25% of the estimated local weekly supply
//     (member farmer capacity + a market supply estimate).
// Suggested actions: spread purchases across 2 weeks, source part from a neighbor
// Kopdes, or open the Menu Switch.

export type ShieldKind = "price_rise" | "demand_share";
export type ShieldAction = "spread" | "neighbor" | "menu_switch";

export interface ShieldAlert {
  id: string;
  ingredientId: string;
  week: number;
  kind: ShieldKind;
  price: number;
  movingAverage: number;
  priceRisePct: number;
  demandKg: number;
  supplyKg: number;
  demandSharePct: number;
  actions: ShieldAction[];
  why: LocalizedText;
  sparkline: { week: number; price: number }[];
}

export interface ShieldInput {
  today: string;
  weeks: number[];
  ingredients: Ingredient[];
  prices: PriceIndex;
  priceRiseThreshold: number;
  demandShareThreshold: number;
  /** Kitchens' total weekly demand (kg) per ingredient and week. */
  demandKg: (ingredientId: string, week: number) => number;
  /** Member farmer capacity, kg per week. */
  memberCapacityKg: (ingredientId: string) => number;
  marketSupplyKg: (ingredientId: string) => number;
}

export function sparklineFor(prices: PriceIndex, ingredientId: string, today: string, week: number) {
  return Array.from({ length: 8 }, (_, i) => {
    const w = week - 7 + i;
    return { week: w, price: priceForWeek(prices, ingredientId, today, w) };
  });
}

export function priceShieldAlerts(input: ShieldInput): ShieldAlert[] {
  const alerts: ShieldAlert[] = [];
  for (const ing of input.ingredients) {
    if (!input.prices.has(ing.id)) continue;
    for (const week of input.weeks) {
      const price = priceForWeek(input.prices, ing.id, input.today, week);
      const ma = trailingAverage(input.prices, ing.id, input.today, week);
      const rise = ma > 0 ? price / ma - 1 : 0;
      const demand = input.demandKg(ing.id, week);
      const supply = input.memberCapacityKg(ing.id) + input.marketSupplyKg(ing.id);
      const share = supply > 0 ? demand / supply : 0;
      const kinds: ShieldKind[] = [];
      if (rise >= input.priceRiseThreshold - 1e-9) kinds.push("price_rise");
      if (demand > 0 && share > input.demandShareThreshold + 1e-9) kinds.push("demand_share");
      for (const kind of kinds) {
        alerts.push({
          id: `shield-${ing.id}-${week}-${kind}`,
          ingredientId: ing.id,
          week,
          kind,
          price,
          movingAverage: ma,
          priceRisePct: rise,
          demandKg: demand,
          supplyKg: supply,
          demandSharePct: share,
          actions: kind === "price_rise" ? ["spread", "neighbor", "menu_switch"] : ["neighbor", "spread", "menu_switch"],
          why: whyText(ing, kind, rise, share, price, ma, week),
          sparkline: sparklineFor(input.prices, ing.id, input.today, week),
        });
      }
    }
  }
  return alerts;
}

function whyText(ing: Ingredient, kind: ShieldKind, rise: number, share: number, price: number, ma: number, week: number): LocalizedText {
  if (kind === "price_rise") {
    const p = Math.round(rise * 100);
    return {
      en: `${ing.nameEn} is expected at ${formatRp(price, "en")}/kg in week ${week}, ${p}% above its 4-week average (${formatRp(ma, "en")}).`,
      id: `${ing.nameId} diperkirakan ${formatRp(price, "id")}/kg pada minggu ${week}, ${p}% di atas rata-rata 4 minggu (${formatRp(ma, "id")}).`,
    };
  }
  const s = Math.round(share * 100);
  return {
    en: `Kitchens need ${s}% of the estimated local ${ing.nameEn.toLowerCase()} supply in week ${week}, so buying all at once can push prices up.`,
    id: `Kebutuhan dapur mencapai ${s}% dari perkiraan pasokan ${ing.nameId.toLowerCase()} lokal pada minggu ${week}, sehingga membeli sekaligus bisa menaikkan harga.`,
  };
}

export interface GroupedAlert {
  ingredientId: string;
  kind: ShieldKind;
  weeks: number[];
  first: ShieldAlert;
  worst: ShieldAlert;
  why: LocalizedText;
}

/** One card per ingredient and kind (weeks merged), price alerts first. */
export function groupAlerts(alerts: ShieldAlert[], ingredientsById: Map<string, Ingredient>): GroupedAlert[] {
  const map = new Map<string, ShieldAlert[]>();
  for (const a of alerts) {
    const k = `${a.ingredientId}|${a.kind}`;
    map.set(k, [...(map.get(k) ?? []), a]);
  }
  const out: GroupedAlert[] = [];
  for (const list of map.values()) {
    const sorted = [...list].sort((a, b) => a.week - b.week);
    const worst = [...list].sort((a, b) =>
      a.kind === "price_rise" ? b.priceRisePct - a.priceRisePct : b.demandSharePct - a.demandSharePct,
    )[0];
    const ing = ingredientsById.get(worst.ingredientId)!;
    const weeks = sorted.map((a) => a.week);
    const why: LocalizedText =
      worst.kind === "demand_share" && weeks.length > 1
        ? {
            en: `Kitchens need up to ${Math.round(worst.demandSharePct * 100)}% of the estimated local ${ing.nameEn.toLowerCase()} supply (${formatWeeks(weeks, "en")}), so buying all at once can push prices up.`,
            id: `Kebutuhan dapur mencapai ${Math.round(worst.demandSharePct * 100)}% dari perkiraan pasokan ${ing.nameId.toLowerCase()} lokal (${formatWeeks(weeks, "id")}), sehingga membeli sekaligus bisa menaikkan harga.`,
          }
        : worst.why;
    out.push({ ingredientId: worst.ingredientId, kind: worst.kind, weeks, first: sorted[0], worst, why });
  }
  return out.sort((a, b) => (a.kind === b.kind ? a.first.week - b.first.week : a.kind === "price_rise" ? -1 : 1));
}

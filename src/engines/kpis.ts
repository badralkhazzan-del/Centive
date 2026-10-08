import { cellOf } from "./forecast";
import type { Derived } from "./derive";
import { HISTORY_WEEKS, LEFTOVER_VALUE, PLANNING_WEEKS } from "./derive";
import { settlementPrice } from "./priceBand";
import { addDays, weekStart } from "./time";

// Regency Impact Dashboard indicators, all computed from the derived state.

export interface WeekShare {
  week: number;
  localSpend: number;
  totalSpend: number;
  share: number;
}

export interface RegencyKpis {
  localShare: number;
  weekly: WeekShare[];
  retainedRp: number;
  farmersEngaged: number;
  womenPct: number;
  youthPct: number;
  fillRate: number;
  avgDaysToPay: number | null;
  mape: number | null;
  priceAlerts: number;
  leftoverByWeek: { week: number; value: number }[];
  leftoverLatest: number | null;
}

export function regencyKpis(d: Derived): RegencyKpis {
  const weekly: WeekShare[] = PLANNING_WEEKS.map((week) => {
    let totalSpend = 0;
    for (const k of d.data.kitchens) {
      const table = d.kitchenTables.get(k.id);
      if (!table) continue;
      for (const [ingId] of table) totalSpend += cellOf(table, ingId, week).kgExpected * d.price(ingId, week);
    }
    let localSpend = 0;
    for (const kd of d.data.kopdes) {
      for (const ingId of d.kopdesCommodities.get(kd.id) ?? []) {
        const c = d.coverage(kd.id, ingId, week);
        const kg = Math.min(c.committed, c.needed);
        if (kg <= 0) continue;
        localSpend += kg * settlementPrice(d.commitmentBand(ingId), d.price(ingId, week));
      }
    }
    return { week, localSpend, totalSpend, share: totalSpend > 0 ? localSpend / totalSpend : 0 };
  });
  const total = weekly.reduce((s, w) => s + w.totalSpend, 0);
  const local = weekly.reduce((s, w) => s + w.localSpend, 0);

  let needed = 0;
  let filled = 0;
  for (const kd of d.data.kopdes) {
    for (const ingId of d.kopdesCommodities.get(kd.id) ?? []) {
      for (const w of [1, 2, 3, 4]) {
        const c = d.coverage(kd.id, ingId, w);
        needed += c.needed;
        filled += Math.min(c.committed, c.needed);
      }
    }
  }

  const alertKeys = new Set<string>();
  for (const alerts of d.shieldAlerts.values()) for (const a of alerts) if (a.week >= 1 && a.week <= 4) alertKeys.add(`${a.ingredientId}|${a.kind}`);

  const leftoverByWeek = [...HISTORY_WEEKS, 0]
    .map((week) => {
      const from = weekStart(d.today, week);
      const to = addDays(from, 6);
      const rows = d.data.plateFeedback.filter((p) => p.date >= from && p.date <= to);
      return { week, value: rows.length ? rows.reduce((s, r) => s + LEFTOVER_VALUE[r.leftover], 0) / rows.length : NaN };
    })
    .filter((x) => !Number.isNaN(x.value));

  return {
    localShare: total > 0 ? local / total : 0,
    weekly,
    retainedRp: local,
    farmersEngaged: d.inclusion.farmers,
    womenPct: d.inclusion.womenPct,
    youthPct: d.inclusion.youthPct,
    fillRate: needed > 0 ? filled / needed : 0,
    avgDaysToPay: d.avgDaysToFarmerPayment,
    mape: d.regionalMape,
    priceAlerts: alertKeys.size,
    leftoverByWeek,
    leftoverLatest: leftoverByWeek.length ? leftoverByWeek[leftoverByWeek.length - 1].value : null,
  };
}

/** Coverage of a kitchen's orders from one Kopdes over some weeks (0..1). */
export function linkCoverage(d: Derived, kitchenId: string, kopdesId: string, weeks: number[]): number {
  const k = d.kitchensById.get(kitchenId);
  const table = d.kitchenTables.get(kitchenId);
  if (!k || !table) return 0;
  const share = k.kopdesOrderShare[kopdesId] ?? 0;
  let ordered = 0;
  let covered = 0;
  for (const ingId of d.kopdesCommodities.get(kopdesId) ?? []) {
    for (const w of weeks) {
      const order = cellOf(table, ingId, w).kgExpected * share;
      if (order <= 0) continue;
      ordered += order;
      covered += order * Math.min(1, d.coverage(kopdesId, ingId, w).pct);
    }
  }
  return ordered > 0 ? covered / ordered : 0;
}

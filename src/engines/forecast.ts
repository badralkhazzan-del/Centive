import type { DemandForecast, Dish, Ingredient, Kitchen, MenuCycle, MenuOverride } from "@/types";
import { allComponents, resolveDay, type ResolvedDay } from "./menu";
import { purchaseQty } from "./nutrition";

// 6.1 Menu-to-Field Forecast.
//   rawKg      = sum over operating days, dishes, components of
//                gramsPerPortion[size] x beneficiaries[size] x attendance / edibleFraction / 1000
//   kgExpected = rawKg x (1 + safetyBuffer)
//   kgLow      = rawKg with attendance - 0.05
//   kgHigh     = rawKg with attendance + 0.03, x (1 + safetyBuffer)
// Quantities are in the ingredient's unit (kg, or L for cooking oil).

export interface ForecastContext {
  today: string;
  kitchen: Kitchen;
  cycle: MenuCycle;
  dishesById: Map<string, Dish>;
  ingredientsById: Map<string, Ingredient>;
  overrides: MenuOverride[];
  safetyBuffer: number;
}

export const ATTENDANCE_LOW_DELTA = 0.05;
export const ATTENDANCE_HIGH_DELTA = 0.03;

/** Portions served on one day (both sizes), or 0 on a holiday. */
export function portionsExpected(kitchen: Kitchen, day: Pick<ResolvedDay, "operating">, attendance = kitchen.attendanceRate) {
  if (!day.operating) return 0;
  return (kitchen.beneficiaries.small + kitchen.beneficiaries.large) * attendance;
}

/** Raw purchase quantity per ingredient for one resolved day at a given attendance. */
export function rawQtyForDay(
  day: ResolvedDay,
  kitchen: Kitchen,
  attendance: number,
  ingredientsById: Map<string, Ingredient>,
): Map<string, number> {
  const out = new Map<string, number>();
  if (!day.operating) return out;
  for (const c of allComponents(day)) {
    const ing = ingredientsById.get(c.ingredientId);
    if (!ing) continue;
    const qty =
      purchaseQty(ing, c.grams.small) * kitchen.beneficiaries.small * attendance +
      purchaseQty(ing, c.grams.large) * kitchen.beneficiaries.large * attendance;
    out.set(c.ingredientId, (out.get(c.ingredientId) ?? 0) + qty);
  }
  return out;
}

export function resolveWeekDays(ctx: ForecastContext, week: number): ResolvedDay[] {
  return [0, 1, 2, 3, 4].map((dow) =>
    resolveDay(ctx.kitchen, ctx.cycle, ctx.dishesById, ctx.overrides, ctx.today, week, dow),
  );
}

export function forecastKitchenWeek(ctx: ForecastContext, week: number): DemandForecast[] {
  const att = ctx.kitchen.attendanceRate;
  const attLow = Math.max(0, att - ATTENDANCE_LOW_DELTA);
  const attHigh = Math.min(1, att + ATTENDANCE_HIGH_DELTA);
  const expected = new Map<string, number>();
  const low = new Map<string, number>();
  const high = new Map<string, number>();
  const add = (m: Map<string, number>, src: Map<string, number>) => {
    for (const [k, v] of src) m.set(k, (m.get(k) ?? 0) + v);
  };
  for (const day of resolveWeekDays(ctx, week)) {
    add(expected, rawQtyForDay(day, ctx.kitchen, att, ctx.ingredientsById));
    add(low, rawQtyForDay(day, ctx.kitchen, attLow, ctx.ingredientsById));
    add(high, rawQtyForDay(day, ctx.kitchen, attHigh, ctx.ingredientsById));
  }
  const buffer = 1 + ctx.safetyBuffer;
  return [...expected.keys()].map((ingredientId) => ({
    kitchenId: ctx.kitchen.id,
    ingredientId,
    week,
    kgExpected: (expected.get(ingredientId) ?? 0) * buffer,
    kgLow: low.get(ingredientId) ?? 0,
    kgHigh: (high.get(ingredientId) ?? 0) * buffer,
  }));
}

export function forecastKitchen(ctx: ForecastContext, weeks: number[]): DemandForecast[] {
  return weeks.flatMap((w) => forecastKitchenWeek(ctx, w));
}

export interface DemandCell {
  kgExpected: number;
  kgLow: number;
  kgHigh: number;
}

/** demand[ingredientId][week] */
export type DemandTable = Map<string, Map<number, DemandCell>>;

export function emptyCell(): DemandCell {
  return { kgExpected: 0, kgLow: 0, kgHigh: 0 };
}

export function addToTable(table: DemandTable, f: DemandForecast, factor = 1) {
  let byWeek = table.get(f.ingredientId);
  if (!byWeek) {
    byWeek = new Map();
    table.set(f.ingredientId, byWeek);
  }
  const cell = byWeek.get(f.week) ?? emptyCell();
  cell.kgExpected += f.kgExpected * factor;
  cell.kgLow += f.kgLow * factor;
  cell.kgHigh += f.kgHigh * factor;
  byWeek.set(f.week, cell);
}

export function tableFrom(forecasts: DemandForecast[]): DemandTable {
  const t: DemandTable = new Map();
  for (const f of forecasts) addToTable(t, f);
  return t;
}

/**
 * Aggregate the orders a Kopdes receives: each linked kitchen's forecast times the
 * share of its local demand that it orders from this Kopdes.
 */
export function aggregateForKopdes(
  kopdesId: string,
  kitchens: Kitchen[],
  forecastsByKitchen: Map<string, DemandForecast[]>,
  ingredientFilter?: (ingredientId: string) => boolean,
): DemandTable {
  const table: DemandTable = new Map();
  for (const k of kitchens) {
    if (!k.linkedKopdesIds.includes(kopdesId)) continue;
    const share = k.kopdesOrderShare[kopdesId] ?? 0;
    if (share <= 0) continue;
    for (const f of forecastsByKitchen.get(k.id) ?? []) {
      if (ingredientFilter && !ingredientFilter(f.ingredientId)) continue;
      addToTable(table, f, share);
    }
  }
  return table;
}

export function cellOf(table: DemandTable, ingredientId: string, week: number): DemandCell {
  return table.get(ingredientId)?.get(week) ?? emptyCell();
}

/** Mean absolute percentage error, as a fraction (0.06 = 6%). Pairs with actual 0 are skipped. */
export function mape(pairs: { forecast: number; actual: number }[]): number | null {
  const valid = pairs.filter((p) => p.actual > 0);
  if (valid.length === 0) return null;
  return valid.reduce((s, p) => s + Math.abs(p.actual - p.forecast) / p.actual, 0) / valid.length;
}

import type {
  AppData,
  Batch,
  CommitmentBand,
  DemandForecast,
  Dish,
  Farmer,
  Ingredient,
  Kitchen,
  Kopdes,
  LocalizedText,
  MenuCycle,
  Payment,
  PriceBand,
  SubstitutionSuggestion,
} from "@/types";
import { aggregateForKopdes, cellOf, forecastKitchen, mape, tableFrom, type DemandTable } from "./forecast";
import { formatPct, formatRp } from "./format";
import { ACTIVE_STATUSES, committedKg, coverageStatus, heldByFarmer, inclusionSummary, type CoverageStatus, type InclusionSummary } from "./matching";
import { resolveDay } from "./menu";
import { averageDaysToFarmerPayment, paymentStatus, type PaymentStatus } from "./payment";
import { commitmentBand, indexPrices, priceBand, priceForWeek, type BandPct, type PriceIndex } from "./priceBand";
import { groupAlerts, priceShieldAlerts, type GroupedAlert, type ShieldAlert } from "./priceShield";
import { DEFAULT_ACCEPTANCE, suggestForTrigger, suggestionKey, type SubstitutionContext, type Trigger } from "./substitution";
import { addDays, daysBetween, isoAt, weekStart } from "./time";

// Everything the screens need, computed from the persisted AppData by pure
// functions. The UI memoizes one Derived object per state snapshot.

export const PLANNING_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];
export const HISTORY_WEEKS = [-4, -3, -2, -1];

export interface CoverageCell {
  needed: number;
  committed: number;
  offered: number;
  pct: number;
  offeredPct: number;
  status: CoverageStatus;
}

export const LEFTOVER_VALUE = { none: 0, quarter: 0.25, half: 0.5, most: 0.85 } as const;

export interface PaymentRow {
  payment: Payment;
  batch: Batch | undefined;
  status: PaymentStatus;
}

export interface Derived {
  data: AppData;
  today: string;
  nowIso: string;
  ingredientsById: Map<string, Ingredient>;
  dishesById: Map<string, Dish>;
  farmersById: Map<string, Farmer>;
  kitchensById: Map<string, Kitchen>;
  kopdesById: Map<string, Kopdes>;
  cyclesByKitchen: Map<string, MenuCycle>;
  priceIdx: PriceIndex;
  bandPct: BandPct;
  forecasts: Map<string, DemandForecast[]>;
  kitchenTables: Map<string, DemandTable>;
  kopdesCommodities: Map<string, string[]>;
  kopdesDemand: Map<string, DemandTable>;
  kopdesFullDemand: Map<string, DemandTable>;
  coverage: (kopdesId: string, ingredientId: string, week: number) => CoverageCell;
  windowCoverage: (kopdesId: string, ingredientId: string, weeks: number[]) => CoverageCell;
  kitchenCoverage: (kitchenId: string, ingredientId: string, week: number) => CoverageCell | null;
  commitmentBand: (ingredientId: string) => CommitmentBand;
  weekBand: (ingredientId: string, week: number) => PriceBand;
  price: (ingredientId: string, week: number) => number;
  shieldAlerts: Map<string, ShieldAlert[]>;
  shieldGroups: Map<string, GroupedAlert[]>;
  suggestions: Map<string, SubstitutionSuggestion[]>;
  acceptance: (kitchenId: string, ingredientId: string) => number;
  spareCapacity: (farmerId: string, ingredientId: string, weeks: number[]) => number;
  paymentRows: PaymentRow[];
  mapeByKitchen: Map<string, number | null>;
  regionalMape: number | null;
  inclusion: InclusionSummary;
  inclusionByKopdes: Map<string, InclusionSummary>;
  avgDaysToFarmerPayment: number | null;
  windowWeeks: number[];
}

function weightedLeftover(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function derive(data: AppData): Derived {
  const today = data.today;
  const nowIso = isoAt(today, "09:00");
  const ingredientsById = new Map(data.ingredients.map((i) => [i.id, i]));
  const dishesById = new Map(data.dishes.map((d) => [d.id, d]));
  const farmersById = new Map(data.farmers.map((f) => [f.id, f]));
  const kitchensById = new Map(data.kitchens.map((k) => [k.id, k]));
  const kopdesById = new Map(data.kopdes.map((k) => [k.id, k]));
  const cyclesByKitchen = new Map(data.menuCycles.map((c) => [c.kitchenId, c]));
  const priceIdx = indexPrices(data.prices);
  const bandPct: BandPct = { floorPct: data.settings.priceBandFloorPct, ceilingPct: data.settings.priceBandCeilingPct };
  const lead = data.settings.commitmentLeadWeeks;
  const windowWeeks = [lead + 1, lead + 2, lead + 3, lead + 4];

  // Forecasts per kitchen, history and planning weeks.
  const forecasts = new Map<string, DemandForecast[]>();
  const kitchenTables = new Map<string, DemandTable>();
  for (const k of data.kitchens) {
    const cycle = cyclesByKitchen.get(k.id);
    if (!cycle) continue;
    const f = forecastKitchen(
      { today, kitchen: k, cycle, dishesById, ingredientsById, overrides: data.overrides, safetyBuffer: data.settings.safetyBuffer },
      [...HISTORY_WEEKS, 0, ...PLANNING_WEEKS],
    );
    forecasts.set(k.id, f);
    kitchenTables.set(k.id, tableFrom(f));
  }

  // Commodities each Kopdes trades = what its consenting member farmers produce.
  const kopdesCommodities = new Map<string, string[]>();
  for (const kd of data.kopdes) {
    const set = new Set<string>();
    for (const f of data.farmers) {
      if (f.kopdesId !== kd.id) continue;
      for (const c of f.commodities) if (c.weeklyCapacityKg > 0) set.add(c.ingredientId);
    }
    const order = data.ingredients.map((i) => i.id);
    kopdesCommodities.set(kd.id, [...set].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  }

  const kopdesDemand = new Map<string, DemandTable>();
  const kopdesFullDemand = new Map<string, DemandTable>();
  for (const kd of data.kopdes) {
    const commodities = new Set(kopdesCommodities.get(kd.id));
    kopdesDemand.set(kd.id, aggregateForKopdes(kd.id, data.kitchens, forecasts, (id) => commodities.has(id)));
    const linked = data.kitchens.filter((k) => k.linkedKopdesIds.includes(kd.id));
    const full: DemandTable = new Map();
    for (const k of linked) {
      for (const f of forecasts.get(k.id) ?? []) {
        const byWeek = full.get(f.ingredientId) ?? new Map();
        const cell = byWeek.get(f.week) ?? { kgExpected: 0, kgLow: 0, kgHigh: 0 };
        cell.kgExpected += f.kgExpected;
        cell.kgLow += f.kgLow;
        cell.kgHigh += f.kgHigh;
        byWeek.set(f.week, cell);
        full.set(f.ingredientId, byWeek);
      }
    }
    kopdesFullDemand.set(kd.id, full);
  }

  const OFFERED = new Set(["offered"]);
  const covCache = new Map<string, CoverageCell>();
  const makeCell = (needed: number, committed: number, offered: number): CoverageCell => {
    const pct = needed > 0 ? committed / needed : 0;
    return {
      needed,
      committed,
      offered,
      pct,
      offeredPct: needed > 0 ? offered / needed : 0,
      status: coverageStatus(pct, needed),
    };
  };
  const coverage = (kopdesId: string, ingredientId: string, week: number): CoverageCell => {
    const key = `${kopdesId}|${ingredientId}|${week}`;
    const hit = covCache.get(key);
    if (hit) return hit;
    const needed = cellOf(kopdesDemand.get(kopdesId) ?? new Map(), ingredientId, week).kgExpected;
    const committed = committedKg(data.commitments, kopdesId, ingredientId, week, ACTIVE_STATUSES);
    const offered = committedKg(data.commitments, kopdesId, ingredientId, week, OFFERED);
    const cell = makeCell(needed, committed, offered);
    covCache.set(key, cell);
    return cell;
  };
  const windowCoverage = (kopdesId: string, ingredientId: string, weeks: number[]): CoverageCell => {
    let needed = 0;
    let committed = 0;
    let offered = 0;
    for (const w of weeks) {
      const c = coverage(kopdesId, ingredientId, w);
      needed += c.needed;
      committed += c.committed;
      offered += c.offered;
    }
    return makeCell(needed, committed, offered);
  };
  const kitchenCoverage = (kitchenId: string, ingredientId: string, week: number): CoverageCell | null => {
    const k = kitchensById.get(kitchenId);
    if (!k) return null;
    const demand = cellOf(kitchenTables.get(kitchenId) ?? new Map(), ingredientId, week).kgExpected;
    let ordered = 0;
    let covered = 0;
    let offered = 0;
    for (const kdId of k.linkedKopdesIds) {
      if (!kopdesCommodities.get(kdId)?.includes(ingredientId)) continue;
      const share = k.kopdesOrderShare[kdId] ?? 0;
      const order = demand * share;
      const c = coverage(kdId, ingredientId, week);
      ordered += order;
      covered += order * Math.min(1, c.pct);
      offered += order * Math.min(1, c.offeredPct);
    }
    if (ordered <= 0) return null;
    return makeCell(ordered, covered, offered);
  };

  const bandCache = new Map<string, CommitmentBand>();
  const band = (ingredientId: string) => {
    let b = bandCache.get(ingredientId);
    if (!b) {
      b = commitmentBand(priceIdx, ingredientId, today, bandPct);
      bandCache.set(ingredientId, b);
    }
    return b;
  };
  const weekBand = (ingredientId: string, week: number) => priceBand(priceIdx, ingredientId, today, week, bandPct);
  const price = (ingredientId: string, week: number) => priceForWeek(priceIdx, ingredientId, today, week);

  // Spare capacity of a farmer (capacity minus everything held or offered, any Kopdes).
  const spareCapacity = (farmerId: string, ingredientId: string, weeks: number[]) => {
    const f = farmersById.get(farmerId);
    const cap = f?.commodities.find((c) => c.ingredientId === ingredientId)?.weeklyCapacityKg ?? 0;
    return Math.max(0, cap - heldByFarmer(data.commitments, farmerId, ingredientId, weeks));
  };

  // Price Shield per Kopdes.
  const shieldAlerts = new Map<string, ShieldAlert[]>();
  const shieldGroups = new Map<string, GroupedAlert[]>();
  for (const kd of data.kopdes) {
    const full = kopdesFullDemand.get(kd.id)!;
    const members = data.farmers.filter((f) => f.kopdesId === kd.id && f.consentGiven);
    const alerts = priceShieldAlerts({
      today,
      weeks: PLANNING_WEEKS,
      ingredients: data.ingredients.filter((i) => kopdesCommodities.get(kd.id)?.includes(i.id)),
      prices: priceIdx,
      priceRiseThreshold: data.settings.shieldPriceRisePct,
      demandShareThreshold: data.settings.shieldDemandSharePct,
      demandKg: (id, w) => cellOf(full, id, w).kgExpected,
      memberCapacityKg: (id) =>
        members.reduce((s, f) => s + (f.commodities.find((c) => c.ingredientId === id)?.weeklyCapacityKg ?? 0), 0),
      marketSupplyKg: (id) => data.settings.marketSupplyKgPerWeek[id] ?? 0,
    });
    shieldAlerts.set(kd.id, alerts);
    shieldGroups.set(kd.id, groupAlerts(alerts, ingredientsById));
  }

  // Child acceptance from Plate Feedback.
  const acceptanceCache = new Map<string, number>();
  const acceptance = (kitchenId: string, ingredientId: string) => {
    const key = `${kitchenId}|${ingredientId}`;
    const hit = acceptanceCache.get(key);
    if (hit !== undefined) return hit;
    const dishIds = new Set(data.dishes.filter((d) => d.mainIngredientId === ingredientId).map((d) => d.id));
    let rows = data.plateFeedback.filter((p) => p.kitchenId === kitchenId && dishIds.has(p.dishId));
    if (rows.length === 0) rows = data.plateFeedback.filter((p) => dishIds.has(p.dishId));
    const value = rows.length === 0 ? DEFAULT_ACCEPTANCE : 1 - weightedLeftover(rows.map((r) => LEFTOVER_VALUE[r.leftover]));
    acceptanceCache.set(key, value);
    return value;
  };

  const canonicalDish = (ingredientId: string) => data.dishes.find((d) => d.mainIngredientId === ingredientId);

  // Harvest-Aware Menu Switch: triggers and suggestions per kitchen.
  const decided = new Set(data.decisions.map((d) => d.key));
  const suggestions = new Map<string, SubstitutionSuggestion[]>();
  for (const k of data.kitchens) {
    const cycle = cyclesByKitchen.get(k.id);
    if (!cycle) continue;
    const orderShare = k.linkedKopdesIds.reduce((s, id) => s + (k.kopdesOrderShare[id] ?? 0), 0);
    const ctx: SubstitutionContext = {
      today,
      kitchen: k,
      cycle,
      dishesById,
      ingredientsById,
      overrides: data.overrides,
      settings: data.settings.substitution,
      safetyBuffer: data.settings.safetyBuffer,
      price,
      orderShare,
      acceptance: (id) => acceptance(k.id, id),
      canonicalDish,
      supply: (ingredientId, week) => {
        let availableKg = 0;
        const farmerIds = new Set<string>();
        for (const kdId of k.linkedKopdesIds) {
          const kd = kopdesById.get(kdId);
          if (!kd) continue;
          for (const fid of kd.memberFarmerIds) {
            const f = farmersById.get(fid);
            if (!f?.consentGiven) continue;
            const cap = f.commodities.find((c) => c.ingredientId === ingredientId)?.weeklyCapacityKg ?? 0;
            if (cap <= 0) continue;
            farmerIds.add(fid);
            availableKg += spareCapacity(fid, ingredientId, [week]);
          }
          const c = coverage(kdId, ingredientId, week);
          availableKg += Math.max(0, c.committed - c.needed);
        }
        return { availableKg, farmers: farmerIds.size };
      },
    };

    const triggers: Trigger[] = [];
    const seen = new Set<string>();
    const pushTrigger = (t: Trigger, dayIndex: number) => {
      const key = suggestionKey(k.id, t.week, dayIndex, t.fromDishId, t.reason);
      if (decided.has(key) || seen.has(key)) return;
      seen.add(key);
      triggers.push(t);
    };
    const eligibleDays = (week: number) =>
      [0, 1, 2, 3, 4]
        .map((dow) => resolveDay(k, cycle, dishesById, data.overrides, today, week, dow))
        .filter((d) => d.operating && !d.override && daysBetween(today, d.date) >= data.settings.substitution.leadTimeDays);

    for (const week of PLANNING_WEEKS) {
      const days = eligibleDays(week);
      // Price above the band ceiling.
      const mains = new Set(days.flatMap((d) => d.dishes.map((x) => dishesById.get(x.dishId)?.mainIngredientId ?? "")));
      for (const ingId of mains) {
        const ing = ingredientsById.get(ingId);
        if (!ing || ing.foodGroup === "staple" || ing.foodGroup === "fat") continue;
        const b = weekBand(ingId, week);
        if (b.marketPrice <= b.ceiling) continue;
        const rise = b.marketPrice / b.ref - 1;
        const why: LocalizedText = {
          en: `${ing.nameEn} is expected ${formatPct(rise, "en")} above its 4-week average and above the week-${week} price band (ceiling ${formatRp(b.ceiling, "en")}/kg).`,
          id: `Harga ${ing.nameId.toLowerCase()} diperkirakan ${formatPct(rise, "id")} di atas rata-rata 4 minggu dan melewati batas atas pita harga minggu ${week} (${formatRp(b.ceiling, "id")}/kg).`,
        };
        for (const d of days) {
          for (const rd of d.dishes) {
            const dish = dishesById.get(rd.dishId);
            if (!dish || dish.mainIngredientId !== ingId || cycle.lockedDishIds.includes(dish.id)) continue;
            pushTrigger({ week, dow: d.dow, fromDishId: dish.id, fromIngredientId: ingId, reason: "price_spike", why }, d.dayIndex);
          }
        }
      }
      // Shortage: the Kopdes asked for a Menu Switch (Backup Ladder, step c).
      for (const req of data.switchRequests) {
        if (!k.linkedKopdesIds.includes(req.kopdesId) || !req.weeks.includes(week)) continue;
        const c = coverage(req.kopdesId, req.ingredientId, week);
        if (c.needed <= 0 || c.pct >= 1) continue;
        const ing = ingredientsById.get(req.ingredientId)!;
        const why: LocalizedText = {
          en: `${ing.nameEn} is only ${formatPct(c.pct, "en")} covered by member farmers in week ${week}.`,
          id: `${ing.nameId} baru terpenuhi ${formatPct(c.pct, "id")} oleh petani anggota pada minggu ${week}.`,
        };
        const affected = days.filter((d) =>
          d.dishes.some((x) => dishesById.get(x.dishId)?.mainIngredientId === req.ingredientId && !cycle.lockedDishIds.includes(x.dishId)),
        );
        const n = Math.max(1, Math.ceil((1 - c.pct) * affected.length));
        for (const d of affected.slice(0, n)) {
          const dish = d.dishes.map((x) => dishesById.get(x.dishId)!).find((x) => x.mainIngredientId === req.ingredientId)!;
          pushTrigger({ week, dow: d.dow, fromDishId: dish.id, fromIngredientId: req.ingredientId, reason: "shortage", why }, d.dayIndex);
        }
      }
    }

    const list: SubstitutionSuggestion[] = [];
    for (const t of triggers) {
      const s = suggestForTrigger(ctx, t);
      if (s) list.push(s);
    }

    // Surplus: committed supply >= 120% of demand for a seasonal item.
    for (const week of PLANNING_WEEKS) {
      const days = eligibleDays(week);
      for (const kdId of k.linkedKopdesIds) {
        for (const ingId of kopdesCommodities.get(kdId) ?? []) {
          const ing = ingredientsById.get(ingId);
          if (!ing?.seasonal) continue;
          const c = coverage(kdId, ingId, week);
          if (c.needed <= 0 || c.pct < data.settings.substitution.surplusThreshold) continue;
          const why: LocalizedText = {
            en: `Member farmers committed ${formatPct(c.pct, "en")} of the ${ing.nameEn.toLowerCase()} needed in week ${week} (harvest peak).`,
            id: `Petani anggota menyanggupi ${formatPct(c.pct, "id")} kebutuhan ${ing.nameId.toLowerCase()} pada minggu ${week} (panen raya).`,
          };
          let best: SubstitutionSuggestion | null = null;
          for (const d of days) {
            if (d.dishes.some((x) => dishesById.get(x.dishId)?.mainIngredientId === ingId)) continue;
            for (const rd of d.dishes) {
              const dish = dishesById.get(rd.dishId);
              const main = dish ? ingredientsById.get(dish.mainIngredientId) : undefined;
              if (!dish || !main || main.foodGroup !== ing.foodGroup || cycle.lockedDishIds.includes(dish.id)) continue;
              const key = suggestionKey(k.id, week, d.dayIndex, dish.id, "surplus");
              if (decided.has(key)) continue;
              const s = suggestForTrigger(ctx, {
                week,
                dow: d.dow,
                fromDishId: dish.id,
                fromIngredientId: main.id,
                reason: "surplus",
                why,
                onlyCandidateId: ingId,
              });
              if (s && (!best || s.scores.total > best.scores.total)) best = s;
            }
          }
          if (best && !list.some((x) => x.date === best!.date)) list.push(best);
        }
      }
    }

    const reasonOrder = { price_spike: 0, shortage: 1, surplus: 2 } as const;
    list.sort((a, b) => a.date.localeCompare(b.date) || reasonOrder[a.reason] - reasonOrder[b.reason]);
    suggestions.set(k.id, list);
  }

  // Payment Clock.
  const batchesById = new Map(data.batches.map((b) => [b.id, b]));
  const paymentRows: PaymentRow[] = data.payments
    .map((p) => {
      const batch = batchesById.get(p.batchId);
      const sla = batch ? (kitchensById.get(batch.kitchenId)?.paymentSlaDays ?? data.settings.paymentSlaDays) : data.settings.paymentSlaDays;
      return { payment: p, batch, status: paymentStatus(p, nowIso, sla) };
    })
    .sort((a, b) => b.payment.deliveredAt.localeCompare(a.payment.deliveredAt));

  // Forecast accuracy (MAPE): planned Kopdes order vs kg received, completed weeks.
  const mapeByKitchen = new Map<string, number | null>();
  const allPairs: { forecast: number; actual: number }[] = [];
  for (const k of data.kitchens) {
    const table = kitchenTables.get(k.id);
    const pairs: { forecast: number; actual: number }[] = [];
    const groups = new Map<string, number>();
    for (const b of data.batches) {
      if (b.kitchenId !== k.id || !b.deliveredAt || b.week >= 0) continue;
      const key = `${b.kopdesId}|${b.ingredientId}|${b.week}`;
      groups.set(key, (groups.get(key) ?? 0) + b.kg);
    }
    for (const [key, actual] of groups) {
      const [kdId, ingId, w] = key.split("|");
      const share = k.kopdesOrderShare[kdId] ?? 0;
      const forecast = cellOf(table ?? new Map(), ingId, Number(w)).kgExpected * share;
      pairs.push({ forecast, actual });
    }
    mapeByKitchen.set(k.id, mape(pairs));
    allPairs.push(...pairs);
  }

  const inclusion = inclusionSummary(data.commitments, farmersById);
  const inclusionByKopdes = new Map(
    data.kopdes.map((kd) => [kd.id, inclusionSummary(data.commitments.filter((c) => c.kopdesId === kd.id), farmersById)]),
  );

  return {
    data,
    today,
    nowIso,
    ingredientsById,
    dishesById,
    farmersById,
    kitchensById,
    kopdesById,
    cyclesByKitchen,
    priceIdx,
    bandPct,
    forecasts,
    kitchenTables,
    kopdesCommodities,
    kopdesDemand,
    kopdesFullDemand,
    coverage,
    windowCoverage,
    kitchenCoverage,
    commitmentBand: band,
    weekBand,
    price,
    shieldAlerts,
    shieldGroups,
    suggestions,
    acceptance,
    spareCapacity,
    paymentRows,
    mapeByKitchen,
    regionalMape: mape(allPairs),
    inclusion,
    inclusionByKopdes,
    avgDaysToFarmerPayment: averageDaysToFarmerPayment(data.payments),
    windowWeeks,
  };
}

/** Week label helpers used by several screens. */
export function weekRange(today: string, week: number) {
  const start = weekStart(today, week);
  return { start, end: addDays(start, 4) };
}

import type { Dish, Farmer, Ingredient, Kitchen, Kopdes, MenuCycle, MenuOverride, PlateFeedback, Settings } from "@/types";
import { rawQtyForDay } from "./forecast";
import { allocate, type MatchCandidate } from "./matching";
import { resolveDay, type ResolvedDay } from "./menu";
import { makeBand, settlementPrice } from "./priceBand";
import { gaussian, mulberry32 } from "./rng";
import { suggestForTrigger, toOverride, type SubstitutionContext, type Trigger } from "./substitution";

// 6.7 Simulation Lab. A deterministic, seeded 8-week simulation of the demo region
// (3 kitchens, 2 Kopdes, 18 farmers) comparing two strategies under the same shocks.
//
//   Baseline: weekly spot buying through middlemen; a fixed share (default 15%) of
//   local commodities is bought through the Kopdes at spot price. No forecast, no
//   substitution.
//   PiringTani: kitchens order a share of forecast demand from their Kopdes; farmers
//   commit through the matching engine (fairness cap); committed kg settle inside
//   the price band; Price Shield spreads spot purchases before a price spike; the
//   Menu Switch (the real substitution engine) reacts to spikes, shortages and surplus.
//
// Same seed, same inputs -> identical numbers (no Math.random, no clock).

export const SIM_WEEKS = [1, 2, 3, 4, 5, 6, 7, 8];
export const DEMO_VILLAGE_KOPDES = "kd-sumbangsari";

export interface SimulationParams {
  seed: number;
  baselineKopdesShare: number;
  chicken: { week: number; from: number; to: number };
  eggs: { week: number; shortfall: number };
  veg: { week: number; ingredientId: "spinach" | "kangkung"; surplus: number };
}

export const DEFAULT_SIM_PARAMS: SimulationParams = {
  seed: 2026,
  baselineKopdesShare: 0.15,
  chicken: { week: 3, from: 35000, to: 42000 },
  eggs: { week: 5, shortfall: 0.25 },
  veg: { week: 6, ingredientId: "kangkung", surplus: 0.4 },
};

/** Fixed model assumptions, all listed in the Assumptions panel. */
export const SIM_ASSUMPTIONS = {
  attendanceSd: 0.015,
  priceNoiseSd: 0.02,
  kopdesMargin: 0.08,
  shortagePriceRise: 0.12,
  surplusPriceDrop: 0.15,
  spreadShare: 0.5,
  partialDeliveryFactor: 0.7,
  bandFloorPct: 0.95,
  bandCeilingPct: 1.1,
  fairnessCapPct: 0.3,
} as const;

export interface SimulationInput {
  today: string;
  kitchens: Kitchen[];
  cycles: MenuCycle[];
  dishes: Dish[];
  ingredients: Ingredient[];
  farmers: Farmer[];
  kopdes: Kopdes[];
  plateFeedback: PlateFeedback[];
  settings: Settings;
  /** Normal (pre-shock) price per ingredient, Rp per unit. */
  basePrices: Record<string, number>;
}

export interface WeekPoint {
  week: number;
  localShare: number;
  costPerPortion: number;
  exposureCum: number;
  unmetPct: number;
}

export interface StrategyMetrics {
  localShare: number;
  unmetPct: number;
  costPerPortion: number;
  budgetPerPortion: number;
  priceExposureRp: number;
  farmerIncomeRp: number;
  farmersEngaged: number;
  womenShare: number;
  youthShare: number;
  compliance: number;
  totalSpendRp: number;
  portions: number;
  switches: number;
}

export interface StrategyResult {
  metrics: StrategyMetrics;
  weekly: WeekPoint[];
}

export interface SimulationResult {
  params: SimulationParams;
  baseline: StrategyResult;
  piringtani: StrategyResult;
}

const clampN = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

interface Env {
  attendance: Map<string, Map<number, number>>;
  normal: Map<string, Map<number, number>>;
  price: Map<string, Map<number, number>>;
}

function buildEnv(input: SimulationInput, p: SimulationParams): Env {
  const rng = mulberry32(p.seed);
  const attendance = new Map<string, Map<number, number>>();
  for (const k of input.kitchens) {
    const m = new Map<number, number>();
    for (const w of SIM_WEEKS) m.set(w, clampN(k.attendanceRate + gaussian(rng, SIM_ASSUMPTIONS.attendanceSd), 0.85, 0.98));
    attendance.set(k.id, m);
  }
  const normal = new Map<string, Map<number, number>>();
  const price = new Map<string, Map<number, number>>();
  for (const ing of input.ingredients) {
    const base = ing.id === "chicken" ? p.chicken.from : (input.basePrices[ing.id] ?? 0);
    const n = new Map<number, number>();
    const s = new Map<number, number>();
    for (const w of SIM_WEEKS) {
      const v = Math.round(base * (1 + gaussian(rng, SIM_ASSUMPTIONS.priceNoiseSd)));
      n.set(w, v);
      let shocked = v;
      if (ing.id === "chicken" && w === p.chicken.week) shocked = Math.round((p.chicken.to * v) / base);
      if (ing.id === "eggs" && w === p.eggs.week && p.eggs.shortfall > 0) shocked = Math.round(v * (1 + SIM_ASSUMPTIONS.shortagePriceRise));
      if (ing.id === p.veg.ingredientId && w === p.veg.week && p.veg.surplus > 0) shocked = Math.round(v * (1 - SIM_ASSUMPTIONS.surplusPriceDrop));
      s.set(w, shocked);
    }
    normal.set(ing.id, n);
    price.set(ing.id, s);
  }
  return { attendance, normal, price };
}

function kopdesCommodities(input: SimulationInput): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const kd of input.kopdes) {
    const set = new Set<string>();
    for (const f of input.farmers) if (f.kopdesId === kd.id) for (const c of f.commodities) if (c.weeklyCapacityKg > 0) set.add(c.ingredientId);
    out.set(kd.id, set);
  }
  return out;
}

/** Demand per kitchen, ingredient and week at the week's attendance (no buffer). */
function demandTable(input: SimulationInput, env: Env, overrides: MenuOverride[], dishesById: Map<string, Dish>, ingredientsById: Map<string, Ingredient>) {
  const t = new Map<string, Map<string, Map<number, number>>>(); // kitchen -> ing -> week -> qty
  const days = new Map<string, ResolvedDay[]>();
  for (const k of input.kitchens) {
    const cycle = input.cycles.find((c) => c.kitchenId === k.id)!;
    const byIng = new Map<string, Map<number, number>>();
    const kd: ResolvedDay[] = [];
    for (const w of SIM_WEEKS) {
      const att = env.attendance.get(k.id)!.get(w)!;
      for (let dow = 0; dow < 5; dow++) {
        const day = resolveDay(k, cycle, dishesById, overrides, input.today, w, dow);
        kd.push(day);
        for (const [ing, q] of rawQtyForDay(day, k, att, ingredientsById)) {
          const m = byIng.get(ing) ?? new Map<number, number>();
          m.set(w, (m.get(w) ?? 0) + q);
          byIng.set(ing, m);
        }
      }
    }
    t.set(k.id, byIng);
    days.set(k.id, kd);
  }
  return { table: t, days };
}

const get3 = (t: Map<string, Map<string, Map<number, number>>>, k: string, i: string, w: number) => t.get(k)?.get(i)?.get(w) ?? 0;

function portionsOf(input: SimulationInput, env: Env, days: Map<string, ResolvedDay[]>) {
  let portions = 0;
  let budget = 0;
  const byWeek = new Map<number, number>();
  for (const k of input.kitchens) {
    for (const d of days.get(k.id)!) {
      if (!d.operating) continue;
      const att = env.attendance.get(k.id)!.get(d.week)!;
      const p = (k.beneficiaries.small + k.beneficiaries.large) * att;
      portions += p;
      budget += (k.beneficiaries.small * 8000 + k.beneficiaries.large * 10000) * att;
      byWeek.set(d.week, (byWeek.get(d.week) ?? 0) + p);
    }
  }
  return { portions, budget, byWeek };
}

function seasoningSpend(input: SimulationInput, env: Env, days: Map<string, ResolvedDay[]>) {
  const byWeek = new Map<number, number>();
  for (const k of input.kitchens) {
    for (const d of days.get(k.id)!) {
      if (!d.operating) continue;
      const att = env.attendance.get(k.id)!.get(d.week)!;
      const v = (k.beneficiaries.small * k.seasoningCostRp.small + k.beneficiaries.large * k.seasoningCostRp.large) * att;
      byWeek.set(d.week, (byWeek.get(d.week) ?? 0) + v);
    }
  }
  return byWeek;
}

interface Ledger {
  spend: Map<number, number>;
  local: Map<number, number>;
  exposure: Map<number, number>;
  demand: Map<number, number>;
  unmet: Map<number, number>;
  farmerIncome: number;
  farmerKg: Map<string, number>;
  failingPortions: number;
}

function newLedger(): Ledger {
  return { spend: new Map(), local: new Map(), exposure: new Map(), demand: new Map(), unmet: new Map(), farmerIncome: 0, farmerKg: new Map(), failingPortions: 0 };
}

const addTo = (m: Map<number, number>, w: number, v: number) => m.set(w, (m.get(w) ?? 0) + v);

/** Portions on days whose main protein went partly unmet fail the protein rule. */
function failingFromUnmet(
  input: SimulationInput,
  env: Env,
  days: Map<string, ResolvedDay[]>,
  dishesById: Map<string, Dish>,
  unmetFraction: (kitchenId: string, ingredientId: string, week: number) => number,
): number {
  let failing = 0;
  for (const k of input.kitchens) {
    for (const d of days.get(k.id)!) {
      if (!d.operating) continue;
      const main = d.dishes.map((x) => dishesById.get(x.dishId)).find((x) => x && ["chicken", "eggs", "catfish", "tilapia"].includes(x.mainIngredientId));
      if (!main) continue;
      const f = unmetFraction(k.id, main.mainIngredientId, d.week);
      if (f <= 0) continue;
      failing += (k.beneficiaries.small + k.beneficiaries.large) * env.attendance.get(k.id)!.get(d.week)! * f;
    }
  }
  return failing;
}

function summarize(input: SimulationInput, env: Env, days: Map<string, ResolvedDay[]>, led: Ledger, engaged: Set<string>, switches: number): StrategyResult {
  const { portions, budget, byWeek } = portionsOf(input, env, days);
  const seasoning = seasoningSpend(input, env, days);
  const totalSpend = SIM_WEEKS.reduce((s, w) => s + (led.spend.get(w) ?? 0) + (seasoning.get(w) ?? 0), 0);
  const totalFood = SIM_WEEKS.reduce((s, w) => s + (led.spend.get(w) ?? 0), 0);
  const totalLocal = SIM_WEEKS.reduce((s, w) => s + (led.local.get(w) ?? 0), 0);
  const totalDemand = SIM_WEEKS.reduce((s, w) => s + (led.demand.get(w) ?? 0), 0);
  const totalUnmet = SIM_WEEKS.reduce((s, w) => s + (led.unmet.get(w) ?? 0), 0);
  const exposure = SIM_WEEKS.reduce((s, w) => s + (led.exposure.get(w) ?? 0), 0);
  const fs = [...engaged].map((id) => input.farmers.find((f) => f.id === id)!).filter(Boolean);
  let cum = 0;
  const weekly: WeekPoint[] = SIM_WEEKS.map((w) => {
    cum += led.exposure.get(w) ?? 0;
    const spend = led.spend.get(w) ?? 0;
    const p = byWeek.get(w) ?? 0;
    return {
      week: w,
      localShare: spend > 0 ? (led.local.get(w) ?? 0) / spend : 0,
      costPerPortion: p > 0 ? (spend + (seasoning.get(w) ?? 0)) / p : 0,
      exposureCum: cum,
      unmetPct: (led.demand.get(w) ?? 0) > 0 ? (led.unmet.get(w) ?? 0) / led.demand.get(w)! : 0,
    };
  });
  return {
    metrics: {
      localShare: totalFood > 0 ? totalLocal / totalFood : 0,
      unmetPct: totalDemand > 0 ? totalUnmet / totalDemand : 0,
      costPerPortion: portions > 0 ? totalSpend / portions : 0,
      budgetPerPortion: portions > 0 ? budget / portions : 0,
      priceExposureRp: exposure,
      farmerIncomeRp: led.farmerIncome,
      farmersEngaged: fs.length,
      womenShare: fs.length ? fs.filter((f) => f.gender === "female").length / fs.length : 0,
      youthShare: fs.length ? fs.filter((f) => f.ageGroup === "youth").length / fs.length : 0,
      compliance: portions > 0 ? 1 - led.failingPortions / portions : 1,
      totalSpendRp: totalSpend,
      portions,
      switches,
    },
    weekly,
  };
}

// ----- Baseline -----------------------------------------------------------------

function runBaseline(input: SimulationInput, p: SimulationParams, env: Env, dishesById: Map<string, Dish>, ingredientsById: Map<string, Ingredient>, commodities: Map<string, Set<string>>): StrategyResult {
  const { table, days } = demandTable(input, env, [], dishesById, ingredientsById);
  const led = newLedger();
  const engaged = new Set<string>();
  const shortfall = (ing: string, w: number) => (ing === "eggs" && w === p.eggs.week ? p.eggs.shortfall : 0);

  for (const w of SIM_WEEKS) {
    // Kopdes route: share of each local commodity, routed to the biggest farmers first.
    const routeKg = new Map<string, Map<string, number>>(); // kopdes -> ing -> kg
    for (const k of input.kitchens) {
      const shareSum = k.linkedKopdesIds.reduce((s, id) => s + (k.kopdesOrderShare[id] ?? 0), 0) || 1;
      for (const ing of input.ingredients) {
        const d = get3(table, k.id, ing.id, w);
        if (d <= 0) continue;
        const short = shortfall(ing.id, w);
        const got = d * (1 - short);
        const price = env.price.get(ing.id)!.get(w)!;
        const normal = env.normal.get(ing.id)!.get(w)!;
        addTo(led.demand, w, d);
        addTo(led.unmet, w, d - got);
        addTo(led.spend, w, got * price);
        addTo(led.exposure, w, got * Math.max(0, price - normal));
        for (const kdId of k.linkedKopdesIds) {
          if (!commodities.get(kdId)?.has(ing.id)) continue;
          const kg = got * p.baselineKopdesShare * ((k.kopdesOrderShare[kdId] ?? 0) / shareSum);
          addTo(led.local, w, kg * price);
          const m = routeKg.get(kdId) ?? new Map<string, number>();
          m.set(ing.id, (m.get(ing.id) ?? 0) + kg);
          routeKg.set(kdId, m);
        }
      }
    }
    for (const [kdId, byIng] of routeKg) {
      for (const [ingId, kg] of byIng) {
        let left = kg;
        const price = env.price.get(ingId)!.get(w)!;
        const pool = input.farmers
          .filter((f) => f.kopdesId === kdId && f.consentGiven)
          .map((f) => ({ f, cap: f.commodities.find((c) => c.ingredientId === ingId)?.weeklyCapacityKg ?? 0 }))
          .filter((x) => x.cap > 0)
          .sort((a, b) => b.cap - a.cap || a.f.id.localeCompare(b.f.id));
        for (const { f, cap } of pool) {
          if (left <= 0) break;
          const take = Math.min(cap, left);
          left -= take;
          engaged.add(f.id);
          if (kdId === DEMO_VILLAGE_KOPDES) led.farmerIncome += take * price * (1 - SIM_ASSUMPTIONS.kopdesMargin);
        }
      }
    }
  }
  led.failingPortions = failingFromUnmet(input, env, days, dishesById, (_k, ing, w) => shortfall(ing, w));
  return summarize(input, env, days, led, engaged, 0);
}

// ----- PiringTani ------------------------------------------------------------------

interface Alloc {
  farmerId: string;
  kopdesId: string;
  ingredientId: string;
  week: number;
  kg: number;
}

function allocateWeek(
  input: SimulationInput,
  orders: Map<string, Map<string, number>>, // kopdes -> ing -> kg
  week: number,
  capacityFactor: (ing: string) => number,
): Alloc[] {
  const out: Alloc[] = [];
  const held = new Map<string, number>(); // farmer|ing -> kg
  for (const kd of input.kopdes) {
    for (const [ingId, kg] of orders.get(kd.id) ?? new Map<string, number>()) {
      if (kg <= 0) continue;
      const pools: Farmer[][] = [
        input.farmers.filter((f) => f.kopdesId === kd.id),
        input.farmers.filter((f) => kd.neighborKopdesIds.includes(f.kopdesId)),
      ];
      let gap = kg;
      for (const pool of pools) {
        if (gap < 5) break;
        const candidates: MatchCandidate[] = pool.map((f) => {
          const cap = (f.commodities.find((c) => c.ingredientId === ingId)?.weeklyCapacityKg ?? 0) * capacityFactor(ingId);
          const h = held.get(`${f.id}|${ingId}`) ?? 0;
          const here = out.filter((a) => a.farmerId === f.id && a.kopdesId === kd.id && a.ingredientId === ingId).reduce((s, a) => s + a.kg, 0);
          return { farmerId: f.id, reliability: f.reliabilityScore, capacityKg: cap, heldAnywhereKg: h, heldHereKg: here, sameVillage: f.village === kd.village, consentGiven: f.consentGiven };
        });
        const r = allocate({ gapKg: gap, weeklyVolumeKg: kg, fairnessCapPct: SIM_ASSUMPTIONS.fairnessCapPct, candidates });
        for (const a of r.allocations) {
          out.push({ farmerId: a.farmerId, kopdesId: kd.id, ingredientId: ingId, week, kg: a.kg });
          held.set(`${a.farmerId}|${ingId}`, (held.get(`${a.farmerId}|${ingId}`) ?? 0) + a.kg);
        }
        gap -= r.allocatedKg;
      }
    }
  }
  return out;
}

function kopdesOrders(input: SimulationInput, table: Map<string, Map<string, Map<number, number>>>, commodities: Map<string, Set<string>>, week: number, buffer: number) {
  const orders = new Map<string, Map<string, number>>();
  for (const k of input.kitchens) {
    for (const kdId of k.linkedKopdesIds) {
      const share = k.kopdesOrderShare[kdId] ?? 0;
      for (const ingId of commodities.get(kdId) ?? []) {
        const d = get3(table, k.id, ingId, week);
        if (d <= 0) continue;
        const m = orders.get(kdId) ?? new Map<string, number>();
        m.set(ingId, (m.get(ingId) ?? 0) + d * share * (1 + buffer));
        orders.set(kdId, m);
      }
    }
  }
  return orders;
}

function runPiringTani(input: SimulationInput, p: SimulationParams, env: Env, dishesById: Map<string, Dish>, ingredientsById: Map<string, Ingredient>, commodities: Map<string, Set<string>>): StrategyResult {
  const buffer = input.settings.safetyBuffer;
  const capacityFactor = (w: number) => (ing: string) => {
    if (ing === "eggs" && w === p.eggs.week) return 1 - p.eggs.shortfall;
    if (ing === p.veg.ingredientId && w === p.veg.week) return 1 + p.veg.surplus;
    return 1;
  };

  // 1. Plan: forecast demand and commitments (forecast = expected attendance, no shocks known).
  const planEnv: Env = { ...env, attendance: new Map(input.kitchens.map((k) => [k.id, new Map(SIM_WEEKS.map((w) => [w, k.attendanceRate]))])) };
  const plan = demandTable(input, planEnv, [], dishesById, ingredientsById);
  const planned = new Map<number, Alloc[]>();
  for (const w of SIM_WEEKS) planned.set(w, allocateWeek(input, kopdesOrders(input, plan.table, commodities, w, buffer), w, () => 1));

  // 2. Menu Switch: shocks are seen one week ahead (Price Shield, farmer replies).
  const overrides: MenuOverride[] = [];
  const acceptance = (ingId: string) => {
    const dishIds = new Set(input.dishes.filter((d) => d.mainIngredientId === ingId).map((d) => d.id));
    const rows = input.plateFeedback.filter((r) => dishIds.has(r.dishId));
    if (!rows.length) return 0.7;
    const v = { none: 0, quarter: 0.25, half: 0.5, most: 0.85 } as const;
    return 1 - rows.reduce((s, r) => s + v[r.leftover], 0) / rows.length;
  };
  const extraHeld = new Map<string, number>(); // ing|week -> kg taken by switches
  const supply = (k: Kitchen) => (ingId: string, w: number) => {
    let availableKg = 0;
    const ids = new Set<string>();
    for (const kdId of k.linkedKopdesIds) {
      for (const f of input.farmers) {
        if (f.kopdesId !== kdId || !f.consentGiven) continue;
        const cap = (f.commodities.find((c) => c.ingredientId === ingId)?.weeklyCapacityKg ?? 0) * capacityFactor(w)(ingId);
        if (cap <= 0) continue;
        ids.add(f.id);
        const held = (planned.get(w) ?? []).filter((a) => a.farmerId === f.id && a.ingredientId === ingId).reduce((s, a) => s + a.kg, 0);
        availableKg += Math.max(0, cap - held);
      }
    }
    return { availableKg: Math.max(0, availableKg - (extraHeld.get(`${ingId}|${w}`) ?? 0)), farmers: ids.size };
  };
  const switchesFor = (week: number, ingId: string, reason: Trigger["reason"], onlyCandidateId?: string, maxPerKitchen = 1) => {
    for (const k of input.kitchens) {
      const cycle = input.cycles.find((c) => c.kitchenId === k.id)!;
      let done = 0;
      for (let dow = 0; dow < 5 && done < maxPerKitchen; dow++) {
        const day = resolveDay(k, cycle, dishesById, overrides, input.today, week, dow);
        if (!day.operating || day.override) continue;
        const groupOf = ingredientsById.get(onlyCandidateId ?? ingId)?.foodGroup;
        const fromDish = day.dishes
          .map((x) => dishesById.get(x.dishId)!)
          .find((x) =>
            onlyCandidateId
              ? ingredientsById.get(x.mainIngredientId)?.foodGroup === groupOf && x.mainIngredientId !== onlyCandidateId && !day.dishes.some((y) => dishesById.get(y.dishId)?.mainIngredientId === onlyCandidateId)
              : x.mainIngredientId === ingId,
          );
        if (!fromDish || cycle.lockedDishIds.includes(fromDish.id)) continue;
        const ctx: SubstitutionContext = {
          today: input.today,
          kitchen: k,
          cycle,
          dishesById,
          ingredientsById,
          overrides,
          settings: input.settings.substitution,
          safetyBuffer: buffer,
          price: (id, w) => env.price.get(id)?.get(w) ?? 0,
          supply: supply(k),
          orderShare: k.linkedKopdesIds.reduce((s, id) => s + (k.kopdesOrderShare[id] ?? 0), 0),
          acceptance,
          canonicalDish: (id) => input.dishes.find((d) => d.mainIngredientId === id),
        };
        const s = suggestForTrigger(ctx, {
          week,
          dow,
          fromDishId: fromDish.id,
          fromIngredientId: fromDish.mainIngredientId,
          reason,
          why: { en: "", id: "" },
          onlyCandidateId,
        });
        if (!s) continue;
        overrides.push(toOverride(s, s, "sim"));
        extraHeld.set(`${s.toIngredientId}|${week}`, (extraHeld.get(`${s.toIngredientId}|${week}`) ?? 0) + s.neededKg);
        done++;
      }
    }
  };
  const chickenSpike = p.chicken.to > p.chicken.from * (1 + input.settings.shieldPriceRisePct);
  if (chickenSpike) switchesFor(p.chicken.week, "chicken", "price_spike");
  if (p.eggs.shortfall > 0) switchesFor(p.eggs.week, "eggs", "shortage");
  if (p.veg.surplus > 0) switchesFor(p.veg.week, p.veg.ingredientId, "surplus", p.veg.ingredientId);

  // 3. Re-plan commitments with the switched menu, then deliver under the shocks.
  const finalPlan = demandTable(input, planEnv, overrides, dishesById, ingredientsById);
  const actual = demandTable(input, env, overrides, dishesById, ingredientsById);
  const rng = mulberry32(p.seed + 1);
  const led = newLedger();
  const engaged = new Set<string>();
  const shortfall = (ing: string, w: number) => (ing === "eggs" && w === p.eggs.week ? p.eggs.shortfall : 0);
  const unmetFrac = new Map<string, number>();

  for (const w of SIM_WEEKS) {
    const allocs = allocateWeek(input, kopdesOrders(input, finalPlan.table, commodities, w, buffer), w, capacityFactor(w));
    // Deliveries: each farmer delivers fully with probability = reliability, otherwise 70%.
    const delivered = new Map<string, number>(); // kopdes|ing -> kg
    const byFarmer: Alloc[] = [];
    for (const a of allocs) {
      const f = input.farmers.find((x) => x.id === a.farmerId)!;
      const kg = a.kg * (rng() < f.reliabilityScore ? 1 : SIM_ASSUMPTIONS.partialDeliveryFactor);
      byFarmer.push({ ...a, kg });
      delivered.set(`${a.kopdesId}|${a.ingredientId}`, (delivered.get(`${a.kopdesId}|${a.ingredientId}`) ?? 0) + kg);
    }
    // Purchases per ingredient, region level.
    for (const ing of input.ingredients) {
      const price = env.price.get(ing.id)!.get(w)!;
      const normal = env.normal.get(ing.id)!.get(w)!;
      const band = makeBand(ing.id === "chicken" ? p.chicken.from : (input.basePrices[ing.id] ?? price), {
        floorPct: SIM_ASSUMPTIONS.bandFloorPct,
        ceilingPct: SIM_ASSUMPTIONS.bandCeilingPct,
      });
      const settle = settlementPrice(band, price);
      let demand = 0;
      let localNeed = 0;
      for (const k of input.kitchens) {
        const d = get3(actual.table, k.id, ing.id, w);
        demand += d;
        for (const kdId of k.linkedKopdesIds) if (commodities.get(kdId)?.has(ing.id)) localNeed += d * (k.kopdesOrderShare[kdId] ?? 0);
      }
      if (demand <= 0) continue;
      const localDelivered = input.kopdes.reduce((s, kd) => s + (delivered.get(`${kd.id}|${ing.id}`) ?? 0), 0);
      const localBought = Math.min(localDelivered, localNeed);
      const spotNeed = demand - localBought;
      const short = shortfall(ing.id, w);
      const spotGot = spotNeed * (1 - short);
      const unmet = spotNeed - spotGot;
      // Price Shield: before a spike, half of the spot purchase is bought a week earlier.
      const spiked = price > normal * (1 + input.settings.shieldPriceRisePct);
      const early = spiked ? spotGot * SIM_ASSUMPTIONS.spreadShare : 0;
      const prevNormal = env.normal.get(ing.id)!.get(Math.max(1, w - 1))!;
      const spend = localBought * settle + (spotGot - early) * price + early * prevNormal;
      addTo(led.demand, w, demand);
      addTo(led.unmet, w, unmet);
      addTo(led.spend, w, spend);
      addTo(led.local, w, localBought * settle);
      addTo(led.exposure, w, localBought * Math.max(0, settle - normal) + (spotGot - early) * Math.max(0, price - normal));
      unmetFrac.set(`${ing.id}|${w}`, demand > 0 ? unmet / demand : 0);
      // Farmer income: delivered kg actually bought, at the settlement price, minus the Kopdes margin.
      const ratio = localDelivered > 0 ? localBought / localDelivered : 0;
      for (const a of byFarmer) {
        if (a.ingredientId !== ing.id) continue;
        const kg = a.kg * ratio;
        if (kg <= 0) continue;
        engaged.add(a.farmerId);
        if (a.kopdesId === DEMO_VILLAGE_KOPDES) led.farmerIncome += kg * settle * (1 - SIM_ASSUMPTIONS.kopdesMargin);
      }
    }
  }
  led.failingPortions = failingFromUnmet(input, env, actual.days, dishesById, (_k, ing, w) => unmetFrac.get(`${ing}|${w}`) ?? 0);
  return summarize(input, env, actual.days, led, engaged, overrides.length);
}

export function runSimulation(input: SimulationInput, params: SimulationParams = DEFAULT_SIM_PARAMS): SimulationResult {
  const env = buildEnv(input, params);
  const dishesById = new Map(input.dishes.map((d) => [d.id, d]));
  const ingredientsById = new Map(input.ingredients.map((i) => [i.id, i]));
  const commodities = kopdesCommodities(input);
  return {
    params,
    baseline: runBaseline(input, params, env, dishesById, ingredientsById, commodities),
    piringtani: runPiringTani(input, params, env, dishesById, ingredientsById, commodities),
  };
}

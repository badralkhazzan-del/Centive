import { describe, expect, it } from "vitest";
import type { AppData, Kitchen, PortionSize, SubstitutionOption, SubstitutionSuggestion } from "@/types";
import { derive, PLANNING_WEEKS } from "@/engines/derive";
import { allComponents, mainProteinOf, resolveDay } from "@/engines/menu";
import { portionCost, portionNutrition } from "@/engines/nutrition";
import { BUDGET_RP, evaluateCandidate, suggestForTrigger, toOverride, type SubstitutionContext, type Trigger } from "@/engines/substitution";
import { daysBetween } from "@/engines/time";
import { seed } from "./fixtures";

const SIZES: PortionSize[] = ["small", "large"];

const derivedCache = new WeakMap<AppData, ReturnType<typeof derive>>();
const derivedOf = (data: AppData) => {
  let d = derivedCache.get(data);
  if (!d) {
    d = derive(data);
    derivedCache.set(data, d);
  }
  return d;
};

/** Independent re-check of every hard constraint for one option. */
function violations(data: AppData, s: SubstitutionSuggestion, option: SubstitutionOption): string[] {
  const d = derivedOf(data);
  const k = d.kitchensById.get(s.kitchenId)!;
  const cycle = d.cyclesByKitchen.get(k.id)!;
  const dow = (s.dayIndex - 1) % 5;
  const before = resolveDay(k, cycle, d.dishesById, data.overrides, data.today, s.week, dow);
  const after = resolveDay(k, cycle, d.dishesById, [...data.overrides, toOverride(s, option, "t")], data.today, s.week, dow);
  const out: string[] = [];
  const rules = data.settings.substitution;
  for (const size of SIZES) {
    const nb = portionNutrition(allComponents(before), size, d.ingredientsById);
    const na = portionNutrition(allComponents(after), size, d.ingredientsById);
    if (na.proteinG < nb.proteinG * rules.minProteinPct - 1e-9) out.push(`protein-${size}`);
    if (Math.abs(na.energyKcal / nb.energyKcal - 1) > rules.energyTolerancePct + 1e-9) out.push(`energy-${size}`);
    const cost = portionCost(allComponents(after), size, d.ingredientsById, (id) => d.price(id, s.week), k.seasoningCostRp[size]);
    if (cost > BUDGET_RP[size] + 1e-6) out.push(`budget-${size}`);
  }
  const proteinIds = new Set(data.ingredients.filter((i) => i.foodGroup === "animal_protein").map((i) => i.id));
  const overrides = [...data.overrides, toOverride(s, option, "t")];
  const counts = new Map<string, number>();
  for (let w = 0; w < 5; w++) {
    const day = resolveDay(k, cycle, d.dishesById, overrides, data.today, s.week, w);
    if (!day.operating) continue;
    const m = mainProteinOf(day, d.dishesById, proteinIds);
    if (m) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  for (const [, n] of counts) if (n > rules.maxMainProteinPerWeek) out.push("diversity");
  if (daysBetween(data.today, s.date) < rules.leadTimeDays) out.push("lead_time");
  const toIng = d.ingredientsById.get(option.toIngredientId)!;
  if (toIng.foodGroup !== d.ingredientsById.get(s.fromIngredientId)!.foodGroup) out.push("food_group");
  if (toIng.allergens.some((a) => k.allergenExclusions.includes(a))) out.push("allergen");
  if (cycle.lockedDishIds.includes(s.fromDishId)) out.push("locked");
  return out;
}

function contextFor(data: AppData, kitchenId: string, patch: Partial<SubstitutionContext> = {}): SubstitutionContext {
  const d = derive(data);
  const k = d.kitchensById.get(kitchenId)!;
  return {
    today: data.today,
    kitchen: k,
    cycle: d.cyclesByKitchen.get(kitchenId)!,
    dishesById: d.dishesById,
    ingredientsById: d.ingredientsById,
    overrides: data.overrides,
    settings: data.settings.substitution,
    safetyBuffer: data.settings.safetyBuffer,
    price: d.price,
    supply: () => ({ availableKg: 1e6, farmers: 5 }),
    orderShare: 0.5,
    acceptance: () => 0.7,
    canonicalDish: (id) => data.dishes.find((x) => x.mainIngredientId === id),
    ...patch,
  };
}

const chickenWeek3: Trigger = {
  week: 3,
  dow: 0,
  fromDishId: "ayam_bumbu_kuning",
  fromIngredientId: "chicken",
  reason: "price_spike",
  why: { en: "test", id: "tes" },
};

describe("Harvest-Aware Menu Switch", () => {
  it("proposes chicken -> catfish for the week-3 price spike, within every rule", () => {
    const data = seed();
    const d = derive(data);
    const list = d.suggestions.get("k-sumbang-1")!;
    const top = list[0];
    expect(top.reason).toBe("price_spike");
    expect(top.fromIngredientId).toBe("chicken");
    expect(top.toIngredientId).toBe("catfish");
    expect(top.week).toBe(3);
    expect(top.nutritionCheck.proteinPct).toBeGreaterThanOrEqual(0.95);
    expect(Math.abs(top.nutritionCheck.energyPct - 1)).toBeLessThanOrEqual(0.1);
    expect(top.costPerPortionAfter.large).toBeLessThan(top.costPerPortionBefore.large);
    expect(violations(data, top, top)).toEqual([]);
    expect(top.explanation.en).toMatch(/Swap chicken .* for catfish/);
    expect(top.explanation.id).toMatch(/Ganti ayam .* dengan lele/);
  });

  it("never returns a suggestion or alternative that breaks a hard constraint", () => {
    const variants: ((d: AppData) => AppData)[] = [
      (x) => x,
      (x) => ({ ...x, settings: { ...x.settings, substitution: { ...x.settings.substitution, energyTolerancePct: 0.05 } } }),
      (x) => ({ ...x, settings: { ...x.settings, substitution: { ...x.settings.substitution, minProteinPct: 1 } } }),
      (x) => ({ ...x, switchRequests: [{ id: "r", kopdesId: "kd-sumbangsari", ingredientId: "eggs", weeks: [3, 4, 5, 6], createdAt: "" }] }),
      (x) => ({ ...x, switchRequests: [{ id: "r", kopdesId: "kd-karangmulya", ingredientId: "chicken", weeks: [1, 2, 3, 4, 5, 6], createdAt: "" }] }),
    ];
    let checked = 0;
    for (const v of variants) {
      const data = v(seed());
      const d = derive(data);
      for (const list of d.suggestions.values()) {
        for (const s of list) {
          for (const option of [s, ...s.alternatives]) {
            expect(violations(data, s, option), `${s.id} -> ${option.toIngredientId}`).toEqual([]);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(10);
  }, 60_000);

  it("only returns options that pass when evaluated for every day and candidate (sweep)", () => {
    const data = seed();
    let passing = 0;
    for (const k of data.kitchens) {
      const ctx = contextFor(data, k.id);
      for (const week of PLANNING_WEEKS) {
        for (let dow = 0; dow < 5; dow++) {
          const day = resolveDay(k, ctx.cycle, ctx.dishesById, [], data.today, week, dow);
          for (const rd of day.dishes) {
            const dish = ctx.dishesById.get(rd.dishId)!;
            const t: Trigger = { week, dow, fromDishId: dish.id, fromIngredientId: dish.mainIngredientId, reason: "shortage", why: { en: "", id: "" } };
            const s = suggestForTrigger(ctx, t);
            if (!s) continue;
            for (const o of [s, ...s.alternatives]) {
              expect(violations(data, s, o)).toEqual([]);
              passing++;
            }
          }
        }
      }
    }
    expect(passing).toBeGreaterThan(50);
  }, 120_000);

  it("returns no suggestion when no valid substitute exists", () => {
    const data = seed();
    // Rice has no same-group alternative.
    const ctx = contextFor(data, "k-sumbang-1");
    expect(suggestForTrigger(ctx, { ...chickenWeek3, fromDishId: "nasi_putih", fromIngredientId: "rice" })).toBeNull();
    // No local supply for any candidate.
    const noSupply = contextFor(data, "k-sumbang-1", { supply: () => ({ availableKg: 0, farmers: 0 }) });
    expect(suggestForTrigger(noSupply, chickenWeek3)).toBeNull();
    expect(evaluateCandidate(noSupply, chickenWeek3, "catfish").violations).toContain("supply");
  });

  it("excludes allergens the kitchen excludes", () => {
    const data = seed();
    const k: Kitchen = { ...data.kitchens[0], allergenExclusions: ["fish"] };
    const ctx = contextFor(data, k.id, { kitchen: k });
    const s = suggestForTrigger(ctx, chickenWeek3);
    const options = s ? [s, ...s.alternatives].map((o) => o.toIngredientId) : [];
    expect(options).not.toContain("catfish");
    expect(options).not.toContain("tilapia");
    expect(evaluateCandidate(ctx, chickenWeek3, "catfish").violations).toContain("allergen");
  });

  it("never swaps a locked anchor dish", () => {
    const data = seed();
    const base = contextFor(data, "k-sumbang-1");
    const locked = contextFor(data, "k-sumbang-1", { cycle: { ...base.cycle, lockedDishIds: [...base.cycle.lockedDishIds, "ayam_bumbu_kuning"] } });
    expect(suggestForTrigger(base, chickenWeek3)).not.toBeNull();
    expect(suggestForTrigger(locked, chickenWeek3)).toBeNull();
    // Sumbang 2 locks telur_balado in the seed data: an egg shortage request gives no egg swaps there.
    const d = derive({ ...data, switchRequests: [{ id: "r", kopdesId: "kd-sumbangsari", ingredientId: "eggs", weeks: [3, 4, 5, 6], createdAt: "" }] });
    expect(d.suggestions.get("k-sumbang-2")!.some((s) => s.fromDishId === "telur_balado")).toBe(false);
    expect(d.suggestions.get("k-sumbang-1")!.some((s) => s.fromDishId === "telur_balado")).toBe(true);
  });

  it("discards candidates that push the portion over budget", () => {
    const data = seed();
    const d = derive(data);
    const ctx = contextFor(data, "k-sumbang-1", { price: (id, w) => (id === "catfish" ? 90000 : d.price(id, w)) });
    const r = evaluateCandidate(ctx, chickenWeek3, "catfish");
    expect(r.violations).toContain("budget");
    expect(r.option).toBeUndefined();
  });

  it("enforces the D-3 lead time", () => {
    const data = seed();
    // Seen from Saturday 14 Nov, Monday 16 Nov (planning week 1, a chicken day) is only 2 days ahead.
    const ctx = contextFor(data, "k-sumbang-1", { today: "2026-11-14" });
    const soon: Trigger = { ...chickenWeek3, week: 1, dow: 0 };
    expect(evaluateCandidate(ctx, soon, "catfish").violations).toContain("lead_time");
    expect(evaluateCandidate(ctx, { ...soon, week: 2 }, "catfish").violations).not.toContain("lead_time");
  });

  it("enforces main-protein diversity (max 2 per week)", () => {
    const data = seed();
    const ctx = contextFor(data, "k-sumbang-1");
    // Week 3 already serves eggs twice.
    expect(evaluateCandidate(ctx, chickenWeek3, "eggs").violations).toContain("diversity");
  });

  it("matches protein with the new grams (nearest 5 g) and keeps energy with a staple adjustment", () => {
    const data = seed();
    const ctx = contextFor(data, "k-sumbang-1");
    const r = evaluateCandidate(ctx, chickenWeek3, "catfish");
    expect(r.option).toBeDefined();
    const o = r.option!;
    expect(o.gramsNew.large % 5).toBe(0);
    expect(o.gramsNew.small % 5).toBe(0);
    // chicken 60 g x 18.2 g/100 g = 10.9 g protein -> catfish 18 g/100 g -> 60 g
    expect(o.gramsNew.large).toBe(60);
    expect(o.stapleTopUpG.large).toBeGreaterThan(0);
    expect(o.stapleTopUpG.large).toBeLessThanOrEqual(data.settings.substitution.maxStapleTopUpG);
  });

  it("uses Plate Feedback for child acceptance (default 0.7 without data)", () => {
    const data = seed();
    const d = derive(data);
    expect(d.acceptance("k-sumbang-1", "tilapia")).toBeLessThan(d.acceptance("k-sumbang-1", "catfish"));
    const empty = derive({ ...data, plateFeedback: [] });
    expect(empty.acceptance("k-sumbang-1", "catfish")).toBe(0.7);
  });
});

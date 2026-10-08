import type {
  Dish,
  Ingredient,
  Kitchen,
  LocalizedText,
  MenuCycle,
  MenuOverride,
  PortionSize,
  Sized,
  SubstitutionOption,
  SubstitutionSettings,
  SubstitutionSuggestion,
  SuggestionScores,
  SwitchReason,
} from "@/types";
import { formatDate, formatRp } from "./format";
import { allComponents, dishComponents, mainProteinOf, resolveDay, type ResolvedDay } from "./menu";
import { componentNutrition, portionCost, portionNutrition, purchaseQty } from "./nutrition";
import { daysBetween, monthIndex } from "./time";

// 6.4 Harvest-Aware Menu Switch.
//
// Candidates: same food group, not an allergen the kitchen excludes, not a locked
// dish, and enough committed or available local supply.
//
// Hard constraints (a candidate failing any of them is discarded):
//   - protein per portion >= 95% of the original (whole portion, and for protein
//     dishes also the swapped component itself)
//   - energy per portion within +/-10% of the original
//   - raw-food cost per portion <= budget (Rp8,000 small, Rp10,000 large)
//   - the same main protein at most 2 times per week
//   - the switch day is at least 3 days ahead (D-3)
//
// Grams adjustment: protein foods are re-portioned so protein matches the original
// (nearest 5 g); vegetables and fruit are swapped weight for weight. Skin-on chicken
// (TKPI) is far richer in energy than fish, so when a protein-matched swap falls
// outside the energy rule, the staple (rice) is adjusted by up to `maxStapleTopUpG`
// grams to bring the portion back to the original energy. The adjustment is part of
// the suggestion, shown in the explanation and re-checked against every rule.
//
// Score (0-100): local supply 35%, cost saving 25%, nutrition closeness 25%,
// child acceptance 15% (from Plate Feedback, default 0.7).

export const BUDGET_RP: Sized<number> = { small: 8000, large: 10000 };
export const SCORE_WEIGHTS = { local: 0.35, cost: 0.25, nutrition: 0.25, acceptance: 0.15 } as const;
export const DEFAULT_ACCEPTANCE = 0.7;
const SIZES: PortionSize[] = ["small", "large"];
const PROTEIN_GROUPS = new Set(["animal_protein", "plant_protein", "dairy"]);

export const round5 = (v: number) => Math.round(v / 5) * 5;

export interface SupplyInfo {
  availableKg: number;
  farmers: number;
}

export interface SubstitutionContext {
  today: string;
  kitchen: Kitchen;
  cycle: MenuCycle;
  dishesById: Map<string, Dish>;
  ingredientsById: Map<string, Ingredient>;
  overrides: MenuOverride[];
  settings: SubstitutionSettings;
  safetyBuffer: number;
  /** Market price (Rp per unit) of an ingredient in a planning week. */
  price: (ingredientId: string, week: number) => number;
  /** Spare local supply for an ingredient in a week (Kopdes members, kg/week). */
  supply: (ingredientId: string, week: number) => SupplyInfo;
  /** Share of this kitchen's demand ordered from its Kopdes (sum over linked Kopdes). */
  orderShare: number;
  /** Child acceptance 0..1 for an ingredient (from Plate Feedback). */
  acceptance: (ingredientId: string) => number;
  /** The dish that serves an ingredient as its main item. */
  canonicalDish: (ingredientId: string) => Dish | undefined;
}

export interface Trigger {
  week: number;
  dow: number;
  fromDishId: string;
  fromIngredientId: string;
  reason: SwitchReason;
  why: LocalizedText;
  /** For surplus triggers: the ingredient in surplus (the only candidate). */
  onlyCandidateId?: string;
}

export type Violation = "protein" | "energy" | "budget" | "diversity" | "lead_time" | "allergen" | "food_group" | "supply" | "locked";

export interface CandidateResult {
  option?: SubstitutionOption;
  violations: Violation[];
  toIngredientId: string;
}

function sized<T>(fn: (s: PortionSize) => T): Sized<T> {
  return { small: fn("small"), large: fn("large") };
}

export function suggestionKey(kitchenId: string, week: number, dayIndex: number, fromDishId: string, reason: SwitchReason) {
  return `${kitchenId}:${week}:${dayIndex}:${fromDishId}:${reason}`;
}

function dayCost(ctx: SubstitutionContext, day: ResolvedDay, size: PortionSize, comps = allComponents(day)) {
  return portionCost(comps, size, ctx.ingredientsById, (id) => ctx.price(id, day.week), ctx.kitchen.seasoningCostRp[size]);
}

/** Count of days in a week whose main protein is the given ingredient (after a hypothetical swap). */
export function mainProteinCount(
  ctx: SubstitutionContext,
  week: number,
  ingredientId: string,
  swap?: { dow: number; newMain: string },
): number {
  const proteinIds = new Set(
    [...ctx.ingredientsById.values()].filter((i) => i.foodGroup === "animal_protein").map((i) => i.id),
  );
  let n = 0;
  for (let dow = 0; dow < 5; dow++) {
    const day = resolveDay(ctx.kitchen, ctx.cycle, ctx.dishesById, ctx.overrides, ctx.today, week, dow);
    if (!day.operating) continue;
    const main = swap && swap.dow === dow ? swap.newMain : mainProteinOf(day, ctx.dishesById, proteinIds);
    if (main === ingredientId) n++;
  }
  return n;
}

/** Evaluate one candidate ingredient against every hard constraint, and score it. */
export function evaluateCandidate(ctx: SubstitutionContext, trigger: Trigger, toIngredientId: string): CandidateResult {
  const violations: Violation[] = [];
  const day = resolveDay(ctx.kitchen, ctx.cycle, ctx.dishesById, ctx.overrides, ctx.today, trigger.week, trigger.dow);
  const fromDish = ctx.dishesById.get(trigger.fromDishId);
  const fromIng = ctx.ingredientsById.get(trigger.fromIngredientId);
  const toIng = ctx.ingredientsById.get(toIngredientId);
  const toDish = ctx.canonicalDish(toIngredientId);
  if (!fromDish || !fromIng || !toIng || !toDish || !day.operating) {
    return { violations: ["food_group"], toIngredientId };
  }
  if (toIng.foodGroup !== fromIng.foodGroup || toIng.id === fromIng.id) violations.push("food_group");
  if (toIng.allergens.some((a) => ctx.kitchen.allergenExclusions.includes(a))) violations.push("allergen");
  if (ctx.cycle.lockedDishIds.includes(fromDish.id)) violations.push("locked");
  if (daysBetween(ctx.today, day.date) < ctx.settings.leadTimeDays) violations.push("lead_time");

  const resolvedFrom = day.dishes.find((d) => d.dishId === fromDish.id && !d.switchedFromDishId);
  if (!resolvedFrom) return { violations: [...violations, "food_group"], toIngredientId };

  const sameGroup = (id: string) => ctx.ingredientsById.get(id)?.foodGroup === fromIng.foodGroup;
  const fromMainGrams = sized((s) =>
    resolvedFrom.components.filter((c) => c.ingredientId === fromIng.id).reduce((a, c) => a + c.grams[s], 0),
  );
  const fromGroupGrams = sized((s) =>
    resolvedFrom.components.filter((c) => sameGroup(c.ingredientId)).reduce((a, c) => a + c.grams[s], 0),
  );

  // Grams adjustment
  const isProtein = PROTEIN_GROUPS.has(fromIng.foodGroup);
  const gramsNew = sized((s) => {
    if (isProtein) {
      const target = componentNutrition(fromIng, fromMainGrams[s]).proteinG;
      let g = round5((target / toIng.proteinGPer100g) * 100);
      while (componentNutrition(toIng, g).proteinG < target * ctx.settings.minProteinPct) g += 5;
      return g;
    }
    return round5(fromGroupGrams[s]);
  });

  const before = allComponents(day);
  const others = day.dishes.filter((d) => d !== resolvedFrom).flatMap((d) => d.components);
  const swapped = [...others, ...dishComponents(toDish, gramsNew)];
  const stapleComp = before.find((c) => ctx.ingredientsById.get(c.ingredientId)?.foodGroup === "staple");
  const staple = stapleComp ? ctx.ingredientsById.get(stapleComp.ingredientId) : undefined;
  const tol = ctx.settings.energyTolerancePct;

  // Staple adjustment to keep energy within the rule.
  const stapleTopUpG = sized((s) => {
    const eBefore = portionNutrition(before, s, ctx.ingredientsById).energyKcal;
    const eAfter = portionNutrition(swapped, s, ctx.ingredientsById).energyKcal;
    const ratio = eAfter / eBefore;
    if (!staple || Math.abs(ratio - 1) <= tol) return 0;
    const g = round5(((eBefore - eAfter) / staple.energyKcalPer100g) * 100);
    const max = ctx.settings.maxStapleTopUpG;
    const current = stapleComp!.grams[s];
    return Math.max(-Math.min(max, current), Math.min(max, g));
  });

  const finalComps = swapped.map((c) =>
    staple && c.ingredientId === staple.id
      ? { ...c, grams: { small: c.grams.small + stapleTopUpG.small, large: c.grams.large + stapleTopUpG.large } }
      : c,
  );

  const bySize = sized((s) => {
    const nb = portionNutrition(before, s, ctx.ingredientsById);
    const na = portionNutrition(finalComps, s, ctx.ingredientsById);
    return {
      proteinPct: na.proteinG / nb.proteinG,
      energyPct: na.energyKcal / nb.energyKcal,
      proteinG: na.proteinG,
      energyKcal: na.energyKcal,
    };
  });
  for (const s of SIZES) {
    if (bySize[s].proteinPct < ctx.settings.minProteinPct - 1e-9) violations.push("protein");
    if (Math.abs(bySize[s].energyPct - 1) > tol + 1e-9) violations.push("energy");
    if (isProtein) {
      const orig = componentNutrition(fromIng, fromMainGrams[s]).proteinG;
      const next = componentNutrition(toIng, gramsNew[s]).proteinG;
      if (next < orig * ctx.settings.minProteinPct - 1e-9) violations.push("protein");
    }
  }

  const costPerPortionBefore = sized((s) => dayCost(ctx, day, s, before));
  const costPerPortionAfter = sized((s) => dayCost(ctx, day, s, finalComps));
  for (const s of SIZES) if (costPerPortionAfter[s] > BUDGET_RP[s] + 1e-6) violations.push("budget");

  // Diversity: the same main protein at most N times per week.
  if (toIng.foodGroup === "animal_protein") {
    const count = mainProteinCount(ctx, trigger.week, toIng.id, { dow: trigger.dow, newMain: toIng.id });
    if (count > ctx.settings.maxMainProteinPerWeek) violations.push("diversity");
  }

  // Local supply for the extra quantity this switch needs from the Kopdes.
  const att = ctx.kitchen.attendanceRate;
  const extraQty =
    (purchaseQty(toIng, gramsNew.small) * ctx.kitchen.beneficiaries.small +
      purchaseQty(toIng, gramsNew.large) * ctx.kitchen.beneficiaries.large) *
    att *
    (1 + ctx.safetyBuffer);
  const neededKg = extraQty * ctx.orderShare;
  const supply = ctx.supply(toIng.id, trigger.week);
  if (supply.availableKg + 1e-6 < neededKg) violations.push("supply");

  const uniqueViolations = [...new Set(violations)];

  // Scores
  const season = toIng.seasonalityByMonth[monthIndex(day.date)] ?? 1;
  const local = Math.max(0, Math.min(1, neededKg > 0 ? supply.availableKg / (neededKg * 2) : 1)) * season;
  const saving = SIZES.reduce((a, s) => a + (costPerPortionBefore[s] - costPerPortionAfter[s]) / costPerPortionBefore[s], 0) / 2;
  const cost = Math.max(0, Math.min(1, 0.5 + saving / 0.2));
  const nutrition =
    SIZES.reduce((a, s) => {
      const p = bySize[s].proteinPct;
      const e = bySize[s].energyPct;
      return a + (1 - Math.min(1, (Math.max(0, 1 - p) + Math.abs(e - 1)) / (2 * tol)));
    }, 0) / 2;
  const acceptance = ctx.acceptance(toIng.id);
  const scores: SuggestionScores = {
    local,
    cost,
    nutrition,
    acceptance,
    total: Math.round(
      100 *
        (SCORE_WEIGHTS.local * local +
          SCORE_WEIGHTS.cost * cost +
          SCORE_WEIGHTS.nutrition * nutrition +
          SCORE_WEIGHTS.acceptance * acceptance),
    ),
  };

  const option: SubstitutionOption = {
    toIngredientId: toIng.id,
    toDishId: toDish.id,
    gramsNew,
    stapleTopUpG,
    stapleIngredientId: staple && (stapleTopUpG.small !== 0 || stapleTopUpG.large !== 0) ? staple.id : undefined,
    scores,
    nutritionCheck: { proteinPct: bySize.large.proteinPct, energyPct: bySize.large.energyPct, bySize },
    costPerPortionBefore,
    costPerPortionAfter,
    localFarmers: supply.farmers,
    availableKg: supply.availableKg,
    neededKg,
    explanation: buildExplanation(trigger, day.date, fromIng, toIng, gramsNew, stapleTopUpG, staple, bySize, costPerPortionBefore, costPerPortionAfter, supply.farmers, isProtein ? fromMainGrams : fromGroupGrams),
  };
  return { option: uniqueViolations.length === 0 ? option : undefined, violations: uniqueViolations, toIngredientId: toIng.id };
}

function buildExplanation(
  trigger: Trigger,
  date: string,
  fromIng: Ingredient,
  toIng: Ingredient,
  gramsNew: Sized<number>,
  topUp: Sized<number>,
  staple: Ingredient | undefined,
  bySize: Sized<{ proteinPct: number; energyPct: number }>,
  before: Sized<number>,
  after: Sized<number>,
  farmers: number,
  fromGrams: Sized<number>,
): LocalizedText {
  const L = "large" as const;
  const pct = (v: number) => Math.round(v * 100);
  const topEn =
    staple && topUp[L] > 0
      ? ` + ${staple.nameEn.toLowerCase()} +${topUp[L]} g`
      : staple && topUp[L] < 0
        ? `, with ${-topUp[L]} g less ${staple.nameEn.toLowerCase()}`
        : "";
  const topId =
    staple && topUp[L] > 0
      ? ` + ${staple.nameId.toLowerCase()} +${topUp[L]} g`
      : staple && topUp[L] < 0
        ? `, ${staple.nameId.toLowerCase()} dikurangi ${-topUp[L]} g`
        : "";
  const en =
    `Swap ${fromIng.nameEn.toLowerCase()} (${fromGrams[L]} g) for ${toIng.nameEn.toLowerCase()} (${gramsNew[L]} g)${topEn} ` +
    `on ${formatDate(date, "en", { weekday: true })}, week ${trigger.week}. Why: ${trigger.why.en} ` +
    `Protein ${pct(bySize[L].proteinPct)}% ✓, energy ${pct(bySize[L].energyPct)}% ✓, ` +
    `cost ${formatRp(before[L], "en")} → ${formatRp(after[L], "en")} ✓. ` +
    `${toIng.nameEn} is available from ${farmers} member farmer${farmers === 1 ? "" : "s"}.`;
  const id =
    `Ganti ${fromIng.nameId.toLowerCase()} (${fromGrams[L]} g) dengan ${toIng.nameId.toLowerCase()} (${gramsNew[L]} g)${topId} ` +
    `pada ${formatDate(date, "id", { weekday: true })}, minggu ${trigger.week}. Alasan: ${trigger.why.id} ` +
    `Protein ${pct(bySize[L].proteinPct)}% ✓, energi ${pct(bySize[L].energyPct)}% ✓, ` +
    `biaya ${formatRp(before[L], "id")} → ${formatRp(after[L], "id")} ✓. ` +
    `${toIng.nameId} tersedia dari ${farmers} petani anggota.`;
  return { en, id };
}

/** Ingredients that could replace the trigger's ingredient (before hard-constraint checks). */
export function candidateIds(ctx: SubstitutionContext, trigger: Trigger): string[] {
  if (trigger.onlyCandidateId) return [trigger.onlyCandidateId];
  const from = ctx.ingredientsById.get(trigger.fromIngredientId);
  if (!from) return [];
  return [...ctx.ingredientsById.values()]
    .filter((i) => i.foodGroup === from.foodGroup && i.id !== from.id && i.foodGroup !== "fat")
    .filter((i) => !i.allergens.some((a) => ctx.kitchen.allergenExclusions.includes(a)))
    .filter((i) => ctx.canonicalDish(i.id) !== undefined)
    .map((i) => i.id);
}

/** Top suggestion plus up to 2 alternatives, or null when no candidate passes every rule. */
export function suggestForTrigger(ctx: SubstitutionContext, trigger: Trigger): SubstitutionSuggestion | null {
  const day = resolveDay(ctx.kitchen, ctx.cycle, ctx.dishesById, ctx.overrides, ctx.today, trigger.week, trigger.dow);
  if (!day.operating || ctx.cycle.lockedDishIds.includes(trigger.fromDishId)) return null;
  const options = candidateIds(ctx, trigger)
    .map((id) => evaluateCandidate(ctx, trigger, id))
    .filter((r): r is CandidateResult & { option: SubstitutionOption } => r.option !== undefined)
    .map((r) => r.option)
    .sort((a, b) => b.scores.total - a.scores.total || a.toIngredientId.localeCompare(b.toIngredientId));
  if (options.length === 0) return null;
  const [top, ...rest] = options;
  const fromDish = ctx.dishesById.get(trigger.fromDishId)!;
  const resolvedFrom = day.dishes.find((d) => d.dishId === trigger.fromDishId);
  const fromGrams = sized(
    (s) => resolvedFrom?.components.filter((c) => c.ingredientId === trigger.fromIngredientId).reduce((a, c) => a + c.grams[s], 0) ?? 0,
  );
  const key = suggestionKey(ctx.kitchen.id, trigger.week, day.dayIndex, fromDish.id, trigger.reason);
  return {
    ...top,
    id: `sg-${key}`,
    kitchenId: ctx.kitchen.id,
    week: trigger.week,
    dayIndex: day.dayIndex,
    date: day.date,
    fromIngredientId: trigger.fromIngredientId,
    fromDishId: fromDish.id,
    fromGrams,
    reason: trigger.reason,
    why: trigger.why,
    status: "pending",
    alternatives: rest.slice(0, 2),
  };
}

/** Turn an approved suggestion (or one of its alternatives) into a menu override. */
export function toOverride(s: SubstitutionSuggestion, option: SubstitutionOption, approvedAt: string): MenuOverride {
  return {
    suggestionId: s.id,
    kitchenId: s.kitchenId,
    week: s.week,
    dayIndex: s.dayIndex,
    fromDishId: s.fromDishId,
    toDishId: option.toDishId,
    fromIngredientId: s.fromIngredientId,
    toIngredientId: option.toIngredientId,
    gramsNew: { ...option.gramsNew },
    stapleTopUpG: { ...option.stapleTopUpG },
    stapleIngredientId: option.stapleIngredientId,
    approvedAt,
  };
}

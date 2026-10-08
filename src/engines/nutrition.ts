import type { Ingredient, PortionSize } from "@/types";
import type { ResolvedComponent } from "./menu";

export interface PortionNutrition {
  energyKcal: number;
  proteinG: number;
}

export function componentNutrition(ing: Ingredient, grams: number): PortionNutrition {
  return {
    energyKcal: (ing.energyKcalPer100g * grams) / 100,
    proteinG: (ing.proteinGPer100g * grams) / 100,
  };
}

export function portionNutrition(
  components: ResolvedComponent[],
  size: PortionSize,
  ingredientsById: Map<string, Ingredient>,
): PortionNutrition {
  let energyKcal = 0;
  let proteinG = 0;
  for (const c of components) {
    const ing = ingredientsById.get(c.ingredientId);
    if (!ing) continue;
    const n = componentNutrition(ing, c.grams[size]);
    energyKcal += n.energyKcal;
    proteinG += n.proteinG;
  }
  return { energyKcal, proteinG };
}

/** Purchase quantity in the ingredient's unit (kg or L) for edible grams. */
export function purchaseQty(ing: Ingredient, edibleGrams: number): number {
  const kg = edibleGrams / ing.edibleFraction / 1000;
  return ing.unit === "L" ? kg / (ing.densityKgPerL ?? 1) : kg;
}

export type PriceLookup = (ingredientId: string) => number;

/** Raw-food cost of a portion (Rp), using purchase weight (grams / BDD) x price. */
export function portionCost(
  components: ResolvedComponent[],
  size: PortionSize,
  ingredientsById: Map<string, Ingredient>,
  price: PriceLookup,
  seasoningRp = 0,
): number {
  let cost = seasoningRp;
  for (const c of components) {
    const ing = ingredientsById.get(c.ingredientId);
    if (!ing) continue;
    cost += purchaseQty(ing, c.grams[size]) * price(c.ingredientId);
  }
  return cost;
}

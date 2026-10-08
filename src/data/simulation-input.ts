import type { SimulationInput } from "@/engines/simulation";
import { PRICE_TABLE, PRICE_WEEKS } from "./prices";
import { buildSeedState } from "./seed";

/**
 * The Simulation Lab always runs on the original seed data (not on changes made in
 * this browser), so the same seed and shocks always give the same numbers.
 * Normal price = average of the last 4 weeks of price history (weeks -3..0).
 */
export function seedSimulationInput(): SimulationInput {
  const s = buildSeedState();
  const idx = [-3, -2, -1, 0].map((w) => PRICE_WEEKS.indexOf(w));
  const basePrices = Object.fromEntries(
    Object.entries(PRICE_TABLE).map(([id, values]) => [id, Math.round(idx.reduce((a, i) => a + values[i], 0) / idx.length)]),
  );
  return {
    today: s.today,
    kitchens: s.kitchens,
    cycles: s.menuCycles,
    dishes: s.dishes,
    ingredients: s.ingredients,
    farmers: s.farmers,
    kopdes: s.kopdes,
    plateFeedback: s.plateFeedback,
    settings: s.settings,
    basePrices,
  };
}

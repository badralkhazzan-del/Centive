import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "@/data/ingredients";
import { buildPrices } from "@/data/prices";
import { indexPrices } from "@/engines/priceBand";
import { groupAlerts, priceShieldAlerts } from "@/engines/priceShield";
import { DEMO_TODAY } from "@/engines/time";

const prices = indexPrices(buildPrices());
const base = {
  today: DEMO_TODAY,
  weeks: [1, 2, 3, 4, 5, 6, 7, 8],
  ingredients: INGREDIENTS,
  prices,
  priceRiseThreshold: 0.1,
  demandShareThreshold: 0.25,
  memberCapacityKg: () => 100,
  marketSupplyKg: () => 10000,
};

describe("Price Shield", () => {
  it("flags the week-3 chicken spike only", () => {
    const alerts = priceShieldAlerts({ ...base, demandKg: () => 10 });
    const price = alerts.filter((a) => a.kind === "price_rise");
    expect(price.map((a) => `${a.ingredientId}-${a.week}`)).toEqual(["chicken-3"]);
    expect(price[0].priceRisePct).toBeCloseTo(42000 / 35500 - 1, 6);
    expect(price[0].sparkline).toHaveLength(8);
    expect(price[0].why.en).toContain("18%");
    expect(price[0].why.id).toContain("18%");
  });

  it("flags demand above 25% of the estimated local supply", () => {
    const alerts = priceShieldAlerts({ ...base, demandKg: (id) => (id === "eggs" ? 2600 : 10) });
    const demand = alerts.filter((a) => a.kind === "demand_share");
    expect(new Set(demand.map((a) => a.ingredientId))).toEqual(new Set(["eggs"]));
    expect(demand[0].demandSharePct).toBeCloseTo(2600 / 10100, 6);
    expect(demand[0].actions).toContain("neighbor");
  });

  it("raises nothing at exactly 25% demand share", () => {
    const alerts = priceShieldAlerts({ ...base, demandKg: () => 2525 });
    expect(alerts.filter((a) => a.kind === "demand_share")).toHaveLength(0);
  });

  it("groups weeks into one card per ingredient, price alerts first", () => {
    const alerts = priceShieldAlerts({ ...base, demandKg: (id) => (id === "eggs" ? 2600 : 10) });
    const groups = groupAlerts(alerts, new Map(INGREDIENTS.map((i) => [i.id, i])));
    expect(groups[0].kind).toBe("price_rise");
    expect(groups.find((g) => g.ingredientId === "eggs")!.weeks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

import { describe, expect, it } from "vitest";
import { seedSimulationInput } from "@/data/simulation-input";
import { DEFAULT_SIM_PARAMS, runSimulation } from "@/engines/simulation";

const input = seedSimulationInput();

describe("Simulation Lab", () => {
  it("is deterministic: the same seed gives identical numbers", () => {
    const a = runSimulation(seedSimulationInput(), DEFAULT_SIM_PARAMS);
    const b = runSimulation(seedSimulationInput(), DEFAULT_SIM_PARAMS);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("changes with another seed", () => {
    const a = runSimulation(input, DEFAULT_SIM_PARAMS);
    const b = runSimulation(input, { ...DEFAULT_SIM_PARAMS, seed: 7 });
    expect(a.baseline.metrics.totalSpendRp).not.toBe(b.baseline.metrics.totalSpendRp);
  });

  it("returns finite, bounded metrics for both strategies", () => {
    const r = runSimulation(input);
    for (const s of [r.baseline, r.piringtani]) {
      const m = s.metrics;
      for (const v of Object.values(m)) expect(Number.isFinite(v)).toBe(true);
      expect(m.localShare).toBeGreaterThanOrEqual(0);
      expect(m.localShare).toBeLessThanOrEqual(1);
      expect(m.compliance).toBeGreaterThan(0.9);
      expect(m.compliance).toBeLessThanOrEqual(1);
      expect(s.weekly).toHaveLength(8);
      expect(m.costPerPortion).toBeLessThan(m.budgetPerPortion);
    }
  });

  it("shows the expected direction under the default shocks", () => {
    const r = runSimulation(input);
    const b = r.baseline.metrics;
    const p = r.piringtani.metrics;
    expect(p.localShare).toBeGreaterThan(b.localShare);
    expect(p.priceExposureRp).toBeLessThan(b.priceExposureRp);
    expect(p.unmetPct).toBeLessThan(b.unmetPct);
    expect(p.farmerIncomeRp).toBeGreaterThan(b.farmerIncomeRp);
    expect(p.compliance).toBeGreaterThanOrEqual(b.compliance);
    expect(p.switches).toBeGreaterThan(0);
  });

  it("keeps the baseline Kopdes share configurable", () => {
    const low = runSimulation(input, { ...DEFAULT_SIM_PARAMS, baselineKopdesShare: 0.05 });
    const high = runSimulation(input, { ...DEFAULT_SIM_PARAMS, baselineKopdesShare: 0.3 });
    expect(high.baseline.metrics.localShare).toBeGreaterThan(low.baseline.metrics.localShare);
  });

  it("has no unmet demand and no extra spending without shocks", () => {
    const calm = runSimulation(input, {
      ...DEFAULT_SIM_PARAMS,
      chicken: { week: 3, from: 35000, to: 35000 },
      eggs: { week: 5, shortfall: 0 },
      veg: { week: 6, ingredientId: "kangkung", surplus: 0 },
    });
    expect(calm.baseline.metrics.unmetPct).toBe(0);
    expect(calm.baseline.metrics.priceExposureRp).toBe(0);
    expect(calm.baseline.metrics.compliance).toBe(1);
  });
});

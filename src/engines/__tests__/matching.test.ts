import { describe, expect, it } from "vitest";
import { allocate, coverageStatus, inclusionSummary, scoreCandidate, type MatchCandidate } from "@/engines/matching";
import { buildFarmers } from "@/data/farmers";
import type { Commitment } from "@/types";

const c = (id: string, patch: Partial<MatchCandidate> = {}): MatchCandidate => ({
  farmerId: id,
  reliability: 0.9,
  capacityKg: 100,
  heldAnywhereKg: 0,
  heldHereKg: 0,
  sameVillage: true,
  consentGiven: true,
  ...patch,
});

describe("Commitment & Matching", () => {
  it("scores reliability 50%, spare capacity 30%, same village 20%", () => {
    expect(scoreCandidate(c("a", { reliability: 1, capacityKg: 100 }), 100)).toBeCloseTo(1, 6);
    expect(scoreCandidate(c("a", { reliability: 0.8, capacityKg: 50, sameVillage: false }), 100)).toBeCloseTo(0.4 + 0.15 + 0.1, 6);
  });

  it("ranks better farmers first and spreads volume in rounds", () => {
    const r = allocate({
      gapKg: 100,
      weeklyVolumeKg: 400,
      fairnessCapPct: 0.3,
      candidates: [c("low", { reliability: 0.6 }), c("high", { reliability: 0.95 }), c("mid", { reliability: 0.8 })],
    });
    expect(r.ranked.map((x) => x.farmerId)).toEqual(["high", "mid", "low"]);
    expect(r.allocatedKg).toBe(100);
    expect(r.allocations.every((a) => a.kg > 0)).toBe(true);
    expect(r.allocations.length).toBe(3);
  });

  it("never lets a farmer hold more than the fairness cap of weekly volume", () => {
    const r = allocate({
      gapKg: 300,
      weeklyVolumeKg: 300,
      fairnessCapPct: 0.3,
      candidates: [c("a", { capacityKg: 500 }), c("b", { capacityKg: 500, heldHereKg: 60 }), c("c", { capacityKg: 500 })],
    });
    for (const a of r.allocations) {
      const held = a.farmerId === "b" ? 60 : 0;
      expect(a.kg + held).toBeLessThanOrEqual(90);
    }
    expect(r.unallocatedKg).toBeGreaterThan(0); // 3 farmers x 30% cannot cover 100%
  });

  it("skips farmers with zero capacity, no spare capacity or no consent", () => {
    const r = allocate({
      gapKg: 50,
      weeklyVolumeKg: 200,
      fairnessCapPct: 0.3,
      candidates: [c("zero", { capacityKg: 0 }), c("full", { capacityKg: 40, heldAnywhereKg: 40 }), c("noconsent", { consentGiven: false }), c("ok")],
    });
    expect(r.allocations.map((a) => a.farmerId)).toEqual(["ok"]);
    expect(r.allocatedKg).toBe(50);
  });

  it("returns nothing when no one can supply", () => {
    const r = allocate({ gapKg: 50, weeklyVolumeKg: 200, fairnessCapPct: 0.3, candidates: [c("zero", { capacityKg: 0 })] });
    expect(r.allocations).toHaveLength(0);
    expect(r.unallocatedKg).toBe(50);
  });

  it("sets traffic lights at 100% and 80%", () => {
    expect(coverageStatus(1)).toBe("green");
    expect(coverageStatus(1.3)).toBe("green");
    expect(coverageStatus(0.8)).toBe("yellow");
    expect(coverageStatus(0.99)).toBe("yellow");
    expect(coverageStatus(0.79)).toBe("red");
    expect(coverageStatus(0, 0)).toBe("none");
  });

  it("reports the women and youth share of committed volume", () => {
    const farmers = new Map(buildFarmers().map((f) => [f.id, f]));
    const mk = (farmerId: string, kg: number, status: Commitment["status"] = "accepted"): Commitment => ({
      id: farmerId + kg,
      farmerId,
      kopdesId: "kd-sumbangsari",
      ingredientId: "eggs",
      weeks: [1, 2],
      kgPerWeek: kg,
      offeredKgPerWeek: kg,
      priceBand: { ref: 1, floor: 1, ceiling: 1 },
      status,
      createdAt: "",
      origin: "offer",
    });
    // Sri: woman adult; Bayu: man youth; Darto: offered only (not counted)
    const s = inclusionSummary([mk("f-sri", 30), mk("f-bayu", 10), mk("f-darto", 50, "offered")], farmers);
    expect(s.womenPct).toBeCloseTo(0.75, 6);
    expect(s.youthPct).toBeCloseTo(0.25, 6);
    expect(s.farmers).toBe(2);
  });
});

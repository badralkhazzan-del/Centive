import type { Commitment, Farmer } from "@/types";

// 6.2 Commitment & Matching.
// Demand is allocated to farmers in rounds, ranked by a score:
//   reliability 50% + spare capacity 30% + same-village bonus 20%.
// Fairness cap: no farmer may hold more than `fairnessCapPct` of a commodity's
// weekly volume. Only farmers who gave consent receive offers.

export const SCORE_WEIGHTS = { reliability: 0.5, spare: 0.3, proximity: 0.2 } as const;

export type CoverageStatus = "green" | "yellow" | "red" | "none";

export function coverageStatus(coverage: number, needed = 1): CoverageStatus {
  if (needed <= 0) return "none";
  if (coverage >= 1) return "green";
  if (coverage >= 0.8) return "yellow";
  return "red";
}

export interface MatchCandidate {
  farmerId: string;
  reliability: number;
  /** Weekly capacity for this ingredient. */
  capacityKg: number;
  /** kg per week already held by this farmer for this ingredient (any Kopdes), max over the weeks. */
  heldAnywhereKg: number;
  /** kg per week already held in this Kopdes' volume (counts toward the fairness cap). */
  heldHereKg: number;
  sameVillage: boolean;
  consentGiven: boolean;
}

export interface MatchInput {
  /** kg per week to allocate (the gap). */
  gapKg: number;
  /** The commodity's weekly volume, used for the fairness cap. */
  weeklyVolumeKg: number;
  fairnessCapPct: number;
  candidates: MatchCandidate[];
  stepKg?: number;
}

export interface Allocation {
  farmerId: string;
  kg: number;
  score: number;
}

export interface MatchResult {
  allocations: Allocation[];
  allocatedKg: number;
  unallocatedKg: number;
  capKg: number;
  ranked: { farmerId: string; score: number; headroomKg: number }[];
}

export function spareOf(c: MatchCandidate): number {
  return Math.max(0, c.capacityKg - c.heldAnywhereKg);
}

export function scoreCandidate(c: MatchCandidate, maxSpare: number): number {
  const spareRatio = maxSpare > 0 ? spareOf(c) / maxSpare : 0;
  const proximity = c.sameVillage ? 1 : 0.5;
  return (
    SCORE_WEIGHTS.reliability * c.reliability + SCORE_WEIGHTS.spare * spareRatio + SCORE_WEIGHTS.proximity * proximity
  );
}

const floorTo = (v: number, step: number) => Math.floor(v / step + 1e-9) * step;

export function allocate(input: MatchInput): MatchResult {
  const step = input.stepKg ?? 5;
  const capKg = input.fairnessCapPct * input.weeklyVolumeKg;
  const eligible = input.candidates.filter((c) => c.consentGiven && c.capacityKg > 0 && spareOf(c) > 0);
  const maxSpare = Math.max(0, ...eligible.map(spareOf));
  const ranked = eligible
    .map((c) => ({
      c,
      score: scoreCandidate(c, maxSpare),
      headroom: floorTo(Math.max(0, Math.min(spareOf(c), capKg - c.heldHereKg)), step),
    }))
    .sort((a, b) => b.score - a.score || a.c.farmerId.localeCompare(b.c.farmerId));

  const given = new Map<string, number>();
  let remaining = floorTo(Math.max(0, input.gapKg), step);
  const chunk = Math.max(step, floorTo(remaining * 0.1, step));

  let progress = true;
  while (remaining >= step && progress) {
    progress = false;
    for (const r of ranked) {
      if (remaining < step) break;
      const already = given.get(r.c.farmerId) ?? 0;
      const room = r.headroom - already;
      const take = floorTo(Math.min(chunk, room, remaining), step);
      if (take <= 0) continue;
      given.set(r.c.farmerId, already + take);
      remaining -= take;
      progress = true;
    }
  }

  const allocations = ranked
    .filter((r) => (given.get(r.c.farmerId) ?? 0) > 0)
    .map((r) => ({ farmerId: r.c.farmerId, kg: given.get(r.c.farmerId)!, score: r.score }));
  const allocatedKg = allocations.reduce((s, a) => s + a.kg, 0);
  return {
    allocations,
    allocatedKg,
    unallocatedKg: Math.max(0, input.gapKg - allocatedKg),
    capKg,
    ranked: ranked.map((r) => ({ farmerId: r.c.farmerId, score: r.score, headroomKg: r.headroom })),
  };
}

export const ACTIVE_STATUSES = new Set(["accepted", "partially_fulfilled", "fulfilled"]);

export function isActive(c: Commitment) {
  return ACTIVE_STATUSES.has(c.status);
}

/** Committed kg per week for a Kopdes, ingredient and week. */
export function committedKg(commitments: Commitment[], kopdesId: string, ingredientId: string, week: number, statuses = ACTIVE_STATUSES) {
  return commitments
    .filter((c) => c.kopdesId === kopdesId && c.ingredientId === ingredientId && statuses.has(c.status) && c.weeks.includes(week))
    .reduce((s, c) => s + c.kgPerWeek, 0);
}

/** kg per week a farmer holds for an ingredient across given weeks (max over weeks). */
export function heldByFarmer(
  commitments: Commitment[],
  farmerId: string,
  ingredientId: string,
  weeks: number[],
  kopdesId?: string,
  includeOffered = true,
) {
  let max = 0;
  for (const w of weeks) {
    const sum = commitments
      .filter(
        (c) =>
          c.farmerId === farmerId &&
          c.ingredientId === ingredientId &&
          c.weeks.includes(w) &&
          (kopdesId === undefined || c.kopdesId === kopdesId) &&
          (isActive(c) || (includeOffered && c.status === "offered")),
      )
      .reduce((s, c) => s + c.kgPerWeek, 0);
    max = Math.max(max, sum);
  }
  return max;
}

export interface InclusionSummary {
  totalKg: number;
  womenKg: number;
  youthKg: number;
  womenPct: number;
  youthPct: number;
  farmers: number;
  womenFarmers: number;
  youthFarmers: number;
}

/** Share of committed volume from women and youth farmers (shown, never used to re-rank). */
export function inclusionSummary(commitments: Commitment[], farmersById: Map<string, Farmer>): InclusionSummary {
  let totalKg = 0;
  let womenKg = 0;
  let youthKg = 0;
  const ids = new Set<string>();
  for (const c of commitments) {
    if (!isActive(c)) continue;
    const f = farmersById.get(c.farmerId);
    if (!f) continue;
    const kg = c.kgPerWeek * c.weeks.length;
    totalKg += kg;
    if (f.gender === "female") womenKg += kg;
    if (f.ageGroup === "youth") youthKg += kg;
    ids.add(f.id);
  }
  const fs = [...ids].map((id) => farmersById.get(id)!);
  return {
    totalKg,
    womenKg,
    youthKg,
    womenPct: totalKg > 0 ? womenKg / totalKg : 0,
    youthPct: totalKg > 0 ? youthKg / totalKg : 0,
    farmers: fs.length,
    womenFarmers: fs.filter((f) => f.gender === "female").length,
    youthFarmers: fs.filter((f) => f.ageGroup === "youth").length,
  };
}

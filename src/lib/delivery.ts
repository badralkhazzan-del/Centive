import type { Derived } from "@/engines/derive";
import { cellOf } from "@/engines/forecast";
import { addDays, isoWeekday, weekOfDate } from "@/engines/time";

/** The next n school days (Mon–Fri) starting from `from`. */
export function nextSchoolDays(from: string, n: number) {
  const out: string[] = [];
  for (let i = 0; out.length < n && i < 14; i++) {
    const d = addDays(from, i);
    if (isoWeekday(d) <= 5) out.push(d);
  }
  return out;
}

/** Farmers with accepted commitments for this ingredient, with their weekly kg in the delivery week. */
export function deliveryPool(d: Derived, kopdesId: string, ingredientId: string, date: string) {
  const accepted = d.data.commitments.filter(
    (c) => c.kopdesId === kopdesId && c.ingredientId === ingredientId && (c.status === "accepted" || c.status === "partially_fulfilled"),
  );
  const week = Math.max(1, weekOfDate(d.today, date));
  const inWeek = accepted.filter((c) => c.weeks.includes(week));
  const byFarmer = new Map<string, number>();
  for (const c of inWeek.length ? inWeek : accepted) byFarmer.set(c.farmerId, Math.max(byFarmer.get(c.farmerId) ?? 0, c.kgPerWeek));
  return [...byFarmer.entries()].map(([farmerId, kg]) => ({ farmerId, kg }));
}

/** Default batch kg: the chosen farmers' weekly kg times this kitchen's share of the Kopdes orders. */
export function suggestedBatchKg(
  d: Derived,
  kopdesId: string,
  kitchenId: string,
  ingredientId: string,
  date: string,
  pool: { farmerId: string; kg: number }[],
  chosen: string[],
) {
  const kitchen = d.kitchensById.get(kitchenId);
  const w = Math.max(1, weekOfDate(d.today, date));
  const kitchenOrder = kitchen ? cellOf(d.kitchenTables.get(kitchen.id) ?? new Map(), ingredientId, w).kgExpected * (kitchen.kopdesOrderShare[kopdesId] ?? 0) : 0;
  const totalOrder = cellOf(d.kopdesDemand.get(kopdesId) ?? new Map(), ingredientId, w).kgExpected;
  const fraction = totalOrder > 0 ? Math.min(1, kitchenOrder / totalOrder) : 1;
  return Math.max(1, Math.round(pool.filter((p) => chosen.includes(p.farmerId)).reduce((s, p) => s + p.kg, 0) * fraction));
}

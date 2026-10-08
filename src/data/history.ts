import type { Batch, Dish, Farmer, Ingredient, Kitchen, Leftover, MenuCycle, Payment, PlateFeedback } from "@/types";
import { forecastKitchenWeek } from "@/engines/forecast";
import { resolveDay } from "@/engines/menu";
import { indexPrices, priceForWeek } from "@/engines/priceBand";
import { batchCode, mulberry32, pickWeighted, uniform, type Rng } from "@/engines/rng";
import { addDays, isoAt, schoolDayDate } from "@/engines/time";
import { buildPrices } from "./prices";

// Four weeks of fictional history (weeks -4..-1) plus deliveries in transit this
// week, generated deterministically from a fixed seed.

export const HISTORY_WEEKS = [-4, -3, -2, -1];

const HISTORY_ITEMS: Record<string, string[]> = {
  "kd-sumbangsari": ["eggs", "chicken", "catfish", "tilapia", "spinach", "kangkung", "rice"],
  "kd-karangmulya": ["rice", "tilapia", "catfish", "spinach", "carrots", "oranges"],
};

const ANIMAL = new Set(["chicken", "eggs", "catfish", "tilapia"]);

export interface HistoryInput {
  today: string;
  kitchens: Kitchen[];
  cycles: MenuCycle[];
  farmers: Farmer[];
  dishesById: Map<string, Dish>;
  ingredientsById: Map<string, Ingredient>;
  safetyBuffer: number;
}

export interface History {
  batches: Batch[];
  payments: Payment[];
  plateFeedback: PlateFeedback[];
}

function pickFarmers(rng: Rng, farmers: Farmer[], kopdesId: string, ingredientId: string): string[] {
  const pool = farmers.filter(
    (f) => f.consentGiven && f.kopdesId === kopdesId && f.commodities.some((c) => c.ingredientId === ingredientId),
  );
  if (pool.length === 0) return [];
  const n = Math.min(pool.length, 1 + Math.floor(rng() * 3));
  const start = Math.floor(rng() * pool.length);
  return Array.from({ length: n }, (_, i) => pool[(start + i) % pool.length].id);
}

export function buildHistory(input: HistoryInput): History {
  const rng = mulberry32(20261026);
  const prices = indexPrices(buildPrices(input.today));
  const batches: Batch[] = [];
  const payments: Payment[] = [];
  const used = new Set<string>();
  let paymentCounter = 0;
  const newCode = () => {
    let c = batchCode(rng);
    while (used.has(c)) c = batchCode(rng);
    used.add(c);
    return c;
  };

  for (const week of HISTORY_WEEKS) {
    for (const k of input.kitchens) {
      const cycle = input.cycles.find((c) => c.kitchenId === k.id)!;
      const forecast = forecastKitchenWeek(
        {
          today: input.today,
          kitchen: k,
          cycle,
          dishesById: input.dishesById,
          ingredientsById: input.ingredientsById,
          overrides: [],
          safetyBuffer: input.safetyBuffer,
        },
        week,
      );
      for (const kopdesId of k.linkedKopdesIds) {
        const share = k.kopdesOrderShare[kopdesId] ?? 0;
        for (const ingredientId of HISTORY_ITEMS[kopdesId] ?? []) {
          const f = forecast.find((x) => x.ingredientId === ingredientId);
          if (!f || f.kgExpected <= 0) continue;
          const planned = f.kgExpected * share;
          const kg = Math.round(planned * (1 + uniform(rng, -0.09, 0.07)));
          const dow = Math.floor(rng() * 2);
          const deliveryDate = schoolDayDate(input.today, week, dow);
          const hh = 6 + Math.floor(rng() * 2);
          const mm = rng() < 0.5 ? "15" : "40";
          const deliveredAt = isoAt(deliveryDate, `0${hh}:${mm}`);
          const code = newCode();
          batches.push({
            id: code,
            farmerIds: pickFarmers(rng, input.farmers, kopdesId, ingredientId),
            kopdesId,
            kitchenId: k.id,
            ingredientId,
            kg,
            harvestDate: addDays(deliveryDate, ANIMAL.has(ingredientId) || ingredientId === "rice" ? -1 : 0),
            grade: rng() < 0.85 ? "A" : "B",
            coldChainChecked: ANIMAL.has(ingredientId),
            createdAt: isoAt(addDays(deliveryDate, -1), "15:00"),
            plannedDeliveryDate: deliveryDate,
            deliveredAt,
            receivedBy: "Kepala SPPG",
            receivedChecked: true,
            photoPlaceholder: `photo-${ingredientId}`,
            week,
          });

          const price = priceForWeek(prices, ingredientId, input.today, week);
          const verifiedAt = isoAt(deliveryDate, `0${hh + 1}:${mm}`);
          // Older weeks are fully paid; the latest weeks still have open steps,
          // including a few past the 7-day SLA (overdue).
          let kitchenPaidAt: string | undefined;
          let farmerPaidAt: string | undefined;
          const n = paymentCounter++;
          const stuck = week === -2 && (n % 7 === 3 || n % 11 === 6);
          if (week <= -2 && !stuck) {
            const kp = addDays(deliveryDate, 3 + Math.floor(rng() * 4));
            kitchenPaidAt = isoAt(kp, "10:00");
            farmerPaidAt = isoAt(addDays(kp, 1 + Math.floor(rng() * 2)), "14:00");
          } else if (stuck && n % 7 === 3) {
            kitchenPaidAt = isoAt(addDays(deliveryDate, 5), "10:00");
          } else if (week === -1 && n % 3 === 0) {
            kitchenPaidAt = isoAt(addDays(deliveryDate, 4), "10:00");
          }
          payments.push({
            batchId: code,
            deliveredAt,
            verifiedAt,
            kitchenPaidAt,
            farmerPaidAt,
            amountRp: Math.round((kg * price) / 100) * 100,
          });
        }
      }
    }
  }

  // Deliveries packed this morning, expected today and tomorrow (not yet received).
  const inTransit: [string, string, string, number][] = [
    ["kd-sumbangsari", "k-sumbang-1", "eggs", 0],
    ["kd-sumbangsari", "k-sumbang-1", "spinach", 1],
    ["kd-sumbangsari", "k-sumbang-2", "eggs", 0],
    ["kd-karangmulya", "k-kembaran-1", "carrots", 1],
  ];
  for (const [kopdesId, kitchenId, ingredientId, dow] of inTransit) {
    const k = input.kitchens.find((x) => x.id === kitchenId)!;
    const cycle = input.cycles.find((c) => c.kitchenId === kitchenId)!;
    const f = forecastKitchenWeek(
      {
        today: input.today,
        kitchen: k,
        cycle,
        dishesById: input.dishesById,
        ingredientsById: input.ingredientsById,
        overrides: [],
        safetyBuffer: input.safetyBuffer,
      },
      0,
    ).find((x) => x.ingredientId === ingredientId);
    const kg = Math.round(((f?.kgExpected ?? 100) * (k.kopdesOrderShare[kopdesId] ?? 0.3)) / 2);
    const date = schoolDayDate(input.today, 0, dow);
    batches.push({
      id: newCode(),
      farmerIds: pickFarmers(rng, input.farmers, kopdesId, ingredientId),
      kopdesId,
      kitchenId,
      ingredientId,
      kg,
      harvestDate: addDays(date, -1),
      grade: "A",
      coldChainChecked: ANIMAL.has(ingredientId),
      createdAt: isoAt(addDays(date, -1), "16:00"),
      plannedDeliveryDate: date,
      photoPlaceholder: `photo-${ingredientId}`,
      week: 0,
    });
  }

  return { batches, payments, plateFeedback: buildPlateFeedback(input) };
}

const LEFTOVERS: Leftover[] = ["none", "quarter", "half", "most"];

function leftoverWeights(dishId: string): number[] {
  if (dishId === "nila_bakar") return [0.18, 0.3, 0.32, 0.2]; // bones: children leave more
  if (dishId.startsWith("sayur") || dishId.startsWith("tumis") || dishId.startsWith("oseng")) return [0.42, 0.34, 0.17, 0.07];
  return [0.6, 0.28, 0.09, 0.03];
}

function buildPlateFeedback(input: HistoryInput): PlateFeedback[] {
  const rng = mulberry32(777);
  const out: PlateFeedback[] = [];
  for (const week of HISTORY_WEEKS) {
    for (const k of input.kitchens) {
      const cycle = input.cycles.find((c) => c.kitchenId === k.id)!;
      for (let dow = 0; dow < 5; dow++) {
        const day = resolveDay(k, cycle, input.dishesById, [], input.today, week, dow);
        if (!day.operating) continue;
        for (const d of day.dishes) {
          if (d.dishId === "nasi_putih") continue;
          out.push({
            kitchenId: k.id,
            date: day.date,
            dishId: d.dishId,
            leftover: pickWeighted(rng, LEFTOVERS, leftoverWeights(d.dishId)),
          });
        }
      }
    }
  }
  return out;
}

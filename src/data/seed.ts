import type { AppData, ChatMessage, Commitment, Settings } from "@/types";
import { commitmentBand, indexPrices } from "@/engines/priceBand";
import { addDays, DEMO_TODAY, isoAt, mondayOf, weekStart } from "@/engines/time";
import { SEED_COMMITMENTS } from "./commitments";
import { DISHES } from "./dishes";
import { buildFarmers } from "./farmers";
import { buildHistory } from "./history";
import { INGREDIENTS } from "./ingredients";
import { buildMenuCycle } from "./menu";
import { buildKitchens, KOPDES, SEED_LOCKS } from "./places";
import { buildPrices } from "./prices";

/** Bump when the persisted shape changes; older saved states are replaced by the seed. */
export const SEED_VERSION = 4;

export const DEFAULT_SETTINGS: Settings = {
  priceBandFloorPct: 0.95,
  priceBandCeilingPct: 1.1,
  shieldPriceRisePct: 0.1,
  shieldDemandSharePct: 0.25,
  fairnessCapPct: 0.3,
  safetyBuffer: 0.05,
  attendanceRate: 0.92,
  paymentSlaDays: 7,
  commitmentLeadWeeks: 2,
  substitution: {
    minProteinPct: 0.95,
    energyTolerancePct: 0.1,
    leadTimeDays: 3,
    maxMainProteinPerWeek: 2,
    surplusThreshold: 1.2,
    maxStapleTopUpG: 40,
  },
  // Estimated weekly market supply around each Kopdes (kg/week, L for oil). Demo assumptions.
  marketSupplyKgPerWeek: {
    rice: 20000,
    chicken: 6000,
    eggs: 2400,
    catfish: 4000,
    tilapia: 3500,
    tempe: 3000,
    tofu: 3000,
    spinach: 3500,
    kangkung: 3000,
    long_beans: 2500,
    carrots: 2500,
    cabbage: 2500,
    bananas: 8000,
    oranges: 8000,
    cooking_oil: 5000,
  },
};

function seedChat(today: string): ChatMessage[] {
  return [
    {
      id: "chat-seed-1",
      farmerId: "f-darto",
      from: "kopdes",
      kind: "confirm",
      textId:
        "Terima kasih Pak Darto 🙏 Pesanan telur 50 kg/minggu untuk minggu 1–2 (2–13 Nov) sudah tercatat. Harga Rp 26.600–30.800/kg.",
      textEn: "Thank you Pak Darto. The order of 50 kg/week of eggs for weeks 1–2 (2–13 Nov) is recorded. Price Rp 26,600–30,800/kg.",
      at: isoAt(addDays(today, -14), "09:12"),
    },
    {
      id: "chat-seed-2",
      farmerId: "f-darto",
      from: "kopdes",
      kind: "payment",
      textId: "💸 Pembayaran Rp 1.344.000 untuk telur 48 kg (pengiriman 12 Okt) sudah ditransfer ke rekening Bapak. Terima kasih!",
      textEn: "Payment of Rp 1,344,000 for 48 kg of eggs (delivered 12 Oct) has been transferred to your account. Thank you!",
      at: isoAt(addDays(today, -9), "14:05"),
    },
    {
      id: "chat-seed-3",
      farmerId: "f-darto",
      from: "farmer",
      kind: "reply",
      textId: "Sudah diterima, matur nuwun 🙏",
      textEn: "Received, thank you.",
      at: isoAt(addDays(today, -9), "14:30"),
    },
  ];
}

/** The fictional sample region. `today` defaults to the fixed demo date; live workspaces pass the real date. */
export function buildSeedState(today: string = DEMO_TODAY): AppData {
  const ingredients = INGREDIENTS.map((i) => ({ ...i, allergens: [...i.allergens], seasonalityByMonth: [...i.seasonalityByMonth] }));
  const dishes = DISHES.map((d) => ({ ...d, components: d.components.map((c) => ({ ...c, gramsPerPortion: { ...c.gramsPerPortion } })) }));
  const kitchens = buildKitchens();
  const farmers = buildFarmers();
  const kopdes = KOPDES.map((k) => ({
    ...k,
    neighborKopdesIds: [...k.neighborKopdesIds],
    memberFarmerIds: farmers.filter((f) => f.kopdesId === k.id).map((f) => f.id),
  }));
  const menuCycles = kitchens.map((k) => buildMenuCycle(k.id, SEED_LOCKS[k.id] ?? [], weekStart(mondayOf(today), 1)));
  const prices = buildPrices(today);
  const priceIdx = indexPrices(prices);

  const commitments: Commitment[] = SEED_COMMITMENTS.map(([farmerId, kopdesId, ingredientId, weeks, kgPerWeek], i) => {
    const farmer = farmers.find((f) => f.id === farmerId)!;
    return {
      id: `c-seed-${i + 1}`,
      farmerId,
      kopdesId,
      ingredientId,
      weeks: [...weeks],
      kgPerWeek,
      offeredKgPerWeek: kgPerWeek,
      priceBand: commitmentBand(priceIdx, ingredientId, today, {
        floorPct: DEFAULT_SETTINGS.priceBandFloorPct,
        ceilingPct: DEFAULT_SETTINGS.priceBandCeilingPct,
      }),
      status: "accepted",
      createdAt: isoAt(addDays(today, -14), "09:00"),
      respondedAt: isoAt(addDays(today, -14), "11:00"),
      origin: farmer.kopdesId === kopdesId ? "seed" : "neighbor",
    };
  });

  const history = buildHistory({
    today,
    kitchens,
    cycles: menuCycles,
    farmers,
    dishesById: new Map(dishes.map((d) => [d.id, d])),
    ingredientsById: new Map(ingredients.map((i) => [i.id, i])),
    safetyBuffer: DEFAULT_SETTINGS.safetyBuffer,
  });

  return {
    version: SEED_VERSION,
    today,
    ui: {
      lang: "en",
      role: null,
      activeKitchenId: "k-sumbang-1",
      activeKopdesId: "kd-sumbangsari",
      activeFarmerId: "f-darto",
    },
    settings: structuredClone(DEFAULT_SETTINGS),
    ingredients,
    dishes,
    menuCycles,
    kitchens,
    kopdes,
    farmers,
    prices,
    commitments,
    overrides: [],
    decisions: [],
    switchRequests: [],
    batches: history.batches,
    payments: history.payments,
    plateFeedback: history.plateFeedback,
    auditLog: [
      {
        id: "log-seed",
        timestamp: isoAt(today, "06:00"),
        actorRole: "system",
        action: "demo_loaded",
        details: "Fictional demo data loaded (Banyumas, Central Java).",
      },
    ],
    chat: seedChat(today),
    seq: 1,
  };
}

/**
 * A new live workspace with no kitchens, cooperatives or farmers yet. It starts with
 * the standard ingredient list, dish library and placeholder prices so every engine
 * works as soon as the first kitchen and Kopdes are added.
 */
export function buildEmptyState(today: string): AppData {
  const base = buildSeedState(today);
  return {
    ...base,
    ui: { lang: "en", role: null, activeKitchenId: "", activeKopdesId: "", activeFarmerId: "" },
    menuCycles: [],
    kitchens: [],
    kopdes: [],
    farmers: [],
    commitments: [],
    batches: [],
    payments: [],
    plateFeedback: [],
    chat: [],
    auditLog: [
      {
        id: "log-created",
        timestamp: isoAt(today, "00:00"),
        actorRole: "system",
        action: "workspace_created",
        details: "Workspace created.",
      },
    ],
  };
}

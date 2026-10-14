import type { AppData, AuditLog, Dish, DishComponent, Farmer, FarmerCommodity, Ingredient, Kitchen, Kopdes, PricePoint, PriceSource } from "@/types";
import { BASE_MENU_DAYS } from "@/data/menu";
import { DEMO_CALENDAR } from "@/data/places";
import { mondayOf, weekStart } from "@/engines/time";
import type { Now } from "./commands";

// Data-entry commands for real workspaces: add, edit and remove the kitchens,
// cooperatives, farmers, ingredients, prices, dishes and menu days the engines use.
// Like every command they are pure, so the browser and the server run the same code.

function log(data: AppData, now: Now, action: string, details: string): AuditLog[] {
  return [{ id: `log-${data.seq}-${data.auditLog.length + 1}`, timestamp: now, actorRole: "regency", action, details }, ...data.auditLog];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const text = (v: unknown, fallback = "") => (typeof v === "string" ? v.trim().slice(0, 120) : fallback);

/** A safe id from a name, unique among `taken`. */
export function slugId(prefix: string, name: string, taken: Set<string>): string {
  const base =
    `${prefix}-${name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 24)}` || `${prefix}-item`;
  let id = base;
  for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
  return id;
}

/** "0812-3456-7890" style mask that keeps the last 4 digits. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/[^0-9]/g, "");
  if (d.length < 4) return "";
  return `08xx-xxxx-${d.slice(-4)}`;
}

// ----- Kitchens ----------------------------------------------------------------------

export interface KitchenInput {
  id?: string;
  name: string;
  subdistrict?: string;
  village?: string;
  lat?: number;
  lng?: number;
  beneficiaries?: { small: number; large: number };
  attendanceRate?: number;
  linkedKopdesIds?: string[];
  kopdesOrderShare?: Record<string, number>;
  paymentSlaDays?: number;
  seasoningCostRp?: { small: number; large: number };
  allergenExclusions?: Kitchen["allergenExclusions"];
}

export function saveKitchen(data: AppData, now: Now, input: KitchenInput): AppData {
  const existing = input.id ? data.kitchens.find((k) => k.id === input.id) : undefined;
  const id = existing?.id ?? input.id ?? slugId("k", input.name, new Set(data.kitchens.map((k) => k.id)));
  const validKopdes = new Set(data.kopdes.map((k) => k.id));
  const linked = (input.linkedKopdesIds ?? existing?.linkedKopdesIds ?? []).filter((x) => validKopdes.has(x));
  const share: Record<string, number> = {};
  for (const kd of linked) share[kd] = clamp(num(input.kopdesOrderShare?.[kd], existing?.kopdesOrderShare[kd] ?? 0.5), 0, 1);
  const kitchen: Kitchen = {
    id,
    name: text(input.name, existing?.name ?? "Kitchen") || "Kitchen",
    subdistrict: text(input.subdistrict, existing?.subdistrict ?? ""),
    village: text(input.village, existing?.village ?? ""),
    lat: num(input.lat, existing?.lat ?? -7.43),
    lng: num(input.lng, existing?.lng ?? 109.25),
    beneficiaries: {
      small: Math.round(clamp(num(input.beneficiaries?.small, existing?.beneficiaries.small ?? 0), 0, 20000)),
      large: Math.round(clamp(num(input.beneficiaries?.large, existing?.beneficiaries.large ?? 0), 0, 20000)),
    },
    attendanceRate: clamp(num(input.attendanceRate, existing?.attendanceRate ?? data.settings.attendanceRate), 0.5, 1),
    schoolCalendar: existing?.schoolCalendar ?? { operatingWeekdays: [...DEMO_CALENDAR.operatingWeekdays], holidays: [] },
    linkedKopdesIds: linked,
    kopdesOrderShare: share,
    paymentSlaDays: Math.round(clamp(num(input.paymentSlaDays, existing?.paymentSlaDays ?? data.settings.paymentSlaDays), 1, 60)),
    allergenExclusions: input.allergenExclusions ?? existing?.allergenExclusions ?? [],
    seasoningCostRp: input.seasoningCostRp ?? existing?.seasoningCostRp ?? { small: 600, large: 800 },
  };
  const menuCycles = data.menuCycles.some((c) => c.kitchenId === id)
    ? data.menuCycles
    : [
        ...data.menuCycles,
        {
          id: `cycle-${id}`,
          kitchenId: id,
          days: BASE_MENU_DAYS.map((d) => ({ ...d, dishIds: d.dishIds.filter((x) => data.dishes.some((dish) => dish.id === x)) })),
          lockedDishIds: data.dishes.some((d) => d.id === "nasi_putih") ? ["nasi_putih"] : [],
          anchorMonday: weekStart(mondayOf(data.today), 1),
        },
      ];
  const next: AppData = {
    ...data,
    seq: data.seq + 1,
    kitchens: existing ? data.kitchens.map((k) => (k.id === id ? kitchen : k)) : [...data.kitchens, kitchen],
    menuCycles,
    ui: data.ui.activeKitchenId ? data.ui : { ...data.ui, activeKitchenId: id },
  };
  return { ...next, auditLog: log(next, now, existing ? "kitchen_edited" : "kitchen_added", `${kitchen.name} (${kitchen.beneficiaries.small + kitchen.beneficiaries.large} children).`) };
}

export function deleteKitchen(data: AppData, now: Now, kitchenId: string): AppData {
  const k = data.kitchens.find((x) => x.id === kitchenId);
  if (!k) return data;
  const kitchens = data.kitchens.filter((x) => x.id !== kitchenId);
  const next: AppData = {
    ...data,
    seq: data.seq + 1,
    kitchens,
    menuCycles: data.menuCycles.filter((c) => c.kitchenId !== kitchenId),
    overrides: data.overrides.filter((o) => o.kitchenId !== kitchenId),
    decisions: data.decisions.filter((d) => !d.key.startsWith(`${kitchenId}:`)),
    ui: data.ui.activeKitchenId === kitchenId ? { ...data.ui, activeKitchenId: kitchens[0]?.id ?? "" } : data.ui,
  };
  return { ...next, auditLog: log(next, now, "kitchen_removed", `${k.name} removed.`) };
}

/** Holidays and operating weekdays for a kitchen's school calendar. */
export function setSchoolCalendar(data: AppData, now: Now, kitchenId: string, operatingWeekdays: number[], holidays: Kitchen["schoolCalendar"]["holidays"]): AppData {
  const k = data.kitchens.find((x) => x.id === kitchenId);
  if (!k) return data;
  const days = [...new Set(operatingWeekdays.filter((d) => d >= 1 && d <= 6))].sort();
  const hol = holidays
    .filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.date))
    .map((h) => ({ date: h.date, nameEn: text(h.nameEn, "Holiday") || "Holiday", nameId: text(h.nameId, "Libur") || "Libur" }));
  const next: AppData = { ...data, seq: data.seq + 1, kitchens: data.kitchens.map((x) => (x.id === kitchenId ? { ...x, schoolCalendar: { operatingWeekdays: days, holidays: hol } } : x)) };
  return { ...next, auditLog: log(next, now, "calendar_updated", `${k.name}: ${days.length} school days a week, ${hol.length} holidays.`) };
}

// ----- Cooperatives (Kopdes) ---------------------------------------------------------

export interface KopdesInput {
  id?: string;
  name: string;
  village?: string;
  subdistrict?: string;
  lat?: number;
  lng?: number;
  neighborKopdesIds?: string[];
}

export function saveKopdes(data: AppData, now: Now, input: KopdesInput): AppData {
  const existing = input.id ? data.kopdes.find((k) => k.id === input.id) : undefined;
  const id = existing?.id ?? input.id ?? slugId("kd", input.name, new Set(data.kopdes.map((k) => k.id)));
  const others = new Set(data.kopdes.map((k) => k.id).filter((x) => x !== id));
  const kd: Kopdes = {
    id,
    name: text(input.name, existing?.name ?? "Kopdes") || "Kopdes",
    village: text(input.village, existing?.village ?? ""),
    subdistrict: text(input.subdistrict, existing?.subdistrict ?? ""),
    lat: num(input.lat, existing?.lat ?? -7.43),
    lng: num(input.lng, existing?.lng ?? 109.25),
    memberFarmerIds: existing?.memberFarmerIds ?? [],
    neighborKopdesIds: (input.neighborKopdesIds ?? existing?.neighborKopdesIds ?? []).filter((x) => others.has(x)),
  };
  // Neighbor links go both ways.
  const kopdes = (existing ? data.kopdes.map((k) => (k.id === id ? kd : k)) : [...data.kopdes, kd]).map((k) => {
    if (k.id === id) return k;
    const linked = kd.neighborKopdesIds.includes(k.id);
    const has = k.neighborKopdesIds.includes(id);
    if (linked === has) return k;
    return { ...k, neighborKopdesIds: linked ? [...k.neighborKopdesIds, id] : k.neighborKopdesIds.filter((x) => x !== id) };
  });
  const next: AppData = { ...data, seq: data.seq + 1, kopdes, ui: data.ui.activeKopdesId ? data.ui : { ...data.ui, activeKopdesId: id } };
  return { ...next, auditLog: log(next, now, existing ? "kopdes_edited" : "kopdes_added", `${kd.name}.`) };
}

/** Removes a Kopdes with its member farmers, their open offers and chats. */
export function deleteKopdes(data: AppData, now: Now, kopdesId: string): AppData {
  const kd = data.kopdes.find((x) => x.id === kopdesId);
  if (!kd) return data;
  const gone = new Set(data.farmers.filter((f) => f.kopdesId === kopdesId).map((f) => f.id));
  const kopdes = data.kopdes.filter((x) => x.id !== kopdesId).map((k) => ({ ...k, neighborKopdesIds: k.neighborKopdesIds.filter((x) => x !== kopdesId) }));
  const next: AppData = {
    ...data,
    seq: data.seq + 1,
    kopdes,
    farmers: data.farmers.filter((f) => !gone.has(f.id)),
    commitments: data.commitments.filter((c) => c.kopdesId !== kopdesId && !gone.has(c.farmerId)),
    chat: data.chat.filter((m) => !gone.has(m.farmerId)),
    switchRequests: data.switchRequests.filter((r) => r.kopdesId !== kopdesId),
    kitchens: data.kitchens.map((k) => {
      if (!k.linkedKopdesIds.includes(kopdesId)) return k;
      const share = { ...k.kopdesOrderShare };
      delete share[kopdesId];
      return { ...k, linkedKopdesIds: k.linkedKopdesIds.filter((x) => x !== kopdesId), kopdesOrderShare: share };
    }),
    ui: data.ui.activeKopdesId === kopdesId ? { ...data.ui, activeKopdesId: kopdes[0]?.id ?? "" } : data.ui,
  };
  return { ...next, auditLog: log(next, now, "kopdes_removed", `${kd.name} removed with ${gone.size} member farmers.`) };
}

// ----- Farmers -----------------------------------------------------------------------

export interface FarmerInput {
  id?: string;
  displayName: string;
  village?: string;
  kopdesId: string;
  gender?: Farmer["gender"];
  ageGroup?: Farmer["ageGroup"];
  commodities?: FarmerCommodity[];
  reliabilityScore?: number;
  /** Full phone number, kept only for WhatsApp links; other users see the masked form. */
  phone?: string;
  consentGiven?: boolean;
}

export function saveFarmer(data: AppData, now: Now, input: FarmerInput): AppData {
  if (!data.kopdes.some((k) => k.id === input.kopdesId)) return data;
  const existing = input.id ? data.farmers.find((f) => f.id === input.id) : undefined;
  const id = existing?.id ?? input.id ?? slugId("f", input.displayName, new Set(data.farmers.map((f) => f.id)));
  const ingredientIds = new Set(data.ingredients.map((i) => i.id));
  const phone = input.phone !== undefined ? input.phone.replace(/[^0-9+]/g, "").slice(0, 16) : existing?.phone;
  const farmer: Farmer = {
    id,
    displayName: (text(input.displayName, existing?.displayName ?? "") || "Petani").split(/\s+/)[0],
    village: text(input.village, existing?.village ?? ""),
    kopdesId: input.kopdesId,
    gender: input.gender ?? existing?.gender ?? "female",
    ageGroup: input.ageGroup ?? existing?.ageGroup ?? "adult",
    commodities: (input.commodities ?? existing?.commodities ?? [])
      .filter((c) => ingredientIds.has(c.ingredientId) && c.weeklyCapacityKg > 0)
      .map((c) => ({ ingredientId: c.ingredientId, weeklyCapacityKg: Math.round(clamp(c.weeklyCapacityKg, 0, 100000)) })),
    reliabilityScore: clamp(num(input.reliabilityScore, existing?.reliabilityScore ?? 0.8), 0, 1),
    phoneMasked: phone ? maskPhone(phone) : (existing?.phoneMasked ?? ""),
    ...(phone ? { phone } : {}),
    consentGiven: input.consentGiven ?? existing?.consentGiven ?? false,
  };
  const farmers = existing ? data.farmers.map((f) => (f.id === id ? farmer : f)) : [...data.farmers, farmer];
  const kopdes = data.kopdes.map((k) => {
    const member = k.id === farmer.kopdesId;
    const has = k.memberFarmerIds.includes(id);
    if (member === has) return k;
    return { ...k, memberFarmerIds: member ? [...k.memberFarmerIds, id] : k.memberFarmerIds.filter((x) => x !== id) };
  });
  const next: AppData = { ...data, seq: data.seq + 1, farmers, kopdes, ui: data.ui.activeFarmerId ? data.ui : { ...data.ui, activeFarmerId: id } };
  return {
    ...next,
    auditLog: log(next, now, existing ? "farmer_edited" : "farmer_added", `${farmer.displayName} (${farmer.village}), consent ${farmer.consentGiven ? "given" : "not given"}.`),
  };
}

export function deleteFarmer(data: AppData, now: Now, farmerId: string): AppData {
  const f = data.farmers.find((x) => x.id === farmerId);
  if (!f) return data;
  const farmers = data.farmers.filter((x) => x.id !== farmerId);
  const next: AppData = {
    ...data,
    seq: data.seq + 1,
    farmers,
    kopdes: data.kopdes.map((k) => ({ ...k, memberFarmerIds: k.memberFarmerIds.filter((x) => x !== farmerId) })),
    commitments: data.commitments.filter((c) => c.farmerId !== farmerId || c.status === "accepted" || c.status === "fulfilled"),
    chat: data.chat.filter((m) => m.farmerId !== farmerId),
    ui: data.ui.activeFarmerId === farmerId ? { ...data.ui, activeFarmerId: farmers[0]?.id ?? "" } : data.ui,
  };
  return { ...next, auditLog: log(next, now, "farmer_removed", `${f.displayName} removed.`) };
}

// ----- Ingredients and prices --------------------------------------------------------

export type IngredientInput = Partial<Omit<Ingredient, "id">> & { id?: string; nameEn: string; nameId: string };

export function saveIngredient(data: AppData, now: Now, input: IngredientInput): AppData {
  const existing = input.id ? data.ingredients.find((i) => i.id === input.id) : undefined;
  const id = existing?.id ?? input.id ?? slugId("i", input.nameEn, new Set(data.ingredients.map((i) => i.id))).replace(/^i-/, "");
  const base: Ingredient = existing ?? {
    id,
    nameEn: "",
    nameId: "",
    tkpiName: "",
    foodGroup: "vegetable",
    unit: "kg",
    energyKcalPer100g: 0,
    proteinGPer100g: 0,
    edibleFraction: 1,
    allergens: [],
    seasonalityByMonth: Array.from({ length: 12 }, () => 1),
    seasonal: false,
    dataSource: "Entered by the team",
    verified: false,
    emoji: "🥬",
  };
  const ing: Ingredient = {
    ...base,
    ...input,
    id,
    nameEn: text(input.nameEn, base.nameEn) || base.nameEn || id,
    nameId: text(input.nameId, base.nameId) || base.nameId || id,
    energyKcalPer100g: clamp(num(input.energyKcalPer100g, base.energyKcalPer100g), 0, 1000),
    proteinGPer100g: clamp(num(input.proteinGPer100g, base.proteinGPer100g), 0, 100),
    edibleFraction: clamp(num(input.edibleFraction, base.edibleFraction), 0.05, 1),
    allergens: input.allergens ?? base.allergens,
    seasonalityByMonth: input.seasonalityByMonth ?? base.seasonalityByMonth,
  };
  const next: AppData = { ...data, seq: data.seq + 1, ingredients: existing ? data.ingredients.map((i) => (i.id === id ? ing : i)) : [...data.ingredients, ing] };
  return {
    ...next,
    auditLog: log(next, now, existing ? "ingredient_edited" : "ingredient_added", `${ing.nameEn}: ${ing.energyKcalPer100g} kcal, ${ing.proteinGPer100g} g protein, edible ${Math.round(ing.edibleFraction * 100)}% (${ing.verified ? "verified" : "to verify"}).`),
  };
}

export interface PriceEntry {
  ingredientId: string;
  weekStart: string;
  priceRpPerKg: number;
  source?: PriceSource;
}

/** Add or replace weekly prices (for example from a PIHPS export or a market survey). */
export function setPrices(data: AppData, now: Now, entries: PriceEntry[], source: PriceSource = "PIHPS"): AppData {
  const valid = entries.filter(
    (e) => data.ingredients.some((i) => i.id === e.ingredientId) && /^\d{4}-\d{2}-\d{2}$/.test(e.weekStart) && Number.isFinite(e.priceRpPerKg) && e.priceRpPerKg > 0,
  );
  if (valid.length === 0) return data;
  const key = (p: { ingredientId: string; weekStart: string }) => `${p.ingredientId}|${mondayOf(p.weekStart)}`;
  const incoming = new Map<string, PricePoint>(
    valid.map((e) => [key(e), { ingredientId: e.ingredientId, weekStart: mondayOf(e.weekStart), priceRpPerKg: Math.round(e.priceRpPerKg), source: e.source ?? source }]),
  );
  const prices = [...data.prices.filter((p) => !incoming.has(key(p))), ...incoming.values()].sort(
    (a, b) => a.ingredientId.localeCompare(b.ingredientId) || a.weekStart.localeCompare(b.weekStart),
  );
  const next: AppData = { ...data, seq: data.seq + 1, prices };
  return { ...next, auditLog: log(next, now, "prices_updated", `${incoming.size} weekly prices saved (${source}).`) };
}

// ----- Dishes and menus --------------------------------------------------------------

export interface DishInput {
  id?: string;
  nameEn: string;
  nameId: string;
  mainIngredientId: string;
  components: DishComponent[];
}

export function saveDish(data: AppData, now: Now, input: DishInput): AppData {
  const ingredientIds = new Set(data.ingredients.map((i) => i.id));
  const components = input.components
    .filter((c) => ingredientIds.has(c.ingredientId))
    .map((c) => ({ ingredientId: c.ingredientId, gramsPerPortion: { small: clamp(num(c.gramsPerPortion.small, 0), 0, 1000), large: clamp(num(c.gramsPerPortion.large, 0), 0, 1000) } }));
  if (components.length === 0 || !ingredientIds.has(input.mainIngredientId)) return data;
  const existing = input.id ? data.dishes.find((d) => d.id === input.id) : undefined;
  const id = existing?.id ?? input.id ?? slugId("d", input.nameEn, new Set(data.dishes.map((d) => d.id)));
  const dish: Dish = { id, nameEn: text(input.nameEn) || id, nameId: text(input.nameId) || text(input.nameEn) || id, mainIngredientId: input.mainIngredientId, components };
  const next: AppData = { ...data, seq: data.seq + 1, dishes: existing ? data.dishes.map((d) => (d.id === id ? dish : d)) : [...data.dishes, dish] };
  return { ...next, auditLog: log(next, now, existing ? "dish_edited" : "dish_added", `${dish.nameEn} (${components.length} ingredients).`) };
}

/** Set the dishes served on one day (1..20) of a kitchen's 4-week cycle. */
export function setMenuDay(data: AppData, now: Now, kitchenId: string, dayIndex: number, dishIds: string[]): AppData {
  const cycle = data.menuCycles.find((c) => c.kitchenId === kitchenId);
  if (!cycle || dayIndex < 1 || dayIndex > 20) return data;
  const valid = [...new Set(dishIds.filter((id) => data.dishes.some((d) => d.id === id)))];
  const days = cycle.days.some((d) => d.dayIndex === dayIndex)
    ? cycle.days.map((d) => (d.dayIndex === dayIndex ? { ...d, dishIds: valid } : d))
    : [...cycle.days, { dayIndex, dishIds: valid }].sort((a, b) => a.dayIndex - b.dayIndex);
  const k = data.kitchens.find((x) => x.id === kitchenId);
  const next: AppData = { ...data, seq: data.seq + 1, menuCycles: data.menuCycles.map((c) => (c.kitchenId === kitchenId ? { ...c, days } : c)) };
  return { ...next, auditLog: log(next, now, "menu_day_changed", `${k?.name ?? kitchenId}: cycle day ${dayIndex} now has ${valid.length} dishes.`) };
}

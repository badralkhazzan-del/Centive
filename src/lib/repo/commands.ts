import type {
  AppData,
  AuditLog,
  Batch,
  ChatMessage,
  Commitment,
  Farmer,
  Kitchen,
  Lang,
  Leftover,
  Role,
  Settings,
  SubstitutionSuggestion,
} from "@/types";
import { derive, type Derived } from "@/engines/derive";
import { formatDate, formatNumber, formatRp, formatWeeks } from "@/engines/format";
import { allocate, heldByFarmer, type MatchCandidate } from "@/engines/matching";
import { commitmentBand } from "@/engines/priceBand";
import { batchCodeFromSeq } from "@/engines/rng";
import { suggestionKey, toOverride } from "@/engines/substitution";
import { weekOfDate } from "@/engines/time";

// Pure state transitions. Every command returns a new AppData; the repository
// persists it. Approvals, rejections and overrides are written to the audit log.

export type Now = string; // ISO timestamp of the change

function log(data: AppData, now: Now, actorRole: AuditLog["actorRole"], action: string, details: string): AuditLog[] {
  return [{ id: `log-${data.seq}-${data.auditLog.length + 1}`, timestamp: now, actorRole, action, details }, ...data.auditLog];
}

function nextSeq(data: AppData) {
  return data.seq + 1;
}

export function shortKopdesName(name: string) {
  return name.replace("Merah Putih ", "").replace(" (sample)", "");
}

export function honorific(f: Pick<Farmer, "gender">) {
  return f.gender === "female" ? "Bu" : "Pak";
}

const rupiahRange = (floor: number, ceiling: number, lang: Lang) =>
  `Rp ${formatNumber(floor, lang)}–${formatNumber(ceiling, lang)}/kg`;

// ----- UI preferences -----------------------------------------------------------

export function setLang(data: AppData, lang: Lang): AppData {
  return { ...data, ui: { ...data.ui, lang } };
}

export function setRole(data: AppData, role: Role | null): AppData {
  return { ...data, ui: { ...data.ui, role } };
}

export function setActive(data: AppData, patch: Partial<Pick<AppData["ui"], "activeKitchenId" | "activeKopdesId" | "activeFarmerId">>): AppData {
  return { ...data, ui: { ...data.ui, ...patch } };
}

// ----- Commitments and offers ------------------------------------------------------

export interface OfferResult {
  data: AppData;
  created: Commitment[];
  unallocatedKg: number;
  offerWeeks: number[];
}

function offerMessage(data: AppData, f: Farmer, c: Commitment, orderingKopdesName: string, viaName?: string): ChatMessage {
  const ing = data.ingredients.find((i) => i.id === c.ingredientId)!;
  const via = viaName ? ` (lewat ${viaName})` : "";
  const viaEn = viaName ? ` (through ${viaName})` : "";
  return {
    id: `chat-${data.seq}-${c.id}`,
    farmerId: f.id,
    from: "kopdes",
    kind: "offer",
    commitmentId: c.id,
    textId:
      `Halo ${honorific(f)} ${f.displayName} 👋 ${orderingKopdesName}${via} butuh **${ing.nameId.toLowerCase()} ${c.kgPerWeek} kg/minggu**, ` +
      `${formatWeeks(c.weeks, "id")}. Harga ${rupiahRange(c.priceBand.floor, c.priceBand.ceiling, "id")}. ` +
      `Balas: 1 = Sanggup semua, 2 = Sanggup sebagian, 3 = Tidak bisa`,
    textEn:
      `Hello ${honorific(f)} ${f.displayName} 👋 ${orderingKopdesName}${viaEn} needs **${ing.nameEn.toLowerCase()} ${c.kgPerWeek} kg/week**, ` +
      `${formatWeeks(c.weeks, "en")}. Price ${rupiahRange(c.priceBand.floor, c.priceBand.ceiling, "en")}. ` +
      `Reply: 1 = Can supply all, 2 = Can supply part, 3 = Cannot`,
    buttons: [
      { label: "1 = Sanggup semua", value: "1" },
      { label: "2 = Sanggup sebagian", value: "2" },
      { label: "3 = Tidak bisa", value: "3" },
    ],
    at: "",
  };
}

/**
 * Run the matching engine for a Kopdes and ingredient and send offers (via the
 * simulated WhatsApp) to the selected farmers. `pool` chooses whose farmers:
 * the Kopdes' own members, or the neighbor Kopdes' members (Backup Ladder b).
 */
export function sendOffers(
  data: AppData,
  now: Now,
  kopdesId: string,
  ingredientId: string,
  weeks?: number[],
  pool: "members" | "neighbors" = "members",
  derived: Derived = derive(data),
): OfferResult {
  const kd = derived.kopdesById.get(kopdesId);
  const ing = derived.ingredientsById.get(ingredientId);
  if (!kd || !ing) return { data, created: [], unallocatedKg: 0, offerWeeks: [] };
  const targetWeeks = weeks ?? derived.windowWeeks;
  const gaps = targetWeeks.map((w) => {
    const c = derived.coverage(kopdesId, ingredientId, w);
    return { w, needed: c.needed, gap: c.needed - c.committed - c.offered };
  });
  const open = gaps.filter((g) => g.gap >= 5);
  if (open.length === 0) return { data, created: [], unallocatedKg: 0, offerWeeks: [] };
  const offerWeeks = open.map((g) => g.w);
  const gapKg = open.reduce((s, g) => s + g.gap, 0) / open.length;
  const volume = open.reduce((s, g) => s + g.needed, 0) / open.length;

  const poolIds =
    pool === "members" ? kd.memberFarmerIds : kd.neighborKopdesIds.flatMap((id) => derived.kopdesById.get(id)?.memberFarmerIds ?? []);
  const declined = new Set(
    data.commitments
      .filter((c) => c.status === "declined" && c.ingredientId === ingredientId && c.weeks.some((w) => offerWeeks.includes(w)))
      .map((c) => c.farmerId),
  );
  const candidates: MatchCandidate[] = poolIds
    .map((id) => derived.farmersById.get(id)!)
    .filter((f) => f && !declined.has(f.id))
    .map((f) => ({
      farmerId: f.id,
      reliability: f.reliabilityScore,
      capacityKg: f.commodities.find((c) => c.ingredientId === ingredientId)?.weeklyCapacityKg ?? 0,
      heldAnywhereKg: heldByFarmer(data.commitments, f.id, ingredientId, offerWeeks),
      heldHereKg: heldByFarmer(data.commitments, f.id, ingredientId, offerWeeks, kopdesId),
      sameVillage: f.village === kd.village,
      consentGiven: f.consentGiven,
    }));

  const result = allocate({ gapKg, weeklyVolumeKg: volume, fairnessCapPct: data.settings.fairnessCapPct, candidates });
  const band = commitmentBand(derived.priceIdx, ingredientId, data.today, derived.bandPct);
  let seq = data.seq;
  const created: Commitment[] = [];
  const messages: ChatMessage[] = [];
  const orderingName = shortKopdesName(kd.name);
  for (const a of result.allocations) {
    seq += 1;
    const f = derived.farmersById.get(a.farmerId)!;
    const c: Commitment = {
      id: `c-${seq}`,
      farmerId: a.farmerId,
      kopdesId,
      ingredientId,
      weeks: offerWeeks,
      kgPerWeek: a.kg,
      offeredKgPerWeek: a.kg,
      priceBand: band,
      status: "offered",
      createdAt: now,
      origin: pool === "members" ? "offer" : "neighbor",
    };
    created.push(c);
    const viaName = f.kopdesId !== kopdesId ? shortKopdesName(derived.kopdesById.get(f.kopdesId)?.name ?? "") : undefined;
    messages.push({ ...offerMessage({ ...data, seq }, f, c, orderingName, viaName), at: now });
  }
  if (created.length === 0) return { data, created, unallocatedKg: result.unallocatedKg, offerWeeks };
  const names = created.map((c) => `${derived.farmersById.get(c.farmerId)?.displayName} ${c.kgPerWeek} kg`).join(", ");
  const next: AppData = {
    ...data,
    seq,
    commitments: [...data.commitments, ...created],
    chat: [...data.chat, ...messages],
    auditLog: log(
      data,
      now,
      "kopdes",
      pool === "members" ? "offers_sent" : "neighbor_request",
      `${orderingName}: ${ing.nameEn} ${formatWeeks(offerWeeks, "en")} offered to ${names}.`,
    ),
  };
  return { data: next, created, unallocatedKg: result.unallocatedKg, offerWeeks };
}

/** Backup Ladder (a): ask members without consent to join, then send offers to members with spare capacity. */
export function inviteMoreFarmers(data: AppData, now: Now, kopdesId: string, ingredientId: string): OfferResult & { invited: string[] } {
  const derived = derive(data);
  const kd = derived.kopdesById.get(kopdesId);
  const ing = derived.ingredientsById.get(ingredientId);
  if (!kd || !ing) return { data, created: [], unallocatedKg: 0, offerWeeks: [], invited: [] };
  const toInvite = kd.memberFarmerIds
    .map((id) => derived.farmersById.get(id)!)
    .filter((f) => !f.consentGiven && f.commodities.some((c) => c.ingredientId === ingredientId))
    .filter((f) => !data.chat.some((m) => m.farmerId === f.id && m.kind === "info" && !m.answered && m.buttons));
  let next = data;
  for (const f of toInvite) {
    next = {
      ...next,
      seq: next.seq + 1,
      chat: [
        ...next.chat,
        {
          id: `chat-consent-${next.seq + 1}`,
          farmerId: f.id,
          from: "kopdes",
          kind: "info",
          textId: `Halo ${honorific(f)} ${f.displayName} 👋 ${shortKopdesName(kd.name)} mengajak Bapak/Ibu ikut memasok dapur MBG. Data yang kami simpan hanya nama depan, desa, dan nomor HP tersamar. Setuju menerima tawaran? Balas: 1 = Setuju, 2 = Tidak`,
          textEn: `Hello ${honorific(f)} ${f.displayName} 👋 ${shortKopdesName(kd.name)} invites you to supply MBG kitchens. We only store your first name, village and a masked phone number. Do you agree to receive offers? Reply: 1 = Agree, 2 = No`,
          buttons: [
            { label: "1 = Setuju", value: "consent_yes" },
            { label: "2 = Tidak", value: "consent_no" },
          ],
          at: now,
        },
      ],
    };
  }
  if (toInvite.length > 0) {
    next = { ...next, auditLog: log(next, now, "kopdes", "consent_requested", `${shortKopdesName(kd.name)} asked ${toInvite.map((f) => f.displayName).join(", ")} for consent (${ing.nameEn}).`) };
  }
  const offers = sendOffers(next, now, kopdesId, ingredientId);
  return { ...offers, invited: toInvite.map((f) => f.id) };
}

/** Backup Ladder (c): ask the linked kitchens for a Harvest-Aware Menu Switch. */
export function requestMenuSwitch(data: AppData, now: Now, kopdesId: string, ingredientId: string, weeks: number[]): AppData {
  const existing = data.switchRequests.find((r) => r.kopdesId === kopdesId && r.ingredientId === ingredientId);
  const merged = existing ? [...new Set([...existing.weeks, ...weeks])].sort((a, b) => a - b) : weeks;
  const others = data.switchRequests.filter((r) => r !== existing);
  const ing = data.ingredients.find((i) => i.id === ingredientId);
  const kd = data.kopdes.find((k) => k.id === kopdesId);
  return {
    ...data,
    seq: nextSeq(data),
    switchRequests: [...others, { id: existing?.id ?? `sr-${data.seq + 1}`, kopdesId, ingredientId, weeks: merged, createdAt: now }],
    auditLog: log(data, now, "kopdes", "menu_switch_requested", `${shortKopdesName(kd?.name ?? "")} asked kitchens for a Menu Switch: ${ing?.nameEn} ${formatWeeks(weeks, "en")}.`),
  };
}

// ----- Farmer WhatsApp replies ----------------------------------------------------------

function farmerReply(data: AppData, farmerId: string, textId: string, textEn: string, now: Now): ChatMessage {
  return { id: `chat-r-${data.seq}-${data.chat.length}`, farmerId, from: "farmer", kind: "reply", textId, textEn, at: now };
}

function markAnswered(chat: ChatMessage[], messageId: string): ChatMessage[] {
  return chat.map((m) => (m.id === messageId ? { ...m, answered: true } : m));
}

/**
 * A farmer taps a quick-reply button. Offers: 1 = all, 2 = part (then 10/20/30 kg),
 * 3 = decline. Consent requests: yes/no. Each reply updates the shared store, so
 * the Commitment Board changes immediately.
 */
export function chatReply(data: AppData, now: Now, messageId: string, value: string): AppData {
  const msg = data.chat.find((m) => m.id === messageId);
  if (!msg || msg.answered) return data;
  const farmer = data.farmers.find((f) => f.id === msg.farmerId);
  if (!farmer) return data;
  const name = `${honorific(farmer)} ${farmer.displayName}`;
  let next: AppData = { ...data, seq: data.seq + 1, chat: markAnswered(data.chat, messageId) };

  if (msg.kind === "info" && (value === "consent_yes" || value === "consent_no")) {
    const yes = value === "consent_yes";
    next = {
      ...next,
      farmers: next.farmers.map((f) => (f.id === farmer.id ? { ...f, consentGiven: yes } : f)),
      chat: [
        ...next.chat,
        farmerReply(next, farmer.id, yes ? "1" : "2", yes ? "1 (agree)" : "2 (no)", now),
        {
          id: `chat-k-${next.seq}`,
          farmerId: farmer.id,
          from: "kopdes",
          kind: "confirm",
          textId: yes ? `Terima kasih ${name} 🙏 Persetujuan tercatat. Tawaran berikutnya akan dikirim lewat chat ini.` : `Baik ${name}, terima kasih. Kami tidak akan mengirim tawaran.`,
          textEn: yes ? `Thank you ${name}. Consent recorded. The next offers will arrive in this chat.` : `Noted, ${name}. We will not send offers.`,
          at: now,
        },
      ],
      auditLog: log(next, now, "farmer", yes ? "consent_given" : "consent_declined", `${farmer.displayName} ${yes ? "gave" : "declined"} consent to receive offers.`),
    };
    return next;
  }

  const commitment = data.commitments.find((c) => c.id === msg.commitmentId);
  if (!commitment) return next;
  const ing = data.ingredients.find((i) => i.id === commitment.ingredientId)!;
  const kd = data.kopdes.find((k) => k.id === commitment.kopdesId)!;
  const accept = (kg: number, replyId: string, replyEn: string): AppData => {
    const status: Commitment["status"] = "accepted";
    const updated = { ...commitment, kgPerWeek: kg, status, respondedAt: now };
    const band = rupiahRange(commitment.priceBand.floor, commitment.priceBand.ceiling, "id");
    const bandEn = rupiahRange(commitment.priceBand.floor, commitment.priceBand.ceiling, "en");
    return {
      ...next,
      commitments: next.commitments.map((c) => (c.id === commitment.id ? updated : c)),
      chat: [
        ...next.chat,
        farmerReply(next, farmer.id, replyId, replyEn, now),
        {
          id: `chat-k-${next.seq}`,
          farmerId: farmer.id,
          from: "kopdes",
          kind: "confirm",
          commitmentId: commitment.id,
          textId: `Terima kasih ${name} 🙏 Tercatat: ${ing.nameId.toLowerCase()} ${kg} kg/minggu, ${formatWeeks(commitment.weeks, "id")}, harga ${band}. Kami kirim pengingat H-1 sebelum pengiriman.`,
          textEn: `Thank you ${name}. Recorded: ${ing.nameEn.toLowerCase()} ${kg} kg/week, ${formatWeeks(commitment.weeks, "en")}, price ${bandEn}. We will send a reminder one day before delivery.`,
          at: now,
        },
      ],
      auditLog: log(next, now, "farmer", "offer_accepted", `${farmer.displayName} accepted ${kg} kg/week of ${ing.nameEn} for ${shortKopdesName(kd.name)} (${formatWeeks(commitment.weeks, "en")}).`),
    };
  };

  if (msg.kind === "offer") {
    if (value === "1") return accept(commitment.offeredKgPerWeek, "1", "1 (all)");
    if (value === "3") {
      return {
        ...next,
        commitments: next.commitments.map((c) => (c.id === commitment.id ? { ...c, status: "declined", respondedAt: now } : c)),
        chat: [
          ...next.chat,
          farmerReply(next, farmer.id, "3", "3 (cannot)", now),
          {
            id: `chat-k-${next.seq}`,
            farmerId: farmer.id,
            from: "kopdes",
            kind: "decline_ack",
            textId: `Baik ${name}, terima kasih atas jawabannya. Kami tawarkan ke petani lain.`,
            textEn: `Noted, ${name}, thank you for replying. We will offer it to other farmers.`,
            at: now,
          },
        ],
        auditLog: log(next, now, "farmer", "offer_declined", `${farmer.displayName} declined ${ing.nameEn} for ${shortKopdesName(kd.name)}.`),
      };
    }
    if (value === "2") {
      const options = [10, 20, 30].filter((v) => v < commitment.offeredKgPerWeek);
      const quick = options.length > 0 ? options : [Math.max(5, Math.floor(commitment.offeredKgPerWeek / 2))];
      return {
        ...next,
        chat: [
          ...next.chat,
          farmerReply(next, farmer.id, "2", "2 (part)", now),
          {
            id: `chat-k-${next.seq}`,
            farmerId: farmer.id,
            from: "kopdes",
            kind: "ask_partial",
            commitmentId: commitment.id,
            textId: `Baik ${name}. Berapa kg per minggu yang sanggup? (tawaran: ${commitment.offeredKgPerWeek} kg)`,
            textEn: `Thank you ${name}. How many kg per week can you supply? (offer: ${commitment.offeredKgPerWeek} kg)`,
            buttons: quick.map((v) => ({ label: `${v} kg`, value: String(v) })),
            at: now,
          },
        ],
      };
    }
  }
  if (msg.kind === "ask_partial") {
    const kg = Math.max(1, Math.min(commitment.offeredKgPerWeek, Number(value) || 0));
    return accept(kg, `${kg} kg`, `${kg} kg`);
  }
  return next;
}

// ----- Menu Switch ----------------------------------------------------------------

export function approveSuggestion(data: AppData, now: Now, suggestion: SubstitutionSuggestion, optionIndex = -1): AppData {
  const option = optionIndex < 0 ? suggestion : suggestion.alternatives[optionIndex];
  if (!option) return data;
  const key = suggestionKey(suggestion.kitchenId, suggestion.week, suggestion.dayIndex, suggestion.fromDishId, suggestion.reason);
  if (data.decisions.some((d) => d.key === key)) return data;
  const kitchen = data.kitchens.find((k) => k.id === suggestion.kitchenId);
  const fromIng = data.ingredients.find((i) => i.id === suggestion.fromIngredientId);
  const toIng = data.ingredients.find((i) => i.id === option.toIngredientId);
  let next: AppData = {
    ...data,
    seq: nextSeq(data),
    overrides: [...data.overrides, toOverride(suggestion, option, now)],
    decisions: [...data.decisions, { key, status: "approved", suggestionId: suggestion.id, decidedAt: now }],
  };
  next = {
    ...next,
    auditLog: log(
      next,
      now,
      "kitchen",
      optionIndex < 0 ? "menu_switch_approved" : "menu_switch_approved_alternative",
      `${kitchen?.name}: ${fromIng?.nameEn} → ${toIng?.nameEn} on ${suggestion.date} (week ${suggestion.week}), ` +
        `${option.gramsNew.large} g large portion${option.stapleTopUpG.large ? `, staple ${option.stapleTopUpG.large > 0 ? "+" : ""}${option.stapleTopUpG.large} g` : ""}. ` +
        `Protein ${Math.round(option.nutritionCheck.proteinPct * 100)}%, energy ${Math.round(option.nutritionCheck.energyPct * 100)}%, ` +
        `cost Rp ${Math.round(option.costPerPortionBefore.large)} → Rp ${Math.round(option.costPerPortionAfter.large)}.`,
    ),
  };
  // The new ingredient needs local supply: send offers to farmers with spare capacity.
  for (const kdId of kitchen?.linkedKopdesIds ?? []) {
    const d = derive(next);
    if (!d.kopdesCommodities.get(kdId)?.includes(option.toIngredientId)) continue;
    next = sendOffers(next, now, kdId, option.toIngredientId, [suggestion.week], "members", d).data;
  }
  return next;
}

export function rejectSuggestion(data: AppData, now: Now, suggestion: SubstitutionSuggestion): AppData {
  const key = suggestionKey(suggestion.kitchenId, suggestion.week, suggestion.dayIndex, suggestion.fromDishId, suggestion.reason);
  if (data.decisions.some((d) => d.key === key)) return data;
  const kitchen = data.kitchens.find((k) => k.id === suggestion.kitchenId);
  const fromIng = data.ingredients.find((i) => i.id === suggestion.fromIngredientId);
  const toIng = data.ingredients.find((i) => i.id === suggestion.toIngredientId);
  const next: AppData = {
    ...data,
    seq: nextSeq(data),
    decisions: [...data.decisions, { key, status: "rejected", suggestionId: suggestion.id, decidedAt: now }],
  };
  return {
    ...next,
    auditLog: log(next, now, "kitchen", "menu_switch_rejected", `${kitchen?.name}: kept ${fromIng?.nameEn} on ${suggestion.date} (suggested ${toIng?.nameEn}).`),
  };
}

// ----- Kitchen menu & calendar ---------------------------------------------------------

export function toggleDishLock(data: AppData, now: Now, kitchenId: string, dishId: string): AppData {
  const cycle = data.menuCycles.find((c) => c.kitchenId === kitchenId);
  if (!cycle) return data;
  const locked = cycle.lockedDishIds.includes(dishId);
  const dish = data.dishes.find((d) => d.id === dishId);
  const next: AppData = {
    ...data,
    seq: nextSeq(data),
    menuCycles: data.menuCycles.map((c) =>
      c.kitchenId === kitchenId
        ? { ...c, lockedDishIds: locked ? c.lockedDishIds.filter((x) => x !== dishId) : [...c.lockedDishIds, dishId] }
        : c,
    ),
  };
  return { ...next, auditLog: log(next, now, "kitchen", locked ? "dish_unlocked" : "dish_locked", `${dishId} ${locked ? "unlocked" : "locked as anchor"} (${dish?.nameEn}).`) };
}

export function updateKitchen(
  data: AppData,
  now: Now,
  kitchenId: string,
  patch: Partial<Pick<Kitchen, "beneficiaries" | "attendanceRate">>,
): AppData {
  const k = data.kitchens.find((x) => x.id === kitchenId);
  if (!k) return data;
  const next: AppData = { ...data, seq: nextSeq(data), kitchens: data.kitchens.map((x) => (x.id === kitchenId ? { ...x, ...patch } : x)) };
  const parts = [
    patch.beneficiaries ? `beneficiaries ${patch.beneficiaries.small}/${patch.beneficiaries.large}` : "",
    patch.attendanceRate !== undefined ? `attendance ${Math.round(patch.attendanceRate * 100)}%` : "",
  ].filter(Boolean);
  return { ...next, auditLog: log(next, now, "kitchen", "kitchen_updated", `${k.name}: ${parts.join(", ")}.`) };
}

export function toggleHoliday(data: AppData, now: Now, kitchenId: string, date: string): AppData {
  const k = data.kitchens.find((x) => x.id === kitchenId);
  if (!k) return data;
  const exists = k.schoolCalendar.holidays.some((h) => h.date === date);
  const holidays = exists
    ? k.schoolCalendar.holidays.filter((h) => h.date !== date)
    : [...k.schoolCalendar.holidays, { date, nameEn: "School closed", nameId: "Sekolah libur" }];
  const next: AppData = {
    ...data,
    seq: nextSeq(data),
    kitchens: data.kitchens.map((x) => (x.id === kitchenId ? { ...x, schoolCalendar: { ...x.schoolCalendar, holidays } } : x)),
  };
  return { ...next, auditLog: log(next, now, "kitchen", exists ? "calendar_day_opened" : "calendar_day_closed", `${k.name}: ${date} ${exists ? "is a school day again" : "marked as no school"}.`) };
}

// ----- Deliveries, QR and payments -------------------------------------------------------

export interface NewBatchInput {
  kopdesId: string;
  kitchenId: string;
  ingredientId: string;
  farmerIds: string[];
  kg: number;
  grade: "A" | "B";
  coldChainChecked: boolean;
  harvestDate: string;
  plannedDeliveryDate: string;
  /** Optional code chosen by the caller (live workspaces use a random one). */
  code?: string;
}

export function createBatch(data: AppData, now: Now, input: NewBatchInput): { data: AppData; batch: Batch } {
  let seq = data.seq + 1;
  let code = input.code && /^PT-[A-Z0-9]{4,8}$/.test(input.code) && !data.batches.some((b) => b.id === input.code) ? input.code : batchCodeFromSeq(seq);
  while (data.batches.some((b) => b.id === code)) {
    seq += 1;
    code = batchCodeFromSeq(seq);
  }
  const batch: Batch = {
    id: code,
    farmerIds: input.farmerIds,
    kopdesId: input.kopdesId,
    kitchenId: input.kitchenId,
    ingredientId: input.ingredientId,
    kg: input.kg,
    harvestDate: input.harvestDate,
    grade: input.grade,
    coldChainChecked: input.coldChainChecked,
    createdAt: now,
    plannedDeliveryDate: input.plannedDeliveryDate,
    photoPlaceholder: `photo-${input.ingredientId}`,
    week: weekOfDate(data.today, input.plannedDeliveryDate),
  };
  const ing = data.ingredients.find((i) => i.id === input.ingredientId)!;
  const kd = data.kopdes.find((k) => k.id === input.kopdesId)!;
  const kitchen = data.kitchens.find((k) => k.id === input.kitchenId)!;
  // D-1 reminder for deliveries planned tomorrow (or later).
  const reminders: ChatMessage[] =
    input.plannedDeliveryDate > data.today
      ? input.farmerIds.map((fid, i) => {
          const f = data.farmers.find((x) => x.id === fid)!;
          return {
            id: `chat-rem-${seq}-${i}`,
            farmerId: fid,
            from: "kopdes",
            kind: "reminder",
            textId: `⏰ Pengingat H-1 untuk ${honorific(f)} ${f.displayName}: ${formatDate(input.plannedDeliveryDate, "id", { weekday: true })}, antar ${ing.nameId.toLowerCase()} ke ${shortKopdesName(kd.name)} sebelum pukul 06.00 untuk ${kitchen.name}. Batch ${code}.`,
            textEn: `⏰ D-1 reminder for ${honorific(f)} ${f.displayName}: on ${formatDate(input.plannedDeliveryDate, "en", { weekday: true })}, bring your ${ing.nameEn.toLowerCase()} to ${shortKopdesName(kd.name)} before 06:00 for ${kitchen.name}. Batch ${code}.`,
            at: now,
          } satisfies ChatMessage;
        })
      : [];
  const next: AppData = {
    ...data,
    seq,
    batches: [...data.batches, batch],
    chat: [...data.chat, ...reminders],
    auditLog: log(data, now, "kopdes", "batch_created", `${code}: ${input.kg} kg ${ing.nameEn}, grade ${input.grade}, for ${kitchen.name} on ${input.plannedDeliveryDate}.`),
  };
  return { data: next, batch };
}

export function receiveBatch(
  data: AppData,
  now: Now,
  code: string,
  checks: { receivedChecked: boolean; coldChainChecked: boolean; receivedBy: string },
): { data: AppData; ok: boolean; error?: "not_found" | "already_received" | "checks_missing" } {
  const batch = data.batches.find((b) => b.id.toUpperCase() === code.trim().toUpperCase());
  if (!batch) return { data, ok: false, error: "not_found" };
  if (batch.deliveredAt) return { data, ok: false, error: "already_received" };
  const ing = data.ingredients.find((i) => i.id === batch.ingredientId)!;
  const needsCold = ing.foodGroup === "animal_protein";
  if (!checks.receivedChecked || (needsCold && !checks.coldChainChecked)) return { data, ok: false, error: "checks_missing" };
  const derived = derive(data);
  const week = Math.max(0, batch.week);
  const committed = data.commitments.find(
    (c) => c.kopdesId === batch.kopdesId && c.ingredientId === batch.ingredientId && batch.farmerIds.includes(c.farmerId) && c.weeks.includes(week),
  );
  const unit = committed ? Math.min(Math.max(derived.price(batch.ingredientId, week), committed.priceBand.floor), committed.priceBand.ceiling) : derived.price(batch.ingredientId, week);
  const next: AppData = {
    ...data,
    seq: nextSeq(data),
    batches: data.batches.map((b) =>
      b.id === batch.id ? { ...b, deliveredAt: now, receivedBy: checks.receivedBy, receivedChecked: true, coldChainChecked: b.coldChainChecked || checks.coldChainChecked } : b,
    ),
    payments: [
      ...data.payments,
      { batchId: batch.id, deliveredAt: now, verifiedAt: now, amountRp: Math.round((batch.kg * unit) / 100) * 100 },
    ],
  };
  return {
    data: {
      ...next,
      auditLog: log(next, now, "kitchen", "delivery_received", `${batch.id}: ${batch.kg} kg ${ing.nameEn} received and checked${needsCold ? " (cold chain OK)" : ""}. Payment Clock started.`),
    },
    ok: true,
  };
}

export function markKitchenPaid(data: AppData, now: Now, batchId: string): AppData {
  const p = data.payments.find((x) => x.batchId === batchId);
  if (!p || p.kitchenPaidAt || !p.verifiedAt) return data;
  const next: AppData = { ...data, seq: nextSeq(data), payments: data.payments.map((x) => (x.batchId === batchId ? { ...x, kitchenPaidAt: now } : x)) };
  return { ...next, auditLog: log(next, now, "kitchen", "kitchen_paid", `${batchId}: kitchen paid Kopdes Rp ${p.amountRp}.`) };
}

export function markFarmersPaid(data: AppData, now: Now, batchId: string): AppData {
  const p = data.payments.find((x) => x.batchId === batchId);
  const batch = data.batches.find((b) => b.id === batchId);
  if (!p || !batch || p.farmerPaidAt || !p.kitchenPaidAt) return data;
  const ing = data.ingredients.find((i) => i.id === batch.ingredientId)!;
  const n = Math.max(1, batch.farmerIds.length);
  const each = Math.round(p.amountRp / n / 100) * 100;
  const kgEach = Math.round((batch.kg / n) * 10) / 10;
  const messages: ChatMessage[] = batch.farmerIds.map((fid, i) => ({
    id: `chat-pay-${data.seq + 1}-${i}`,
    farmerId: fid,
    from: "kopdes",
    kind: "payment",
    textId: `💸 Pembayaran ${formatRp(each, "id")} untuk ${ing.nameId.toLowerCase()} ${formatNumber(kgEach, "id", kgEach % 1 ? 1 : 0)} kg (batch ${batchId}) sudah ditransfer. Terima kasih!`,
    textEn: `💸 Payment of ${formatRp(each, "en")} for ${formatNumber(kgEach, "en", kgEach % 1 ? 1 : 0)} kg of ${ing.nameEn.toLowerCase()} (batch ${batchId}) has been transferred. Thank you!`,
    at: now,
  }));
  const next: AppData = {
    ...data,
    seq: nextSeq(data),
    payments: data.payments.map((x) => (x.batchId === batchId ? { ...x, farmerPaidAt: now } : x)),
    chat: [...data.chat, ...messages],
  };
  return { ...next, auditLog: log(next, now, "kopdes", "farmers_paid", `${batchId}: Kopdes paid ${n} farmer(s) Rp ${p.amountRp}.`) };
}

export function addPlateFeedback(data: AppData, kitchenId: string, date: string, dishId: string, leftover: Leftover): AppData {
  const rest = data.plateFeedback.filter((p) => !(p.kitchenId === kitchenId && p.date === date && p.dishId === dishId));
  return { ...data, plateFeedback: [...rest, { kitchenId, date, dishId, leftover }] };
}

export function updateSettings(data: AppData, now: Now, patch: Partial<Settings>): AppData {
  const settings: Settings = {
    ...data.settings,
    ...patch,
    substitution: { ...data.settings.substitution, ...(patch.substitution ?? {}) },
    marketSupplyKgPerWeek: { ...data.settings.marketSupplyKgPerWeek, ...(patch.marketSupplyKgPerWeek ?? {}) },
  };
  const kitchens =
    patch.attendanceRate !== undefined ? data.kitchens.map((k) => ({ ...k, attendanceRate: patch.attendanceRate! })) : data.kitchens;
  const kitchensSla =
    patch.paymentSlaDays !== undefined ? kitchens.map((k) => ({ ...k, paymentSlaDays: patch.paymentSlaDays! })) : kitchens;
  const next: AppData = { ...data, seq: nextSeq(data), settings, kitchens: kitchensSla };
  const changes = describeSettingsChange(data.settings, settings);
  return { ...next, auditLog: log(next, now, "system", "settings_changed", `Settings changed: ${changes.length ? changes.join("; ") : "no change"}.`) };
}

// Readable audit wording for settings changes ("price band floor 95% → 92%").
const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
const SETTING_LABELS: Record<string, [string, (v: number) => string]> = {
  priceBandFloorPct: ["price band floor", pct],
  priceBandCeilingPct: ["price band ceiling", pct],
  shieldPriceRisePct: ["Price Shield price rise", pct],
  shieldDemandSharePct: ["Price Shield demand share", pct],
  fairnessCapPct: ["fairness cap", pct],
  safetyBuffer: ["safety buffer", pct],
  attendanceRate: ["attendance rate", pct],
  paymentSlaDays: ["payment SLA", (v) => `${v} days`],
  commitmentLeadWeeks: ["commitment lead time", (v) => `${v} weeks`],
  minProteinPct: ["Menu Switch minimum protein", pct],
  energyTolerancePct: ["Menu Switch energy tolerance", pct],
  leadTimeDays: ["Menu Switch lead time", (v) => `${v} days`],
  maxMainProteinPerWeek: ["same main protein per week", (v) => `${v}x`],
  surplusThreshold: ["surplus trigger", pct],
  maxStapleTopUpG: ["maximum staple adjustment", (v) => `${v} g`],
};

function describeSettingsChange(before: Settings, after: Settings): string[] {
  const out: string[] = [];
  const diff = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    for (const [key, [label, fmt]] of Object.entries(SETTING_LABELS)) {
      if (!(key in b) || typeof b[key] !== "number" || a[key] === b[key]) continue;
      out.push(`${label} ${fmt(a[key] as number)} → ${fmt(b[key] as number)}`);
    }
  };
  diff(before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
  diff(before.substitution as unknown as Record<string, unknown>, after.substitution as unknown as Record<string, unknown>);
  for (const [id, kg] of Object.entries(after.marketSupplyKgPerWeek)) {
    if (before.marketSupplyKgPerWeek[id] !== kg) out.push(`market supply estimate ${id} ${before.marketSupplyKgPerWeek[id] ?? 0} → ${kg} kg/week`);
  }
  return out;
}

import type { AppData, Leftover, Settings } from "@/types";
import { derive } from "@/engines/derive";
import * as cmd from "./commands";
import * as manage from "./manage";

// Every data change, by name, with JSON arguments. The live repository sends
// { name, args } to the server, which runs the same function on the stored data,
// so the browser can apply a change instantly and the server stays the authority.

export type Actor = "admin" | "kitchen" | "kopdes" | "farmer" | "viewer";

/** Which kitchen, Kopdes or farmer a command touches, used for permission checks. */
export interface Scope {
  kitchenId?: string;
  kopdesId?: string;
  farmerId?: string;
}

export interface CommandSpec {
  /** Roles (besides admin) that may run it, within their own scope. */
  roles: Actor[];
  scope: (data: AppData, args: unknown[]) => Scope;
  run: (data: AppData, now: string, args: unknown[]) => { data: AppData; result?: unknown };
}

const s = (v: unknown) => (typeof v === "string" ? v : "");
const weeksArg = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is number => typeof x === "number" && Number.isInteger(x) && x >= 1 && x <= 8) : undefined);

function findSuggestion(data: AppData, id: string) {
  for (const list of derive(data).suggestions.values()) {
    const found = list.find((x) => x.id === id);
    if (found) return found;
  }
  return undefined;
}

function batchScope(data: AppData, code: string): Scope {
  const b = data.batches.find((x) => x.id.toUpperCase() === code.trim().toUpperCase());
  return b ? { kitchenId: b.kitchenId, kopdesId: b.kopdesId } : {};
}

const offerResult = (r: cmd.OfferResult) => ({ data: r.data, result: { created: r.created, unallocatedKg: r.unallocatedKg, offerWeeks: r.offerWeeks } });

export const COMMANDS: Record<string, CommandSpec> = {
  sendOffers: {
    roles: ["kopdes"],
    scope: (_d, [kopdesId]) => ({ kopdesId: s(kopdesId) }),
    run: (d, now, [kopdesId, ingredientId, weeks]) => offerResult(cmd.sendOffers(d, now, s(kopdesId), s(ingredientId), weeksArg(weeks))),
  },
  inviteMoreFarmers: {
    roles: ["kopdes"],
    scope: (_d, [kopdesId]) => ({ kopdesId: s(kopdesId) }),
    run: (d, now, [kopdesId, ingredientId]) => {
      const r = cmd.inviteMoreFarmers(d, now, s(kopdesId), s(ingredientId));
      return { data: r.data, result: { created: r.created, unallocatedKg: r.unallocatedKg, offerWeeks: r.offerWeeks, invited: r.invited } };
    },
  },
  requestNeighbor: {
    roles: ["kopdes"],
    scope: (_d, [kopdesId]) => ({ kopdesId: s(kopdesId) }),
    run: (d, now, [kopdesId, ingredientId, weeks]) => offerResult(cmd.sendOffers(d, now, s(kopdesId), s(ingredientId), weeksArg(weeks), "neighbors")),
  },
  requestMenuSwitch: {
    roles: ["kopdes"],
    scope: (_d, [kopdesId]) => ({ kopdesId: s(kopdesId) }),
    run: (d, now, [kopdesId, ingredientId, weeks]) => ({ data: cmd.requestMenuSwitch(d, now, s(kopdesId), s(ingredientId), weeksArg(weeks) ?? []) }),
  },
  chatReply: {
    roles: ["farmer"],
    scope: (d, [messageId]) => ({ farmerId: d.chat.find((m) => m.id === s(messageId))?.farmerId ?? "?" }),
    run: (d, now, [messageId, value]) => ({ data: cmd.chatReply(d, now, s(messageId), s(value)) }),
  },
  approveSuggestion: {
    roles: ["kitchen"],
    scope: (d, [id]) => ({ kitchenId: findSuggestion(d, s(id))?.kitchenId ?? "?" }),
    run: (d, now, [id, optionIndex]) => {
      const sug = findSuggestion(d, s(id));
      return { data: sug ? cmd.approveSuggestion(d, now, sug, typeof optionIndex === "number" ? optionIndex : -1) : d };
    },
  },
  rejectSuggestion: {
    roles: ["kitchen"],
    scope: (d, [id]) => ({ kitchenId: findSuggestion(d, s(id))?.kitchenId ?? "?" }),
    run: (d, now, [id]) => {
      const sug = findSuggestion(d, s(id));
      return { data: sug ? cmd.rejectSuggestion(d, now, sug) : d };
    },
  },
  toggleDishLock: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, now, [kitchenId, dishId]) => ({ data: cmd.toggleDishLock(d, now, s(kitchenId), s(dishId)) }),
  },
  updateKitchen: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, now, [kitchenId, patch]) => {
      const p = (patch ?? {}) as { beneficiaries?: { small: number; large: number }; attendanceRate?: number };
      const clean: Parameters<typeof cmd.updateKitchen>[3] = {};
      if (p.beneficiaries && Number.isFinite(p.beneficiaries.small) && Number.isFinite(p.beneficiaries.large))
        clean.beneficiaries = { small: Math.max(0, Math.round(p.beneficiaries.small)), large: Math.max(0, Math.round(p.beneficiaries.large)) };
      if (typeof p.attendanceRate === "number" && p.attendanceRate > 0 && p.attendanceRate <= 1) clean.attendanceRate = p.attendanceRate;
      return { data: cmd.updateKitchen(d, now, s(kitchenId), clean) };
    },
  },
  toggleHoliday: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, now, [kitchenId, date]) => ({ data: /^\d{4}-\d{2}-\d{2}$/.test(s(date)) ? cmd.toggleHoliday(d, now, s(kitchenId), s(date)) : d }),
  },
  createBatch: {
    roles: ["kopdes"],
    scope: (_d, [input]) => ({ kopdesId: s((input as cmd.NewBatchInput)?.kopdesId) }),
    run: (d, now, [input]) => {
      const i = input as cmd.NewBatchInput;
      if (!i || !d.kitchens.some((k) => k.id === i.kitchenId) || !(i.kg > 0)) return { data: d };
      const r = cmd.createBatch(d, now, { ...i, farmerIds: (i.farmerIds ?? []).filter((id) => d.farmers.some((f) => f.id === id)) });
      return { data: r.data, result: r.batch };
    },
  },
  receiveBatch: {
    roles: ["kitchen"],
    scope: (d, [code]) => batchScope(d, s(code)),
    run: (d, now, [code, checks]) => {
      const r = cmd.receiveBatch(d, now, s(code), checks as Parameters<typeof cmd.receiveBatch>[3]);
      return { data: r.ok ? r.data : d, result: { ok: r.ok, error: r.error } };
    },
  },
  markKitchenPaid: {
    roles: ["kitchen"],
    scope: (d, [batchId]) => ({ kitchenId: batchScope(d, s(batchId)).kitchenId ?? "?" }),
    run: (d, now, [batchId]) => ({ data: cmd.markKitchenPaid(d, now, s(batchId)) }),
  },
  markFarmersPaid: {
    roles: ["kopdes"],
    scope: (d, [batchId]) => ({ kopdesId: batchScope(d, s(batchId)).kopdesId ?? "?" }),
    run: (d, now, [batchId]) => ({ data: cmd.markFarmersPaid(d, now, s(batchId)) }),
  },
  addPlateFeedback: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, _now, [kitchenId, date, dishId, leftover]) => {
      const l = s(leftover) as Leftover;
      if (!["none", "quarter", "half", "most"].includes(l)) return { data: d };
      return { data: cmd.addPlateFeedback(d, s(kitchenId), s(date), s(dishId), l) };
    },
  },
  updateSettings: {
    roles: [],
    scope: () => ({}),
    run: (d, now, [patch]) => ({ data: cmd.updateSettings(d, now, (patch ?? {}) as Partial<Settings>) }),
  },

  // ----- Data entry --------------------------------------------------------------
  saveKitchen: {
    roles: ["kitchen"],
    scope: (_d, [input]) => ({ kitchenId: s((input as manage.KitchenInput)?.id) || "?" }),
    run: (d, now, [input]) => ({ data: manage.saveKitchen(d, now, input as manage.KitchenInput) }),
  },
  deleteKitchen: { roles: [], scope: () => ({}), run: (d, now, [id]) => ({ data: manage.deleteKitchen(d, now, s(id)) }) },
  setSchoolCalendar: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, now, [kitchenId, days, holidays]) => ({
      data: manage.setSchoolCalendar(d, now, s(kitchenId), Array.isArray(days) ? (days as number[]) : [], Array.isArray(holidays) ? (holidays as never[]) : []),
    }),
  },
  saveKopdes: {
    roles: ["kopdes"],
    scope: (_d, [input]) => ({ kopdesId: s((input as manage.KopdesInput)?.id) || "?" }),
    run: (d, now, [input]) => ({ data: manage.saveKopdes(d, now, input as manage.KopdesInput) }),
  },
  deleteKopdes: { roles: [], scope: () => ({}), run: (d, now, [id]) => ({ data: manage.deleteKopdes(d, now, s(id)) }) },
  saveFarmer: {
    roles: ["kopdes"],
    // A Kopdes manager may add or edit farmers of their own Kopdes only (and not move them away).
    scope: (d, [input]) => {
      const i = input as manage.FarmerInput;
      const current = i?.id ? d.farmers.find((f) => f.id === i.id) : undefined;
      if (current && current.kopdesId !== i.kopdesId) return { kopdesId: "?" };
      return { kopdesId: s(i?.kopdesId) };
    },
    run: (d, now, [input]) => ({ data: manage.saveFarmer(d, now, input as manage.FarmerInput) }),
  },
  deleteFarmer: {
    roles: ["kopdes"],
    scope: (d, [id]) => ({ kopdesId: d.farmers.find((f) => f.id === s(id))?.kopdesId ?? "?" }),
    run: (d, now, [id]) => ({ data: manage.deleteFarmer(d, now, s(id)) }),
  },
  saveIngredient: { roles: [], scope: () => ({}), run: (d, now, [input]) => ({ data: manage.saveIngredient(d, now, input as manage.IngredientInput) }) },
  setPrices: {
    roles: ["kopdes"],
    scope: () => ({}),
    run: (d, now, [entries, source]) => ({ data: manage.setPrices(d, now, Array.isArray(entries) ? (entries as manage.PriceEntry[]) : [], s(source) === "PLACEHOLDER" ? "PLACEHOLDER" : "PIHPS") }),
  },
  saveDish: { roles: ["kitchen"], scope: () => ({}), run: (d, now, [input]) => ({ data: manage.saveDish(d, now, input as manage.DishInput) }) },
  setMenuDay: {
    roles: ["kitchen"],
    scope: (_d, [kitchenId]) => ({ kitchenId: s(kitchenId) }),
    run: (d, now, [kitchenId, dayIndex, dishIds]) => ({
      data: manage.setMenuDay(d, now, s(kitchenId), typeof dayIndex === "number" ? dayIndex : 0, Array.isArray(dishIds) ? dishIds.map(String) : []),
    }),
  },
};

/** Whether an actor with an entity (their kitchen, Kopdes or farmer id) may run a command. */
export function allowed(actor: Actor, entityId: string | null, name: string, data: AppData, args: unknown[]): boolean {
  const spec = COMMANDS[name];
  if (!spec) return false;
  if (actor === "admin") return true;
  if (!spec.roles.includes(actor) || !entityId) return false;
  // Shared libraries (prices, dishes) carry no scope: any Kopdes or kitchen user may edit them.
  const scope = spec.scope(data, args);
  if (actor === "kitchen") return scope.kitchenId === undefined ? scope.kopdesId === undefined && scope.farmerId === undefined : scope.kitchenId === entityId;
  if (actor === "kopdes") return scope.kopdesId === undefined ? scope.kitchenId === undefined && scope.farmerId === undefined : scope.kopdesId === entityId;
  if (actor === "farmer") return scope.farmerId === entityId;
  return false;
}

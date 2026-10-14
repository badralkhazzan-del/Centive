import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppData } from "@/types";
import { buildSeedState, SEED_VERSION } from "@/data/seed";
import * as cmd from "./commands";
import { COMMANDS } from "./registry";
import type { Repository } from "./types";

// Local repository: Zustand store persisted to localStorage. Works fully offline.

export const STORAGE_KEY = "piringtani-demo";

interface StoreState {
  data: AppData;
}

/** Demo clock: the fixed demo date with the real time of day (keeps logs readable). */
export function demoNow(today: string): string {
  const t = new Date().toISOString().slice(11, 23);
  return `${today}T${t}Z`;
}

function safeStorage() {
  return createJSONStorage<{ data: AppData }>(() => {
    try {
      const s = window.localStorage;
      const probe = "__pt_probe__";
      s.setItem(probe, "1");
      s.removeItem(probe);
      return s;
    } catch {
      // Private mode or blocked storage: keep state in memory only.
      const mem = new Map<string, string>();
      return {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, v),
        removeItem: (k: string) => void mem.delete(k),
      };
    }
  });
}

export function createLocalRepository(): Repository {
  let hydrated = false;
  const store = createStore<StoreState>()(
    persist(() => ({ data: buildSeedState() }), {
      name: STORAGE_KEY,
      version: SEED_VERSION,
      storage: safeStorage(),
      skipHydration: true,
      partialize: (s) => ({ data: s.data }),
      migrate: () => ({ data: buildSeedState() }),
      merge: (persisted, current) => {
        const p = persisted as Partial<StoreState> | undefined;
        if (!p?.data || p.data.version !== SEED_VERSION) return current;
        return { ...current, data: p.data };
      },
      onRehydrateStorage: () => () => {
        hydrated = true;
      },
    }),
  );

  const get = () => store.getState().data;
  // Never write before the saved state is loaded, or the seed would overwrite it.
  const set = (data: AppData) => {
    if (!hydrated && typeof window !== "undefined") repo.hydrate();
    store.setState({ data });
  };
  const now = () => demoNow(get().today);
  const fresh = () => {
    if (!hydrated && typeof window !== "undefined") repo.hydrate();
    return get();
  };

  const repo: Repository = {
    mode: "demo",
    getUser: () => null,
    refresh: async () => undefined,
    onError: () => () => undefined,
    getState: get,
    subscribe: (listener) => store.subscribe(listener),
    hydrate: () => {
      if (hydrated) return;
      void store.persist.rehydrate();
      hydrated = true;
      // Keep several open tabs (for example Kopdes and Farmer side by side) in sync.
      if (typeof window !== "undefined") {
        window.addEventListener("storage", (e) => {
          if (e.key === STORAGE_KEY) void store.persist.rehydrate();
        });
      }
    },
    hasHydrated: () => hydrated,
    actions: {
      setLang: (lang) => set(cmd.setLang(fresh(), lang)),
      setRole: (role) => set(cmd.setRole(fresh(), role)),
      setActiveKitchen: (id) => set(cmd.setActive(fresh(), { activeKitchenId: id })),
      setActiveKopdes: (id) => set(cmd.setActive(fresh(), { activeKopdesId: id })),
      setActiveFarmer: (id) => set(cmd.setActive(fresh(), { activeFarmerId: id })),
      sendOffers: (kopdesId, ingredientId, weeks) => {
        const r = cmd.sendOffers(fresh(), now(), kopdesId, ingredientId, weeks);
        set(r.data);
        return r;
      },
      inviteMoreFarmers: (kopdesId, ingredientId) => {
        const r = cmd.inviteMoreFarmers(fresh(), now(), kopdesId, ingredientId);
        set(r.data);
        return r;
      },
      requestNeighbor: (kopdesId, ingredientId, weeks) => {
        const r = cmd.sendOffers(fresh(), now(), kopdesId, ingredientId, weeks, "neighbors");
        set(r.data);
        return r;
      },
      requestMenuSwitch: (kopdesId, ingredientId, weeks) => set(cmd.requestMenuSwitch(fresh(), now(), kopdesId, ingredientId, weeks)),
      chatReply: (messageId, value) => set(cmd.chatReply(fresh(), now(), messageId, value)),
      approveSuggestion: (s, optionIndex) => set(cmd.approveSuggestion(fresh(), now(), s, optionIndex)),
      rejectSuggestion: (s) => set(cmd.rejectSuggestion(fresh(), now(), s)),
      toggleDishLock: (kitchenId, dishId) => set(cmd.toggleDishLock(fresh(), now(), kitchenId, dishId)),
      updateKitchen: (kitchenId, patch) => set(cmd.updateKitchen(fresh(), now(), kitchenId, patch)),
      toggleHoliday: (kitchenId, date) => set(cmd.toggleHoliday(fresh(), now(), kitchenId, date)),
      createBatch: (input) => {
        const r = cmd.createBatch(fresh(), now(), input);
        set(r.data);
        return r.batch;
      },
      receiveBatch: (code, checks) => {
        const r = cmd.receiveBatch(fresh(), now(), code, checks);
        if (r.ok) set(r.data);
        return { ok: r.ok, error: r.error };
      },
      markKitchenPaid: (batchId) => set(cmd.markKitchenPaid(fresh(), now(), batchId)),
      markFarmersPaid: (batchId) => set(cmd.markFarmersPaid(fresh(), now(), batchId)),
      addPlateFeedback: (kitchenId, date, dishId, leftover) => set(cmd.addPlateFeedback(fresh(), kitchenId, date, dishId, leftover)),
      updateSettings: (patch) => set(cmd.updateSettings(fresh(), now(), patch)),
      exec: (name, args) => {
        const spec = COMMANDS[name];
        if (!spec) return undefined;
        const r = spec.run(fresh(), now(), args);
        set(r.data);
        return r.result;
      },
      resetDemo: () => {
        const lang = fresh().ui.lang;
        const seed = buildSeedState();
        set({ ...seed, ui: { ...seed.ui, lang } });
      },
    },
  };
  return repo;
}

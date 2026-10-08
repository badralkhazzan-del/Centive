import { createStore } from "zustand/vanilla";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AppData } from "@/types";
import { buildSeedState, SEED_VERSION } from "@/data/seed";
import * as cmd from "./commands";
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
  const set = (data: AppData) => store.setState({ data });
  const now = () => demoNow(get().today);

  const repo: Repository = {
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
      setLang: (lang) => set(cmd.setLang(get(), lang)),
      setRole: (role) => set(cmd.setRole(get(), role)),
      setActiveKitchen: (id) => set(cmd.setActive(get(), { activeKitchenId: id })),
      setActiveKopdes: (id) => set(cmd.setActive(get(), { activeKopdesId: id })),
      setActiveFarmer: (id) => set(cmd.setActive(get(), { activeFarmerId: id })),
      sendOffers: (kopdesId, ingredientId, weeks) => {
        const r = cmd.sendOffers(get(), now(), kopdesId, ingredientId, weeks);
        set(r.data);
        return r;
      },
      inviteMoreFarmers: (kopdesId, ingredientId) => {
        const r = cmd.inviteMoreFarmers(get(), now(), kopdesId, ingredientId);
        set(r.data);
        return r;
      },
      requestNeighbor: (kopdesId, ingredientId, weeks) => {
        const r = cmd.sendOffers(get(), now(), kopdesId, ingredientId, weeks, "neighbors");
        set(r.data);
        return r;
      },
      requestMenuSwitch: (kopdesId, ingredientId, weeks) => set(cmd.requestMenuSwitch(get(), now(), kopdesId, ingredientId, weeks)),
      chatReply: (messageId, value) => set(cmd.chatReply(get(), now(), messageId, value)),
      approveSuggestion: (s, optionIndex) => set(cmd.approveSuggestion(get(), now(), s, optionIndex)),
      rejectSuggestion: (s) => set(cmd.rejectSuggestion(get(), now(), s)),
      toggleDishLock: (kitchenId, dishId) => set(cmd.toggleDishLock(get(), now(), kitchenId, dishId)),
      updateKitchen: (kitchenId, patch) => set(cmd.updateKitchen(get(), now(), kitchenId, patch)),
      toggleHoliday: (kitchenId, date) => set(cmd.toggleHoliday(get(), now(), kitchenId, date)),
      createBatch: (input) => {
        const r = cmd.createBatch(get(), now(), input);
        set(r.data);
        return r.batch;
      },
      receiveBatch: (code, checks) => {
        const r = cmd.receiveBatch(get(), now(), code, checks);
        if (r.ok) set(r.data);
        return { ok: r.ok, error: r.error };
      },
      markKitchenPaid: (batchId) => set(cmd.markKitchenPaid(get(), now(), batchId)),
      markFarmersPaid: (batchId) => set(cmd.markFarmersPaid(get(), now(), batchId)),
      addPlateFeedback: (kitchenId, date, dishId, leftover) => set(cmd.addPlateFeedback(get(), kitchenId, date, dishId, leftover)),
      updateSettings: (patch) => set(cmd.updateSettings(get(), now(), patch)),
      resetDemo: () => {
        const lang = get().ui.lang;
        const seed = buildSeedState();
        set({ ...seed, ui: { ...seed.ui, lang } });
      },
    },
  };
  return repo;
}

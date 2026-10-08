"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "@/types";
import { derive, type Derived } from "@/engines/derive";
import { buildSeedState } from "@/data/seed";
import { createLocalRepository } from "./local";
import type { Repository } from "./types";

// Swap this line to use another Repository implementation (e.g. Supabase).
export const repo: Repository = createLocalRepository();
export const actions = repo.actions;

const serverSnapshot = buildSeedState();

export function useAppData(): AppData {
  return useSyncExternalStore(repo.subscribe, repo.getState, () => serverSnapshot);
}

let lastData: AppData | null = null;
let lastDerived: Derived | null = null;

export function getDerived(data: AppData): Derived {
  if (data !== lastData || !lastDerived) {
    lastData = data;
    lastDerived = derive(data);
  }
  return lastDerived;
}

/** Derived view of the current state (forecasts, coverage, alerts, suggestions...). */
export function useDerived(): Derived {
  return getDerived(useAppData());
}

export type { Repository } from "./types";

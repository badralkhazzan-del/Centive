"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "@/types";
import { derive, type Derived } from "@/engines/derive";
import { buildSeedState } from "@/data/seed";
import { isLiveBrowser } from "@/lib/live-client";
import { createRemoteRepository } from "./remote";
import type { Repository } from "./types";

// All workspace data lives on the server. A browser that is not signed in holds only
// a read-only copy of the sample region, used by public pages (trace labels, sources).
export const repo: Repository = createRemoteRepository();
export const actions = repo.actions;

if (typeof window !== "undefined") repo.hydrate();

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

export type { LiveUser, Repository } from "./types";

/** True when this browser is signed in to a workspace (an account or a guest copy). */
export const isLive = isLiveBrowser();

/** The signed-in user (null when not signed in or before the first load). */
export function useLiveUser() {
  return useSyncExternalStore(repo.subscribe, repo.getUser, () => null);
}

const noSubscribe = () => () => undefined;

/**
 * Signed in, for rendering: false during server rendering and hydration, then the
 * real value. Use this instead of `isLive` in JSX.
 */
export function useLiveMode(): boolean {
  return useSyncExternalStore(noSubscribe, () => isLive, () => false);
}

/** Signed in to a guest copy of the sample region (no account). */
export function useGuest(): boolean {
  return Boolean(useLiveUser()?.guest);
}

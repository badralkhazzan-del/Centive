"use client";

import { useSyncExternalStore } from "react";
import type { AppData } from "@/types";
import { derive, type Derived } from "@/engines/derive";
import { buildSeedState } from "@/data/seed";
import { isLiveBrowser } from "@/lib/live-client";
import { createLocalRepository } from "./local";
import { createRemoteRepository } from "./remote";
import type { Repository } from "./types";

// Signed-in browsers use their live workspace on the server; everyone else gets the
// fixed-date demo stored in this browser.
export const repo: Repository = isLiveBrowser() ? createRemoteRepository() : createLocalRepository();
export const actions = repo.actions;

// Load the saved demo data as early as possible on the client. Components read the
// store through useSyncExternalStore, which renders the server snapshot during
// hydration, so this does not cause hydration mismatches.
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

/** True when this browser uses a live (server) workspace. */
export const isLive = repo.mode === "live";

/** The signed-in live user (null in the demo or before the first load). */
export function useLiveUser() {
  return useSyncExternalStore(repo.subscribe, repo.getUser, () => null);
}

const noSubscribe = () => () => undefined;

/**
 * Live mode for rendering: false during server rendering and hydration (pages are
 * prerendered as the demo), then the real value. Use this instead of `isLive` in JSX.
 */
export function useLiveMode(): boolean {
  return useSyncExternalStore(noSubscribe, () => isLive, () => false);
}

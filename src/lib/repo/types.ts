import type { AppData, Batch, Kitchen, Lang, Leftover, Role, Settings, SubstitutionSuggestion } from "@/types";
import type { NewBatchInput, OfferResult } from "./commands";

/**
 * The repository is the only way the UI reads or changes data. The prototype ships
 * a local implementation (Zustand + localStorage). A server-backed implementation
 * (for example Supabase) can implement the same interface without touching the UI.
 */
/** The signed-in user of a live workspace (as returned by the server). */
export interface LiveUser {
  id: string;
  workspaceId: string;
  name: string;
  login: string | null;
  role: "admin" | "kitchen" | "kopdes" | "farmer" | "viewer";
  entityId: string | null;
}

export interface Repository {
  /** "demo": the fixed-date sample in this browser. "live": a shared workspace on the server. */
  mode: "demo" | "live";
  getState(): AppData;
  subscribe(listener: () => void): () => void;
  /** Load persisted data (client only). */
  hydrate(): void;
  hasHydrated(): boolean;
  /** Live mode: the signed-in user (null in the demo). */
  getUser(): LiveUser | null;
  /** Live mode: reload from the server now. */
  refresh(): Promise<void>;
  /** Live mode: failed server calls (forbidden, network...). */
  onError(listener: (kind: "forbidden" | "network" | "server" | "unauthorized") => void): () => void;
  actions: RepositoryActions;
}

export interface RepositoryActions {
  setLang(lang: Lang): void;
  setRole(role: Role | null): void;
  setActiveKitchen(id: string): void;
  setActiveKopdes(id: string): void;
  setActiveFarmer(id: string): void;

  sendOffers(kopdesId: string, ingredientId: string, weeks?: number[]): OfferResult;
  inviteMoreFarmers(kopdesId: string, ingredientId: string): OfferResult & { invited: string[] };
  requestNeighbor(kopdesId: string, ingredientId: string, weeks?: number[]): OfferResult;
  requestMenuSwitch(kopdesId: string, ingredientId: string, weeks: number[]): void;
  chatReply(messageId: string, value: string): void;

  approveSuggestion(s: SubstitutionSuggestion, optionIndex?: number): void;
  rejectSuggestion(s: SubstitutionSuggestion): void;
  toggleDishLock(kitchenId: string, dishId: string): void;
  updateKitchen(kitchenId: string, patch: Partial<Pick<Kitchen, "beneficiaries" | "attendanceRate">>): void;
  toggleHoliday(kitchenId: string, date: string): void;

  createBatch(input: NewBatchInput): Batch;
  receiveBatch(
    code: string,
    checks: { receivedChecked: boolean; coldChainChecked: boolean; receivedBy: string },
  ): { ok: boolean; error?: "not_found" | "already_received" | "checks_missing" };
  markKitchenPaid(batchId: string): void;
  markFarmersPaid(batchId: string): void;
  addPlateFeedback(kitchenId: string, date: string, dishId: string, leftover: Leftover): void;

  updateSettings(patch: Partial<Settings>): void;
  resetDemo(): void;
  /** Any command from the registry by name (data entry and management). */
  exec(name: string, args: unknown[]): unknown;
}

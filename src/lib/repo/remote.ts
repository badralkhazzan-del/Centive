import type { AppData, Role, UiState } from "@/types";
import { buildEmptyState } from "@/data/seed";
import { reloadTo, todayIso } from "@/lib/live-client";
import { COMMANDS } from "./registry";
import type { LiveUser, Repository, RepositoryActions } from "./types";

// Live repository: the workspace lives on the server. Every change runs at once on
// the local copy (same pure command as the server) and is then sent to /api/command,
// whose answer replaces the local copy. Other people's changes arrive by polling.

const POLL_MS = 4000;

type Listener = () => void;
export type LiveErrorKind = "forbidden" | "network" | "server" | "unauthorized";

export function roleOf(user: LiveUser): Role | null {
  return user.role === "kitchen" ? "kitchen" : user.role === "kopdes" ? "kopdes" : user.role === "farmer" ? "farmer" : user.role === "viewer" ? "regency" : null;
}

function randomCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return `PT-${[...bytes].map((b) => alphabet[b % alphabet.length]).join("")}`;
}

export function createRemoteRepository(): Repository {
  let data: AppData = buildEmptyState(todayIso());
  let version = -1;
  let user: LiveUser | null = null;
  let ui: UiState = data.ui;
  let view: AppData = data;
  let hydrated = false;
  let started = false;
  let queue: Promise<unknown> = Promise.resolve();
  let pending = 0;
  const listeners = new Set<Listener>();
  const errorListeners = new Set<(kind: LiveErrorKind) => void>();

  const uiKey = () => `piringtani-ui-${user?.id ?? "anon"}`;
  const saveUi = () => {
    try {
      localStorage.setItem(uiKey(), JSON.stringify(ui));
    } catch {
      /* per-device preference only */
    }
  };
  const loadUi = () => {
    try {
      const raw = localStorage.getItem(uiKey());
      if (raw) ui = { ...ui, ...(JSON.parse(raw) as Partial<UiState>) };
    } catch {
      /* ignore */
    }
  };

  /** UI state kept valid for the user's role and the current data. */
  const fixUi = (): UiState => {
    const next = { ...ui };
    if (user && user.role !== "admin") next.role = roleOf(user);
    if (user?.role === "kitchen" && user.entityId) next.activeKitchenId = user.entityId;
    if (user?.role === "kopdes" && user.entityId) next.activeKopdesId = user.entityId;
    if (user?.role === "farmer" && user.entityId) {
      next.activeFarmerId = user.entityId;
      next.activeKopdesId = data.farmers.find((f) => f.id === user!.entityId)?.kopdesId ?? next.activeKopdesId;
    }
    if (!data.kitchens.some((k) => k.id === next.activeKitchenId)) next.activeKitchenId = data.kitchens[0]?.id ?? "";
    if (!data.kopdes.some((k) => k.id === next.activeKopdesId)) next.activeKopdesId = data.kopdes[0]?.id ?? "";
    if (!data.farmers.some((f) => f.id === next.activeFarmerId)) next.activeFarmerId = data.farmers[0]?.id ?? "";
    return next;
  };

  const publish = () => {
    ui = fixUi();
    view = { ...data, ui };
    for (const l of listeners) l();
  };

  const emitError = (kind: LiveErrorKind) => {
    for (const l of errorListeners) l(kind);
  };

  const onUnauthorized = () => {
    document.cookie = "pt_live=; path=/; max-age=0";
    emitError("unauthorized");
    reloadTo("/login?expired=1");
  };

  async function fetchData(force = false) {
    if (pending > 0 && !force) return;
    try {
      const qs = version >= 0 && !force ? `?v=${version}&d=${data.today}` : "";
      const res = await fetch(`/api/data${qs}`, { credentials: "same-origin", cache: "no-store" });
      if (res.status === 401) return onUnauthorized();
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { unchanged?: boolean; data?: AppData; version: number; user?: LiveUser };
      if (pending > 0 && !force) return;
      if (body.user) {
        const first = !user;
        user = body.user;
        if (first) loadUi();
      }
      if (!body.unchanged && body.data && body.version >= version) {
        data = body.data;
        version = body.version;
      }
      hydrated = true;
      publish();
    } catch {
      emitError("network");
    }
  }

  function startPolling() {
    if (started || typeof window === "undefined") return;
    started = true;
    void fetchData(true);
    window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchData();
    }, POLL_MS);
    window.addEventListener("focus", () => void fetchData());
    window.addEventListener("online", () => void fetchData(true));
  }

  /** Apply a command locally (instant feedback), then on the server (authoritative). */
  function run<T = unknown>(name: string, args: unknown[]): T | undefined {
    const spec = COMMANDS[name];
    if (!spec) return undefined;
    const now = new Date().toISOString();
    const local = spec.run(data, now, args);
    data = local.data;
    publish();
    pending += 1;
    queue = queue
      .then(async () => {
        const res = await fetch("/api/command", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, args }),
        });
        if (res.status === 401) return onUnauthorized();
        if (res.status === 403) emitError("forbidden");
        else if (!res.ok) emitError("server");
        if (res.ok) {
          const body = (await res.json()) as { data: AppData; version: number };
          if (body.version >= version) {
            version = body.version;
            if (pending === 1) data = body.data;
          }
        }
      })
      .catch(() => emitError("network"))
      .finally(() => {
        pending -= 1;
        if (pending === 0) void fetchData(true);
      });
    return local.result as T | undefined;
  }

  const setUi = (patch: Partial<UiState>) => {
    ui = { ...ui, ...patch };
    saveUi();
    publish();
  };

  const actions: RepositoryActions = {
    setLang: (lang) => setUi({ lang }),
    setRole: (role) => setUi({ role }),
    setActiveKitchen: (id) => setUi({ activeKitchenId: id }),
    setActiveKopdes: (id) => setUi({ activeKopdesId: id }),
    setActiveFarmer: (id) => setUi({ activeFarmerId: id }),
    sendOffers: (kopdesId, ingredientId, weeks) =>
      ({ data, created: [], unallocatedKg: 0, offerWeeks: [], ...run("sendOffers", [kopdesId, ingredientId, weeks]) }) as ReturnType<RepositoryActions["sendOffers"]>,
    inviteMoreFarmers: (kopdesId, ingredientId) =>
      ({ data, created: [], unallocatedKg: 0, offerWeeks: [], invited: [], ...run("inviteMoreFarmers", [kopdesId, ingredientId]) }) as ReturnType<
        RepositoryActions["inviteMoreFarmers"]
      >,
    requestNeighbor: (kopdesId, ingredientId, weeks) =>
      ({ data, created: [], unallocatedKg: 0, offerWeeks: [], ...run("requestNeighbor", [kopdesId, ingredientId, weeks]) }) as ReturnType<RepositoryActions["requestNeighbor"]>,
    requestMenuSwitch: (kopdesId, ingredientId, weeks) => void run("requestMenuSwitch", [kopdesId, ingredientId, weeks]),
    chatReply: (messageId, value) => void run("chatReply", [messageId, value]),
    approveSuggestion: (s, optionIndex) => void run("approveSuggestion", [s.id, optionIndex ?? -1]),
    rejectSuggestion: (s) => void run("rejectSuggestion", [s.id]),
    toggleDishLock: (kitchenId, dishId) => void run("toggleDishLock", [kitchenId, dishId]),
    updateKitchen: (kitchenId, patch) => void run("updateKitchen", [kitchenId, patch]),
    toggleHoliday: (kitchenId, date) => void run("toggleHoliday", [kitchenId, date]),
    createBatch: (input) => run("createBatch", [{ ...input, code: input.code ?? randomCode() }]) as ReturnType<RepositoryActions["createBatch"]>,
    receiveBatch: (code, checks) => (run("receiveBatch", [code, checks]) as ReturnType<RepositoryActions["receiveBatch"]>) ?? { ok: false, error: "not_found" },
    markKitchenPaid: (batchId) => void run("markKitchenPaid", [batchId]),
    markFarmersPaid: (batchId) => void run("markFarmersPaid", [batchId]),
    addPlateFeedback: (kitchenId, date, dishId, leftover) => void run("addPlateFeedback", [kitchenId, date, dishId, leftover]),
    updateSettings: (patch) => void run("updateSettings", [patch]),
    resetDemo: () => undefined,
    exec: (name, args) => run(name, args),
  };

  const repo: Repository = {
    mode: "live",
    getState: () => view,
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    hydrate: startPolling,
    hasHydrated: () => hydrated,
    getUser: () => user,
    refresh: () => fetchData(true),
    onError: (l) => {
      errorListeners.add(l);
      return () => errorListeners.delete(l);
    },
    actions,
  };
  return repo;
}

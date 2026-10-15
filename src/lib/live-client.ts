// Browser helpers for workspaces on the server.

/** Set by the server next to the HttpOnly session cookie, so the browser knows it is signed in. */
export const LIVE_COOKIE = "pt_live";
/** Language preference on this device (read before first paint by the boot script). */
export const LANG_KEY = "piringtani-lang";

/** True when this browser has signed in to a workspace. */
export function isLiveBrowser(): boolean {
  return typeof document !== "undefined" && new RegExp(`(?:^|; )${LIVE_COOKIE}=1`).test(document.cookie);
}

/** Today's date (yyyy-mm-dd) on this device. The server uses the workspace time zone. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}

/** JSON request to the app's own API; throws ApiError with the server's error code. */
export async function api<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init?.method ?? (init?.body ? "POST" : "GET"),
      credentials: "same-origin",
      cache: "no-store",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? "server_error");
  return body as T;
}

/**
 * Full page load. Needed after signing in or out: the browser reads its session when
 * the app starts, so a client-side route change is not enough.
 */
export function reloadTo(path: string) {
  window.location.assign(path);
}

/** Open a private copy of the sample region (no account) and go to `path`. */
export async function startGuest(path: string) {
  await api("/api/guest", { body: {} });
  reloadTo(path);
}

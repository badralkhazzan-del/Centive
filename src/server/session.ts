import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, MODE_COOKIE, readSessionToken, SESSION_COOKIE, SESSION_DAYS, type SessionUser } from "./auth";
import { databaseConfigured } from "./db";
import { CommandError } from "./workspace";
import { getUser, UserError } from "./users";

export async function sessionUser(req: NextRequest): Promise<SessionUser | null> {
  if (!databaseConfigured()) return null;
  const token = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const user = await getUser(token.userId);
  return user && user.workspaceId === token.workspaceId ? user : null;
}

export function setSession(res: NextResponse, user: SessionUser, days = SESSION_DAYS) {
  const secure = process.env.NODE_ENV === "production";
  const maxAge = days * 86_400;
  res.cookies.set(SESSION_COOKIE, createSessionToken(user.id, user.workspaceId, days), { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge });
  res.cookies.set(MODE_COOKIE, "1", { httpOnly: false, sameSite: "lax", secure, path: "/", maxAge });
  return res;
}

export function clearSession(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(MODE_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

const STATUS: Record<string, number> = {
  forbidden: 403,
  unknown_command: 400,
  not_found: 404,
  invalid: 400,
  login_taken: 409,
  bad_credentials: 401,
  not_guest: 403,
  rate_limited: 429,
  invite_expired: 410,
};

/** Turns known errors into JSON responses; anything else is a 500 without details. */
export function handle(fn: () => Promise<Response>) {
  return fn().catch((e: unknown) => {
    if (e instanceof UserError || e instanceof CommandError) return json({ error: e.code }, STATUS[e.code] ?? 400);
    console.error(e);
    return json({ error: "server_error" }, 500);
  });
}

export function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

/** The visitor's address, for rate limits (Vercel sets x-forwarded-for). */
export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

/** Reject cross-site form posts: the Origin of a state-changing request must match. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

export async function body<T>(req: NextRequest): Promise<Partial<T>> {
  try {
    const b = (await req.json()) as unknown;
    return b && typeof b === "object" ? (b as Partial<T>) : {};
  } catch {
    return {};
  }
}

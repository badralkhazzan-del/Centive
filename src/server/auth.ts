import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { databaseUrl } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>;

export const SESSION_COOKIE = "pt_session";
/** Readable by the browser: tells the client to use the live (server) repository. */
export const MODE_COOKIE = "pt_live";
export const SESSION_DAYS = 30;

export type UserRole = "admin" | "kitchen" | "kopdes" | "farmer" | "viewer";
export const USER_ROLES: UserRole[] = ["admin", "kitchen", "kopdes", "farmer", "viewer"];

export interface SessionUser {
  id: string;
  workspaceId: string;
  name: string;
  login: string | null;
  role: UserRole;
  entityId: string | null;
}

export function newId(prefix: string): string {
  return `${prefix}-${randomBytes(9).toString("base64url")}`;
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

/** Emails are lower-cased; phone numbers keep digits only and use the 62 country code. */
export function normalizeLogin(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s.includes("@")) return s;
  let digits = s.replace(/[^0-9]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return digits;
}

export function validLogin(login: string): boolean {
  if (login.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(login);
  return /^[0-9]{9,15}$/.test(login);
}

const SCRYPT = { N: 16384, r: 8, p: 1 };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32, SCRYPT);
  return `scrypt$${SCRYPT.N}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [kind, n, saltB64, hashB64] = stored.split("$");
  if (kind !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64url"), expected.length, { ...SCRYPT, N: Number(n) });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // Fall back to a key derived from the database URL (itself a secret). Locally, a fixed dev key.
  return createHash("sha256").update(`piringtani:${databaseUrl() ?? "local-dev"}`).digest("hex");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, workspaceId: string, days = SESSION_DAYS): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, w: workspaceId, e: Date.now() + days * 86_400_000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined | null): { userId: string; workspaceId: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u: string; w: string; e: number };
    if (typeof p.e !== "number" || p.e < Date.now()) return null;
    return { userId: p.u, workspaceId: p.w };
  } catch {
    return null;
  }
}

/** Today's date (yyyy-mm-dd) in the workspace's time zone. */
export function todayIn(timezone: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

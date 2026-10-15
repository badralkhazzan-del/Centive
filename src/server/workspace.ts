import type { AppData, WorkspaceMeta } from "@/types";
import { buildEmptyState, buildSeedState, SEED_VERSION } from "@/data/seed";
import { rollForward } from "@/engines/rollover";
import { allowed, COMMANDS, type Actor } from "@/lib/repo/registry";
import { newId, todayIn, type SessionUser, type UserRole } from "./auth";
import { getDb, type Queryable } from "./db";

// Live workspaces: one row per organisation holding its AppData as JSON. Commands run
// inside a transaction with a row lock, so two people acting at once never overwrite
// each other. The stored data always moves to the real date before it is used.

export const DEFAULT_TIMEZONE = "Asia/Jakarta";

export type StartWith = "sample" | "empty";

export function initialData(meta: Omit<WorkspaceMeta, "createdAt">, start: StartWith, at = new Date()): AppData {
  const today = todayIn(meta.timezone, at);
  const base = start === "sample" ? buildSeedState(today) : buildEmptyState(today);
  const data: AppData = { ...base, workspace: { ...meta, sample: start === "sample", createdAt: at.toISOString() } };
  if (start === "sample") {
    data.auditLog = [
      { id: "log-sample", timestamp: at.toISOString(), actorRole: "system", action: "sample_loaded", details: `Fictional sample region loaded for ${meta.name}.` },
      ...data.auditLog.filter((l) => l.id !== "log-seed"),
    ];
  }
  return data;
}

/** Bring stored data to the real date in the workspace time zone. */
export function toToday(data: AppData, at = new Date()): AppData {
  const tz = data.workspace?.timezone ?? DEFAULT_TIMEZONE;
  return rollForward(data, todayIn(tz, at));
}

export function actorOf(role: UserRole): Actor {
  return role;
}

/**
 * What each role may see. Farmers only see their own messages and orders; other
 * farmers appear without names or phone numbers (the board still shows totals).
 * Full phone numbers are visible only to admins and the farmer's own Kopdes.
 */
export function viewFor(user: Pick<SessionUser, "role" | "entityId">, data: AppData): AppData {
  const ownKopdes = user.role === "kopdes" ? user.entityId : null;
  const farmers = data.farmers.map((f) => {
    if (user.role === "admin" || f.kopdesId === ownKopdes) return f;
    if (user.role === "farmer" && f.id === user.entityId) return f;
    const { phone: _phone, ...rest } = f;
    void _phone;
    if (user.role === "farmer") return { ...rest, displayName: "•••", phoneMasked: "" };
    return rest;
  });
  if (user.role !== "farmer") return { ...data, farmers };
  return {
    ...data,
    farmers,
    chat: data.chat.filter((m) => m.farmerId === user.entityId),
    auditLog: [],
    payments: data.payments.filter((p) => data.batches.find((b) => b.id === p.batchId)?.farmerIds.includes(user.entityId ?? "")),
  };
}

interface Row {
  data: AppData;
  version: number;
  name: string;
}

export async function readWorkspace(q: Queryable, id: string, lock = false): Promise<Row | null> {
  const rows = await q.query<Row>(`select data, version, name from pt_workspaces where id = $1${lock ? " for update" : ""}`, [id]);
  const row = rows[0];
  if (!row) return null;
  const data = typeof row.data === "string" ? (JSON.parse(row.data) as AppData) : row.data;
  return { ...row, data };
}

async function writeWorkspace(q: Queryable, id: string, data: AppData, version: number) {
  await q.query(`update pt_workspaces set data = $2::jsonb, version = $3, name = $4, updated_at = now() where id = $1`, [
    id,
    JSON.stringify(data),
    version,
    data.workspace?.name ?? "Workspace",
  ]);
}

/** Current data for a user (moved to today, filtered for their role). */
export async function loadFor(user: SessionUser): Promise<{ data: AppData; version: number } | null> {
  const db = await getDb();
  const row = await readWorkspace(db, user.workspaceId);
  if (!row) return null;
  return { data: viewFor(user, toToday(row.data)), version: row.version };
}

export class CommandError extends Error {
  constructor(
    public code: "forbidden" | "unknown_command" | "not_found",
    message = code,
  ) {
    super(message);
  }
}

/** Run one command for a user and save the result. */
export async function runCommand(user: SessionUser, name: string, args: unknown[], at = new Date()) {
  const spec = COMMANDS[name];
  if (!spec) throw new CommandError("unknown_command");
  const db = await getDb();
  return db.tx(async (q) => {
    const row = await readWorkspace(q, user.workspaceId, true);
    if (!row) throw new CommandError("not_found");
    const current = toToday(row.data, at);
    if (!allowed(actorOf(user.role), user.entityId, name, current, args)) throw new CommandError("forbidden");
    const { data: next, result } = spec.run(current, at.toISOString(), args);
    const changed = next !== current;
    const version = changed || current !== row.data ? row.version + 1 : row.version;
    if (version !== row.version) await writeWorkspace(q, user.workspaceId, { ...next, ui: row.data.ui }, version);
    return { data: viewFor(user, next), version, result, changed };
  });
}

export async function createWorkspace(input: { name: string; region: string; timezone?: string; start: StartWith; guest?: boolean }, at = new Date()) {
  const db = await getDb();
  const id = newId("ws");
  const data = initialData({ id, name: input.name, region: input.region, timezone: input.timezone ?? DEFAULT_TIMEZONE, sample: input.start === "sample" }, input.start, at);
  await db.query(`insert into pt_workspaces (id, name, data, version, guest) values ($1, $2, $3::jsonb, 1, $4)`, [id, input.name, JSON.stringify(data), Boolean(input.guest)]);
  return { id, data };
}

/** Admin: start over with the sample region or an empty workspace (users are kept). */
export async function resetWorkspace(user: SessionUser, start: StartWith, at = new Date()) {
  if (user.role !== "admin") throw new CommandError("forbidden");
  const db = await getDb();
  return db.tx(async (q) => {
    const row = await readWorkspace(q, user.workspaceId, true);
    if (!row) throw new CommandError("not_found");
    const meta = row.data.workspace!;
    const data = initialData({ ...meta }, start, at);
    data.workspace = { ...data.workspace!, createdAt: meta.createdAt };
    await writeWorkspace(q, user.workspaceId, data, row.version + 1);
    return { data: viewFor(user, data), version: row.version + 1 };
  });
}

export async function renameWorkspace(user: SessionUser, name: string, region: string) {
  if (user.role !== "admin") throw new CommandError("forbidden");
  const db = await getDb();
  return db.tx(async (q) => {
    const row = await readWorkspace(q, user.workspaceId, true);
    if (!row) throw new CommandError("not_found");
    const data: AppData = { ...row.data, workspace: { ...row.data.workspace!, name: name.trim().slice(0, 80) || row.data.workspace!.name, region: region.trim().slice(0, 80) } };
    await writeWorkspace(q, user.workspaceId, data, row.version + 1);
    return { data: viewFor(user, toToday(data)), version: row.version + 1 };
  });
}

export const LIVE_DATA_VERSION = SEED_VERSION;

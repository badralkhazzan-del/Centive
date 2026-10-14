import { hashPassword, newId, newToken, normalizeLogin, USER_ROLES, validLogin, verifyPassword, type SessionUser, type UserRole } from "./auth";
import { getDb } from "./db";
import { readWorkspace } from "./workspace";

export const INVITE_DAYS = 14;
const MAX_ATTEMPTS = 8;
const WINDOW_MIN = 15;

interface UserRow {
  id: string;
  workspace_id: string;
  name: string;
  login: string | null;
  password_hash: string | null;
  role: UserRole;
  entity_id: string | null;
  invite_token: string | null;
  invite_expires: string | Date | null;
  created_at: string | Date;
  last_login: string | Date | null;
}

export interface PublicUser {
  id: string;
  name: string;
  login: string | null;
  role: UserRole;
  entityId: string | null;
  invitePending: boolean;
  inviteExpires: string | null;
  createdAt: string;
  lastLogin: string | null;
}

export class UserError extends Error {
  constructor(public code: "forbidden" | "invalid" | "login_taken" | "not_found" | "bad_credentials" | "rate_limited" | "invite_expired") {
    super(code);
  }
}

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

function toSession(r: UserRow): SessionUser {
  return { id: r.id, workspaceId: r.workspace_id, name: r.name, login: r.login, role: r.role, entityId: r.entity_id };
}

function toPublic(r: UserRow): PublicUser {
  return {
    id: r.id,
    name: r.name,
    login: r.login,
    role: r.role,
    entityId: r.entity_id,
    invitePending: Boolean(r.invite_token),
    inviteExpires: iso(r.invite_expires),
    createdAt: iso(r.created_at)!,
    lastLogin: iso(r.last_login),
  };
}

export function validPassword(pw: unknown): pw is string {
  return typeof pw === "string" && pw.length >= 6 && pw.length <= 200;
}

export async function getUser(id: string): Promise<SessionUser | null> {
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where id = $1`, [id]);
  return rows[0] ? toSession(rows[0]) : null;
}

export async function createAdmin(workspaceId: string, name: string, rawLogin: string, password: string): Promise<SessionUser> {
  const login = normalizeLogin(rawLogin);
  if (!validLogin(login) || !validPassword(password) || !name.trim()) throw new UserError("invalid");
  const db = await getDb();
  const taken = await db.query(`select 1 from pt_users where login = $1`, [login]);
  if (taken.length) throw new UserError("login_taken");
  const id = newId("u");
  await db.query(`insert into pt_users (id, workspace_id, name, login, password_hash, role) values ($1, $2, $3, $4, $5, 'admin')`, [
    id,
    workspaceId,
    name.trim().slice(0, 80),
    login,
    await hashPassword(password),
  ]);
  return { id, workspaceId, name: name.trim(), login, role: "admin", entityId: null };
}

async function throttle(key: string): Promise<void> {
  const db = await getDb();
  const rows = await db.query<{ count: number; reset_at: string | Date }>(`select count, reset_at from pt_login_attempts where key = $1`, [key]);
  const row = rows[0];
  if (row && new Date(row.reset_at).getTime() > Date.now() && row.count >= MAX_ATTEMPTS) throw new UserError("rate_limited");
}

async function recordFailure(key: string) {
  const db = await getDb();
  await db.query(
    `insert into pt_login_attempts (key, count, reset_at) values ($1, 1, now() + interval '${WINDOW_MIN} minutes')
     on conflict (key) do update set
       count = case when pt_login_attempts.reset_at < now() then 1 else pt_login_attempts.count + 1 end,
       reset_at = case when pt_login_attempts.reset_at < now() then now() + interval '${WINDOW_MIN} minutes' else pt_login_attempts.reset_at end`,
    [key],
  );
}

export async function login(rawLogin: string, password: string): Promise<SessionUser> {
  const login = normalizeLogin(rawLogin);
  const key = `login:${login}`;
  await throttle(key);
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where login = $1`, [login]);
  const row = rows[0];
  const ok = row ? await verifyPassword(password, row.password_hash) : await verifyPassword(password, "scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
  if (!row || !ok) {
    await recordFailure(key);
    throw new UserError("bad_credentials");
  }
  await db.query(`update pt_users set last_login = now() where id = $1`, [row.id]);
  await db.query(`delete from pt_login_attempts where key = $1`, [key]);
  return toSession(row);
}

/** Which entity (kitchen, Kopdes, farmer) a role must be linked to. */
function entityKind(role: UserRole): "kitchens" | "kopdes" | "farmers" | null {
  return role === "kitchen" ? "kitchens" : role === "kopdes" ? "kopdes" : role === "farmer" ? "farmers" : null;
}

/** Admins invite anyone; a Kopdes manager may invite farmers of their own Kopdes. */
export async function inviteUser(actor: SessionUser, input: { name: string; role: UserRole; entityId?: string | null }) {
  if (!USER_ROLES.includes(input.role) || !input.name?.trim()) throw new UserError("invalid");
  const db = await getDb();
  const ws = await readWorkspace(db, actor.workspaceId);
  if (!ws) throw new UserError("not_found");
  const kind = entityKind(input.role);
  const entityId = kind ? (input.entityId ?? null) : null;
  if (kind) {
    const list = ws.data[kind] as { id: string; kopdesId?: string }[];
    const entity = list.find((e) => e.id === entityId);
    if (!entity) throw new UserError("invalid");
    if (actor.role !== "admin" && !(actor.role === "kopdes" && input.role === "farmer" && entity.kopdesId === actor.entityId)) throw new UserError("forbidden");
  } else if (actor.role !== "admin") throw new UserError("forbidden");
  const id = newId("u");
  const token = newToken();
  await db.query(
    `insert into pt_users (id, workspace_id, name, role, entity_id, invite_token, invite_expires) values ($1, $2, $3, $4, $5, $6, now() + interval '${INVITE_DAYS} days')`,
    [id, actor.workspaceId, input.name.trim().slice(0, 80), input.role, entityId, token],
  );
  return { id, token };
}

async function canManage(actor: SessionUser, target: UserRow): Promise<boolean> {
  if (target.workspace_id !== actor.workspaceId) return false;
  if (actor.role === "admin") return true;
  if (actor.role === "kopdes" && target.role === "farmer") {
    const db = await getDb();
    const ws = await readWorkspace(db, actor.workspaceId);
    return Boolean(ws?.data.farmers.find((f) => f.id === target.entity_id && f.kopdesId === actor.entityId));
  }
  return false;
}

export async function listUsers(actor: SessionUser): Promise<PublicUser[]> {
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where workspace_id = $1 order by created_at`, [actor.workspaceId]);
  const out: PublicUser[] = [];
  for (const r of rows) if (r.id === actor.id || (await canManage(actor, r))) out.push(toPublic(r));
  return out;
}

/** New invite link for a user (also used to reset a forgotten password). */
export async function reinvite(actor: SessionUser, userId: string) {
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where id = $1`, [userId]);
  const target = rows[0];
  if (!target || !(await canManage(actor, target)) || target.id === actor.id) throw new UserError("forbidden");
  const token = newToken();
  await db.query(`update pt_users set invite_token = $2, invite_expires = now() + interval '${INVITE_DAYS} days' where id = $1`, [userId, token]);
  return { token };
}

export async function removeUser(actor: SessionUser, userId: string) {
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where id = $1`, [userId]);
  const target = rows[0];
  if (!target || target.id === actor.id || !(await canManage(actor, target))) throw new UserError("forbidden");
  await db.query(`delete from pt_users where id = $1`, [userId]);
}

export async function inviteInfo(token: string) {
  const db = await getDb();
  const rows = await db.query<UserRow & { ws_name: string }>(
    `select u.*, w.name as ws_name from pt_users u join pt_workspaces w on w.id = u.workspace_id where u.invite_token = $1`,
    [token],
  );
  const r = rows[0];
  if (!r) throw new UserError("not_found");
  if (r.invite_expires && new Date(r.invite_expires).getTime() < Date.now()) throw new UserError("invite_expired");
  return { name: r.name, role: r.role, workspaceName: r.ws_name, login: r.login };
}

export async function acceptInvite(token: string, rawLogin: string, password: string): Promise<SessionUser> {
  const login = normalizeLogin(rawLogin);
  if (!validLogin(login) || !validPassword(password)) throw new UserError("invalid");
  const db = await getDb();
  return db.tx(async (q) => {
    const rows = await q.query<UserRow>(`select * from pt_users where invite_token = $1 for update`, [token]);
    const r = rows[0];
    if (!r) throw new UserError("not_found");
    if (r.invite_expires && new Date(r.invite_expires).getTime() < Date.now()) throw new UserError("invite_expired");
    const taken = await q.query(`select 1 from pt_users where login = $1 and id <> $2`, [login, r.id]);
    if (taken.length) throw new UserError("login_taken");
    await q.query(`update pt_users set login = $2, password_hash = $3, invite_token = null, invite_expires = null, last_login = now() where id = $1`, [
      r.id,
      login,
      await hashPassword(password),
    ]);
    return { ...toSession(r), login };
  });
}

export async function changePassword(user: SessionUser, current: string, next: string) {
  if (!validPassword(next)) throw new UserError("invalid");
  const db = await getDb();
  const rows = await db.query<UserRow>(`select * from pt_users where id = $1`, [user.id]);
  if (!rows[0] || !(await verifyPassword(current, rows[0].password_hash))) throw new UserError("bad_credentials");
  await db.query(`update pt_users set password_hash = $2 where id = $1`, [user.id, await hashPassword(next)]);
}

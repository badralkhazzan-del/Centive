import { newId, newToken, type SessionUser } from "./auth";
import { getDb } from "./db";
import { recordFailure, throttle, UserError } from "./users";
import { createWorkspace, readWorkspace } from "./workspace";

// Guest workspaces: anyone can open the platform without an account. Each visitor
// gets a private copy of the fictional sample region, so nobody changes what another
// visitor sees. Copies untouched for GUEST_DAYS are deleted.

export const GUEST_DAYS = 7;
const GUESTS_PER_HOUR = 30;
/** Each copy is about 140 KB; this keeps guests well inside a free database plan. */
export const MAX_GUESTS = 1500;

export type PhoneRole = "farmer" | "kopdes" | "kitchen";

/** Delete guest workspaces nobody has changed for GUEST_DAYS (their users go with them), keeping room for one more. */
export async function cleanupGuests(): Promise<number> {
  const db = await getDb();
  const rows = await db.query<{ id: string }>(`delete from pt_workspaces where guest and updated_at < now() - interval '${GUEST_DAYS} days' returning id`);
  // Past the cap, the least recently used copies go first.
  const over = await db.query<{ id: string }>(
    `delete from pt_workspaces where id in (select id from pt_workspaces where guest order by updated_at desc offset ${MAX_GUESTS - 1}) returning id`,
  );
  return rows.length + over.length;
}

/** A new private sample workspace and its (account-less) administrator. */
export async function startGuest(ip: string): Promise<SessionUser> {
  const key = `guest:${ip}`;
  await throttle(key, GUESTS_PER_HOUR);
  await recordFailure(key, 60);
  await cleanupGuests();
  const ws = await createWorkspace({ name: "Banyumas sample region", region: "Banyumas", start: "sample", guest: true });
  const db = await getDb();
  const id = newId("u");
  await db.query(`insert into pt_users (id, workspace_id, name, role) values ($1, $2, 'Guest', 'admin')`, [id, ws.id]);
  return { id, workspaceId: ws.id, name: "Guest", login: null, role: "admin", entityId: null, guest: true };
}

const LIST = { farmer: "farmers", kopdes: "kopdes", kitchen: "kitchens" } as const;

/**
 * A sign-in link for a second device (usually a phone) in a guest workspace, opened
 * as one farmer, Kopdes or kitchen. The same link keeps working while the workspace exists.
 */
export async function phoneLink(actor: SessionUser, role: PhoneRole, entityId: string): Promise<{ token: string; name: string }> {
  if (!actor.guest || actor.role !== "admin") throw new UserError("forbidden");
  if (!(role in LIST)) throw new UserError("invalid");
  const db = await getDb();
  const ws = await readWorkspace(db, actor.workspaceId);
  if (!ws) throw new UserError("not_found");
  const entity = (ws.data[LIST[role]] as { id: string; name?: string; displayName?: string }[]).find((e) => e.id === entityId);
  if (!entity) throw new UserError("invalid");
  const name = (entity.displayName ?? entity.name ?? role).slice(0, 80);
  const existing = await db.query<{ invite_token: string }>(
    `select invite_token from pt_users where workspace_id = $1 and role = $2 and entity_id = $3 and login is null and invite_token is not null limit 1`,
    [actor.workspaceId, role, entityId],
  );
  if (existing[0]) return { token: existing[0].invite_token, name };
  const token = newToken();
  await db.query(
    `insert into pt_users (id, workspace_id, name, role, entity_id, invite_token, invite_expires) values ($1, $2, $3, $4, $5, $6, now() + interval '${GUEST_DAYS} days')`,
    [newId("u"), actor.workspaceId, name, role, entityId, token],
  );
  return { token, name };
}

/** Sign a device in with a phone link. Only links of guest workspaces work this way. */
export async function claimPhone(token: string): Promise<SessionUser> {
  if (!token) throw new UserError("not_found");
  const db = await getDb();
  const rows = await db.query<{ id: string; workspace_id: string; name: string; role: PhoneRole; entity_id: string; invite_expires: string | Date | null }>(
    `select u.id, u.workspace_id, u.name, u.role, u.entity_id, u.invite_expires from pt_users u join pt_workspaces w on w.id = u.workspace_id
     where u.invite_token = $1 and w.guest and u.login is null`,
    [token],
  );
  const r = rows[0];
  if (!r) throw new UserError("not_found");
  if (r.invite_expires && new Date(r.invite_expires).getTime() < Date.now()) throw new UserError("invite_expired");
  return { id: r.id, workspaceId: r.workspace_id, name: r.name, login: null, role: r.role, entityId: r.entity_id, guest: true };
}

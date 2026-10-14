import type { NextRequest } from "next/server";
import type { UserRole } from "@/server/auth";
import { body, handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";
import { inviteUser, listUsers } from "@/server/users";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    return json({ users: await listUsers(user) });
  });
}

/** Create an account and return its invite link token. */
export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ name: string; role: UserRole; entityId: string | null }>(req);
    const r = await inviteUser(user, { name: String(b.name ?? ""), role: b.role as UserRole, entityId: b.entityId ?? null });
    return json({ ok: true, ...r });
  });
}

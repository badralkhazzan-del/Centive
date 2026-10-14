import type { NextRequest } from "next/server";
import { databaseConfigured } from "@/server/db";
import { body, handle, json, sameOrigin, setSession } from "@/server/session";
import { acceptInvite, inviteInfo } from "@/server/users";

export const dynamic = "force-dynamic";

/** Who an invite link is for (shown on the join page). */
export function GET(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    const token = req.nextUrl.searchParams.get("token") ?? "";
    return json({ invite: await inviteInfo(token) });
  });
}

/** Accept an invite: choose a login (email or phone) and password. */
export function POST(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ token: string; login: string; password: string }>(req);
    const user = await acceptInvite(String(b.token ?? ""), String(b.login ?? ""), String(b.password ?? ""));
    return setSession(json({ ok: true, user }), user);
  });
}

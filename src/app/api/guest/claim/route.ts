import type { NextRequest } from "next/server";
import { databaseConfigured } from "@/server/db";
import { claimPhone, GUEST_DAYS } from "@/server/guest";
import { body, handle, json, sameOrigin, setSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Sign this device in with a phone link from a guest workspace. */
export function POST(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ token: string }>(req);
    const user = await claimPhone(String(b.token ?? ""));
    return setSession(json({ ok: true, user }), user, GUEST_DAYS);
  });
}

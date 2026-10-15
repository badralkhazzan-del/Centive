import type { NextRequest } from "next/server";
import { databaseConfigured } from "@/server/db";
import { GUEST_DAYS, startGuest } from "@/server/guest";
import { clientIp, handle, json, sameOrigin, setSession } from "@/server/session";

export const dynamic = "force-dynamic";

/** Open the platform without an account: a private copy of the sample region. */
export function POST(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const user = await startGuest(clientIp(req));
    return setSession(json({ ok: true, user }), user, GUEST_DAYS);
  });
}

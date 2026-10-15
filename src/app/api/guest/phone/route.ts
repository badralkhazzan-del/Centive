import type { NextRequest } from "next/server";
import { phoneLink, type PhoneRole } from "@/server/guest";
import { body, handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";

export const dynamic = "force-dynamic";

/** Guest admin: a link that opens this workspace on a phone as one farmer, Kopdes or kitchen. */
export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ role: PhoneRole; entityId: string }>(req);
    return json({ ok: true, ...(await phoneLink(user, b.role as PhoneRole, String(b.entityId ?? ""))) });
  });
}

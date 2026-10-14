import type { NextRequest } from "next/server";
import { body, handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";
import { changePassword } from "@/server/users";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ current: string; next: string }>(req);
    await changePassword(user, String(b.current ?? ""), String(b.next ?? ""));
    return json({ ok: true });
  });
}

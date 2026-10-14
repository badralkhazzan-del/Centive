import type { NextRequest } from "next/server";
import { handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";
import { reinvite, removeUser } from "@/server/users";

export const dynamic = "force-dynamic";

/** New invite link (also resets a forgotten password). */
export function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const { id } = await ctx.params;
    return json({ ok: true, ...(await reinvite(user, id)) });
  });
}

export function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const { id } = await ctx.params;
    await removeUser(user, id);
    return json({ ok: true });
  });
}

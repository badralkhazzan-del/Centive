import type { NextRequest } from "next/server";
import { handle, json, sessionUser, unauthorized } from "@/server/session";
import { loadFor } from "@/server/workspace";

export const dynamic = "force-dynamic";

/** The workspace data for the signed-in user. ?v=<version> returns {unchanged:true} when nothing changed. */
export function GET(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    const loaded = await loadFor(user);
    if (!loaded) return json({ error: "not_found" }, 404);
    const known = Number(req.nextUrl.searchParams.get("v"));
    const day = req.nextUrl.searchParams.get("d");
    if (known === loaded.version && day === loaded.data.today) return json({ unchanged: true, version: loaded.version });
    return json({ data: loaded.data, version: loaded.version, user });
  });
}

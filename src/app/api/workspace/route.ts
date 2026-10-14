import type { NextRequest } from "next/server";
import { body, handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";
import { renameWorkspace, resetWorkspace } from "@/server/workspace";

export const dynamic = "force-dynamic";

/** Admin: { action: "reset", start: "sample" | "empty" } or { action: "rename", name, region }. */
export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ action: string; start: string; name: string; region: string }>(req);
    if (b.action === "reset") return json(await resetWorkspace(user, b.start === "empty" ? "empty" : "sample"));
    if (b.action === "rename") return json(await renameWorkspace(user, String(b.name ?? ""), String(b.region ?? "")));
    return json({ error: "invalid" }, 400);
  });
}

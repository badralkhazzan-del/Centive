import type { NextRequest } from "next/server";
import { body, handle, json, sameOrigin, sessionUser, unauthorized } from "@/server/session";
import { runCommand } from "@/server/workspace";

export const dynamic = "force-dynamic";

/** Run one data command ({ name, args }) as the signed-in user. */
export function POST(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return unauthorized();
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ name: string; args: unknown[] }>(req);
    const r = await runCommand(user, String(b.name ?? ""), Array.isArray(b.args) ? b.args : []);
    return json({ data: r.data, version: r.version, result: r.result ?? null });
  });
}

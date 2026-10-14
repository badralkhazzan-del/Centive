import type { NextRequest } from "next/server";
import { databaseConfigured } from "@/server/db";
import { body, handle, json, sameOrigin, setSession } from "@/server/session";
import { login } from "@/server/users";

export const dynamic = "force-dynamic";

export function POST(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ login: string; password: string }>(req);
    const user = await login(String(b.login ?? ""), String(b.password ?? ""));
    return setSession(json({ ok: true, user }), user);
  });
}

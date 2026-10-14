import type { NextRequest } from "next/server";
import { databaseConfigured } from "@/server/db";
import { body, handle, json, sameOrigin, setSession } from "@/server/session";
import { createAdmin, UserError } from "@/server/users";
import { createWorkspace, type StartWith } from "@/server/workspace";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Create a new workspace and its first admin account. */
export function POST(req: NextRequest) {
  return handle(async () => {
    if (!databaseConfigured()) return json({ error: "no_database" }, 503);
    if (!sameOrigin(req)) return json({ error: "forbidden" }, 403);
    const b = await body<{ workspaceName: string; region: string; name: string; login: string; password: string; start: StartWith }>(req);
    if (!b.workspaceName?.trim() || !b.name?.trim() || !b.login || !b.password) throw new UserError("invalid");
    const start: StartWith = b.start === "empty" ? "empty" : "sample";
    const ws = await createWorkspace({ name: b.workspaceName.trim().slice(0, 80), region: (b.region ?? "").trim().slice(0, 80), start });
    try {
      const user = await createAdmin(ws.id, b.name, b.login, b.password);
      return setSession(json({ ok: true, user }), user);
    } catch (e) {
      const db = await getDb();
      await db.query(`delete from pt_workspaces where id = $1`, [ws.id]);
      throw e;
    }
  });
}

import type { NextRequest } from "next/server";
import { clearSession, handle, json, sessionUser } from "@/server/session";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  return handle(async () => {
    const user = await sessionUser(req);
    if (!user) return clearSession(json({ user: null }));
    return json({ user });
  });
}

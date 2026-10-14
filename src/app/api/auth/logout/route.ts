import { clearSession, json } from "@/server/session";

export const dynamic = "force-dynamic";

export function POST() {
  return clearSession(json({ ok: true }));
}

import { databaseConfigured } from "@/server/db";
import { json } from "@/server/session";

export const dynamic = "force-dynamic";

/** Whether live workspaces are available on this deployment. */
export async function GET() {
  return json({ live: databaseConfigured() });
}

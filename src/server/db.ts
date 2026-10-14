// Database access for live workspaces (server only).
//
// Production: set DATABASE_URL (or POSTGRES_URL) to a Postgres connection string,
// for example Neon from the Vercel Marketplace or Supabase. Locally, without a URL,
// an embedded Postgres (PGlite) stores data in node_modules/.cache/piringtani so everything still runs.

export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
}

export interface Db extends Queryable {
  tx<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
  kind: "postgres" | "pglite";
}

const SCHEMA = `
create table if not exists pt_workspaces (
  id text primary key,
  name text not null,
  data jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists pt_users (
  id text primary key,
  workspace_id text not null references pt_workspaces(id) on delete cascade,
  name text not null,
  login text unique,
  password_hash text,
  role text not null,
  entity_id text,
  invite_token text unique,
  invite_expires timestamptz,
  created_at timestamptz not null default now(),
  last_login timestamptz
);
create index if not exists pt_users_workspace on pt_users(workspace_id);
create table if not exists pt_login_attempts (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);
`;

/**
 * The Postgres connection string. Vercel's Neon integration names it after the prefix
 * chosen when connecting (DATABASE_URL by default, STORAGE_URL with the "STORAGE" prefix).
 */
export function databaseUrl(): string | undefined {
  const env = process.env;
  return env.DATABASE_URL || env.POSTGRES_URL || env.STORAGE_URL || env.NEON_DATABASE_URL || env.STORAGE_DATABASE_URL || undefined;
}

/** True when live workspaces can be used (a database URL is set, or we are not in production). */
export function databaseConfigured(): boolean {
  return Boolean(databaseUrl()) || process.env.NODE_ENV !== "production" || process.env.PT_PGLITE === "1";
}

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  // prepare: false keeps it compatible with transaction poolers (Supabase, Neon pooled URLs).
  const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 15 });
  const run = (s: typeof sql) => async <T,>(text: string, params: unknown[] = []) =>
    (await s.unsafe(text, params as never[])) as unknown as T[];
  return {
    kind: "postgres",
    query: run(sql),
    tx: async (fn) => (await sql.begin(async (t) => fn({ query: run(t as unknown as typeof sql) }))) as never,
  };
}

async function createPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  // Outside the watched source tree, so the dev server does not reload on every write.
  const dir = process.env.PT_PGLITE_DIR ?? (process.env.NODE_ENV === "test" ? undefined : "node_modules/.cache/piringtani/pglite");
  if (dir) {
    const { mkdirSync } = await import("node:fs");
    mkdirSync(dir, { recursive: true });
  }
  const pg = dir ? new PGlite(dir) : new PGlite();
  await pg.waitReady;
  const run = (p: { query: (t: string, v?: unknown[]) => Promise<{ rows: unknown[] }> }) => async <T,>(text: string, params: unknown[] = []) =>
    (await p.query(text, params)).rows as T[];
  return {
    kind: "pglite",
    query: run(pg),
    tx: (fn) => pg.transaction(async (t) => fn({ query: run(t) })),
  };
}

const g = globalThis as unknown as { __ptDb?: Promise<Db> };

/** The shared database handle, created once per server instance, with the schema applied. */
export function getDb(): Promise<Db> {
  if (!g.__ptDb) {
    g.__ptDb = (async () => {
      const url = databaseUrl();
      const db = url ? await createPostgres(url) : await createPglite();
      for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) await db.query(stmt);
      return db;
    })().catch((e) => {
      g.__ptDb = undefined;
      throw e;
    });
  }
  return g.__ptDb;
}

/** Tests only: use a fresh in-memory database. */
export function resetDbForTests() {
  g.__ptDb = undefined;
}

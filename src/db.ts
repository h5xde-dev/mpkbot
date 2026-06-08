import { neon } from '@neondatabase/serverless';

export type Sql = ReturnType<typeof neon>;

let sql: Sql | null = null;
let schemaReady: Promise<void> | null = null;

export function getDatabaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL
  );
}

export function usePostgresStorage(): boolean {
  return Boolean(getDatabaseUrl());
}

export function getSql(): Sql {
  if (!sql) {
    const url = getDatabaseUrl();
    if (!url) {
      throw new Error('DATABASE_URL или POSTGRES_URL не задан');
    }
    sql = neon(url);
  }
  return sql;
}

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = initSchema();
  }
  return schemaReady;
}

async function initSchema(): Promise<void> {
  const db = getSql();

  await db`
    CREATE TABLE IF NOT EXISTS users (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      teacher TEXT,
      linked_at TIMESTAMPTZ
    )
  `;

  await db`
    CREATE TABLE IF NOT EXISTS teachers_cache (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      teachers JSONB NOT NULL,
      cached_at TIMESTAMPTZ NOT NULL
    )
  `;
}

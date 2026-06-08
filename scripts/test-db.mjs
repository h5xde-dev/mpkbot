import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!url) {
  console.error('DATABASE_URL не задан');
  process.exit(1);
}

const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS users (
    chat_id TEXT PRIMARY KEY,
    username TEXT,
    teacher TEXT,
    linked_at TIMESTAMPTZ
  )
`;

await sql`
  CREATE TABLE IF NOT EXISTS teachers_cache (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    teachers JSONB NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL
  )
`;

await sql`
  INSERT INTO users (chat_id, username, teacher, linked_at)
  VALUES ('test-chat', 'tester', 'Тестов Т.Т.', NOW())
  ON CONFLICT (chat_id) DO UPDATE SET username = EXCLUDED.username
`;

const rows = await sql`SELECT chat_id, teacher FROM users WHERE chat_id = 'test-chat'`;
console.log('user:', rows[0]);

await sql`DELETE FROM users WHERE chat_id = 'test-chat'`;
console.log('Neon OK');

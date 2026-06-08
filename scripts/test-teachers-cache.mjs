import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
const sql = neon(url);

await sql`
  CREATE TABLE IF NOT EXISTS teachers_cache (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    teachers JSONB NOT NULL,
    cached_at TIMESTAMPTZ NOT NULL
  )
`;

const teachers = ['Туманова Т.С.', 'Иванов А.В.'];
const cachedAt = new Date().toISOString();

try {
  await sql`
    INSERT INTO teachers_cache (id, teachers, cached_at)
    VALUES (1, ${JSON.stringify(teachers)}::jsonb, ${cachedAt})
    ON CONFLICT (id) DO UPDATE SET
      teachers = EXCLUDED.teachers,
      cached_at = EXCLUDED.cached_at
  `;
  console.log('insert ok');
} catch (e) {
  console.error('insert failed:', e);
}

const rows = await sql`SELECT teachers FROM teachers_cache WHERE id = 1`;
console.log('read:', rows[0]);

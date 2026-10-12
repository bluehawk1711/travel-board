/**
 * Destructive database reset (dev only).
 *
 * Truncates every table, then re-runs migrations + seed. Use it when the
 * schema changed and you want a clean demo database.
 *
 *   pnpm --dir backend db:reset
 */
import 'dotenv/config';
import { Client } from 'pg';

const TABLES = [
  'board_items',
  'board_sections',
  'board_members',
  'board_saves',
  'boards',
  'comments',
  'follows',
  'likes',
  'messages',
  'conversation_members',
  'conversations',
  'notifications',
  'push_tokens',
  'refresh_tokens',
  'password_reset_tokens',
  'user_settings',
  'users',
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (backend/.env)');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const existing = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public'`,
  );
  const names = existing.rows.map((r) => r.table_name as string);
  const toTruncate = TABLES.filter((t) => names.includes(t));

  if (toTruncate.length > 0) {
    await client.query(
      `TRUNCATE TABLE ${toTruncate.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
  }
  console.log(`Truncated ${toTruncate.length} tables`);

  await client.query('DROP SCHEMA IF EXISTS drizzle CASCADE');
  console.log('Dropped drizzle migration journal (migrations will re-apply)');

  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

/**
 * Local database inspection helper (dev/testing only).
 *
 * Prints the tables that exist in the public schema plus how many rows each
 * holds, and whether the drizzle migrations journal has been applied. Used by
 * `pnpm --dir backend db:check` to decide if seeding is needed.
 */
import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set (backend/.env)');
  }

  const client = new Client({ connectionString });
  await client.connect();

  const tables = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );

  if (tables.rows.length === 0) {
    console.log('NO TABLES — run pnpm --dir backend db:migrate first');
  }

  for (const { table_name: name } of tables.rows) {
    const count = await client.query(`select count(*)::int as n from "${name}"`);
    console.log(`${name}=${count.rows[0].n}`);
  }

  const migrations = await client
    .query(
      `select id, hash, created_at from drizzle.__drizzle_migrations order by created_at`,
    )
    .catch(() => null);
  console.log(
    `migrations_applied=${migrations ? migrations.rows.length : 'n/a'}`,
  );

  await client.end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

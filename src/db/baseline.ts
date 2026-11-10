// One-off, per database: mark drizzle/0000_baseline.sql as already applied on a
// database that was set up with `drizzle-kit push` before migrations existed.
// It first checks that every table and column of the baseline is really there,
// and refuses otherwise. Safe to re-run: it does nothing once migrations are tracked.
//
//   npm run db:baseline         then   npm run db:migrate
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const folder = join(process.cwd(), "drizzle");

type Journal = { entries: { idx: number; when: number; tag: string }[] };
type Snapshot = { tables: Record<string, { name: string; columns: Record<string, { name: string }> }> };

async function main() {
  const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")) as Journal;
  const baseline = journal.entries.find((entry) => entry.idx === 0);
  if (!baseline) throw new Error("No baseline migration in drizzle/meta/_journal.json");
  const snapshot = JSON.parse(readFileSync(join(folder, "meta/0000_snapshot.json"), "utf8")) as Snapshot;
  const sql = readFileSync(join(folder, `${baseline.tag}.sql`), "utf8");

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`
    );
    const { rowCount } = await client.query(`SELECT 1 FROM drizzle.__drizzle_migrations LIMIT 1`);
    if (rowCount) {
      console.log("Migrations are already tracked here; nothing to do. Run npm run db:migrate.");
      return;
    }

    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    const present = new Set(rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = Object.values(snapshot.tables).flatMap((table) =>
      Object.values(table.columns)
        .map((column) => `${table.name}.${column.name}`)
        .filter((key) => !present.has(key))
    );
    if (missing.length > 0) {
      console.error("This database is behind the baseline; these columns are missing:");
      for (const key of missing) console.error(`  - ${key}`);
      console.error("Bring it up to date first (npm run db:push), then run this again.");
      process.exitCode = 1;
      return;
    }

    await client.query(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [
      createHash("sha256").update(sql).digest("hex"),
      baseline.when,
    ]);
    console.log(`Marked ${baseline.tag} as applied. Now run npm run db:migrate.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

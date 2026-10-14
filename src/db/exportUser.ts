import "dotenv/config";
import { writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { db } from "./index";

// Prints INSERT statements that copy one user's roadmaps, projects, daily tasks, finance snapshots and habits
// (with their children) to another user id, e.g. from local to production.
// Usage: npm run -s db:export -- <source user id> <target user id> [id offset] [--only=finance] [--out=file.sql]
// Primary keys are shifted by the offset (default 1000000) so they can't clash
// with rows already in the target database; sequences are bumped at the end.
// Run order matters: parents first, so foreign keys always resolve.
const TABLES: { name: string; fks: Record<string, string> }[] = [
  { name: "roadmaps", fks: {} },
  { name: "milestones", fks: { roadmap_id: "roadmaps" } },
  { name: "projects", fks: { roadmap_id: "roadmaps" } },
  { name: "releases", fks: { project_id: "projects" } },
  { name: "project_tasks", fks: { project_id: "projects", release_id: "releases" } },
  { name: "tasks", fks: { roadmap_id: "roadmaps" } },
  { name: "finance_accounts", fks: {} },
  { name: "finance_snapshots", fks: {} },
  // account_id isn't a real foreign key, but it points at finance_accounts, so it shifts too.
  { name: "finance_snapshot_items", fks: { snapshot_id: "finance_snapshots", account_id: "finance_accounts" } },
  { name: "finance_entries", fks: {} },
  { name: "finance_targets", fks: {} },
  { name: "habits", fks: { roadmap_id: "roadmaps" } },
  { name: "habit_logs", fks: { habit_id: "habits" } },
  { name: "habit_rewards", fks: { habit_id: "habits" } },
  { name: "habit_reward_claims", fks: { reward_id: "habit_rewards" } },
];

const lit = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);

async function main() {
  const rawArgs = process.argv.slice(2);
  // --only=finance exports just the finance tables, for topping up a user whose other data is already there.
  const only = rawArgs.find((a) => a.startsWith("--only="))?.slice("--only=".length);
  if (only && only !== "finance") {
    console.error('--only supports "finance" only.');
    process.exit(1);
  }
  // --out=<file> writes the SQL there, so npm's own "> lifecairn@0.1.0 db:export" banner can't end up inside it.
  const outFile = rawArgs.find((a) => a.startsWith("--out="))?.slice("--out=".length);
  const args = rawArgs.filter((a) => !a.startsWith("--only=") && !a.startsWith("--out=")).map((a) => a.replace(/^-+/, "")).filter(Boolean);
  const [source, target, offsetArg] = args;
  if (!source || !target) {
    console.error("Usage: npm run -s db:export -- <source user id> <target user id> [id offset] [--only=finance] [--out=file.sql]");
    process.exit(1);
  }
  const offset = Number(offsetArg ?? 1_000_000);

  const out: string[] = ["BEGIN;"];
  for (const { name, fks } of TABLES) {
    if (only === "finance" && !name.startsWith("finance_")) continue;
    const cols = (
      await db.execute<{ column_name: string }>(
        sql`select column_name from information_schema.columns
            where table_schema = 'public' and table_name = ${name} order by ordinal_position`
      )
    ).rows.map((r) => r.column_name);
    const select = cols.map((c) => `${JSON.stringify(c)}::text as ${JSON.stringify(c)}`).join(", ");
    const { rows } = await db.execute<Record<string, string | null>>(
      sql.raw(`select ${select} from ${name} where user_id = ${lit(source)} order by id`)
    );
    if (rows.length === 0) continue;

    out.push(`\n-- ${name}: ${rows.length} rows`);
    for (const row of rows) {
      const values = cols.map((c) => {
        const v = row[c];
        if (c === "user_id") return lit(target);
        if (c === "id" || (c in fks && v !== null)) return String(Number(v) + offset);
        return lit(v);
      });
      out.push(`INSERT INTO ${name} (${cols.join(", ")}) VALUES (${values.join(", ")});`);
    }
    out.push(`SELECT setval(pg_get_serial_sequence('${name}', 'id'), (SELECT max(id) FROM ${name}));`);
  }
  out.push("\nCOMMIT;");
  const sqlText = out.join("\n") + "\n";
  if (outFile) {
    writeFileSync(outFile, sqlText);
    console.error(`Wrote ${outFile}`);
  } else {
    process.stdout.write(sqlText);
  }
  process.exit(0);
}

main();

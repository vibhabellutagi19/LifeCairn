import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";

// One-off: hand every row that predates multi-user support (user_id = 'legacy')
// to a Clerk user. Usage: npm run db:claim -- user_xxxxxxxx
async function main() {
  // Tolerate package-manager quirks: pnpm may pass a literal "--" or glue it to the id.
  const userId = process.argv
    .slice(2)
    .map((arg) => arg.replace(/^-+/, ""))
    .find((arg) => arg.startsWith("user_"));
  if (!userId) {
    console.error("Usage: npm run db:claim -- <clerk user id, e.g. user_2abc...>");
    process.exit(1);
  }

  const { rows } = await db.execute<{ table_name: string }>(
    sql`select table_name from information_schema.columns
        where table_schema = 'public' and column_name = 'user_id'
        order by table_name`
  );

  for (const { table_name } of rows) {
    const result = await db.execute(
      sql`update ${sql.identifier(table_name)} set user_id = ${userId} where user_id = 'legacy'`
    );
    if (result.rowCount) console.log(`${table_name}: ${result.rowCount} rows`);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

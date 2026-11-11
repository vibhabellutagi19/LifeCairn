import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeEntries } from "@/db/schema";
import { requireModule } from "@/lib/moduleSettings";
import { todayISO } from "@/lib/dates";
import { csvResponse, toCSV } from "@/lib/csv";

// Every income and expense entry of the signed-in user, oldest first.
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireModule("finance");
  const rows = await db
    .select()
    .from(financeEntries)
    .where(eq(financeEntries.userId, userId))
    .orderBy(asc(financeEntries.date), asc(financeEntries.id));
  const body = toCSV(
    ["date", "type", "source", "category", "amount_eur", "tags", "notes"],
    rows.map((r) => [r.date, r.type, r.source, r.type === "expense" ? r.category : "", Number(r.amount), r.tags.join(" "), r.notes])
  );
  return csvResponse(`lifecairn-transactions-${todayISO()}.csv`, body);
}

import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeSnapshotItems, financeSnapshots } from "@/db/schema";
import { requireModule } from "@/lib/moduleSettings";
import { todayISO } from "@/lib/dates";
import { csvResponse, toCSV } from "@/lib/csv";

// Every saving in every monthly snapshot of the signed-in user, oldest first.
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requireModule("finance");
  const rows = await db
    .select({
      month: financeSnapshots.month,
      snapshotDate: financeSnapshots.snapshotDate,
      name: financeSnapshotItems.accountName,
      type: financeSnapshotItems.accountType,
      currency: financeSnapshotItems.currency,
      invested: financeSnapshotItems.investedAmount,
      current: financeSnapshotItems.currentValue,
    })
    .from(financeSnapshotItems)
    .innerJoin(financeSnapshots, eq(financeSnapshotItems.snapshotId, financeSnapshots.id))
    .where(eq(financeSnapshotItems.userId, userId))
    .orderBy(asc(financeSnapshots.month), asc(financeSnapshotItems.sortOrder));
  const body = toCSV(
    ["month", "snapshot_date", "saving", "type", "currency", "invested", "worth"],
    rows.map((r) => [r.month, r.snapshotDate, r.name, r.type, r.currency, Number(r.invested), Number(r.current)])
  );
  return csvResponse(`lifecairn-snapshots-${todayISO()}.csv`, body);
}

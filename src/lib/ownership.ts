import { and, eq } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db";

type OwnedTable = PgTable & { id: PgColumn; userId: PgColumn };

/** True when the row belongs to the user. A null/undefined id (optional link) passes. */
export async function ownsRow(
  table: OwnedTable,
  id: number | null | undefined,
  userId: string
): Promise<boolean> {
  if (id == null) return true;
  const rows = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

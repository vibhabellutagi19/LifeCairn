"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeShares } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { circleSharesModule, getMyRole } from "@/lib/circleAccess";
import { isFinanceLevel } from "@/lib/circleFinance";

// Choose how much of your own finance this circle sees, or stop sharing (null).
export async function setFinanceShare(circleId: number, level: string | null) {
  const userId = await requireUserId();
  if (!(await getMyRole(circleId, userId))) return;
  if (!(await circleSharesModule(circleId, "finance"))) return;

  if (!isFinanceLevel(level)) {
    await db
      .delete(financeShares)
      .where(and(eq(financeShares.circleId, circleId), eq(financeShares.ownerId, userId)));
  } else {
    await db
      .insert(financeShares)
      .values({ circleId, ownerId: userId, level })
      .onConflictDoUpdate({ target: [financeShares.circleId, financeShares.ownerId], set: { level } });
  }
  revalidatePath(`/circles/${circleId}`);
}

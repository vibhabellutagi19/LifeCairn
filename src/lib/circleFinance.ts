import { and, eq, gte, lte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, financeAccounts, financeEntries, financeShares } from "@/db/schema";
import { currentMonthKey, monthRangeISO } from "@/lib/dates";

export type FinanceLevel = "summary" | "accounts";

export function isFinanceLevel(value: unknown): value is FinanceLevel {
  return value === "summary" || value === "accounts";
}

export type SharedFinance = {
  ownerId: string;
  level: FinanceLevel;
  totalSavings: number;
  monthIncome: number;
  monthExpense: number;
  /** "accounts" level only. Names, types and balances; never notes. */
  accounts?: { name: string; type: string; balance: number }[];
};

/**
 * Finance each circle member has chosen to show. The caller must already have
 * checked that the viewer is a member and the circle shares finance. Only
 * people still in the circle are included.
 */
export async function getCircleFinance(circleId: number, viewerId: string): Promise<SharedFinance[]> {
  const shares = await db
    .select({ ownerId: financeShares.ownerId, level: financeShares.level })
    .from(financeShares)
    .innerJoin(
      circleMembers,
      and(eq(circleMembers.circleId, financeShares.circleId), eq(circleMembers.userId, financeShares.ownerId))
    )
    .where(eq(financeShares.circleId, circleId));
  if (shares.length === 0) return [];
  const owners = shares.map((s) => s.ownerId);
  const { start, end } = monthRangeISO(currentMonthKey());

  const [accounts, totals] = await Promise.all([
    db
      .select({
        userId: financeAccounts.userId,
        name: financeAccounts.name,
        type: financeAccounts.type,
        balance: financeAccounts.balance,
      })
      .from(financeAccounts)
      .where(inArray(financeAccounts.userId, owners))
      .orderBy(financeAccounts.id),
    db
      .select({
        userId: financeEntries.userId,
        type: financeEntries.type,
        total: sql<string>`coalesce(sum(${financeEntries.amount}), 0)`,
      })
      .from(financeEntries)
      .where(and(inArray(financeEntries.userId, owners), gte(financeEntries.date, start), lte(financeEntries.date, end)))
      .groupBy(financeEntries.userId, financeEntries.type),
  ]);

  return shares
    .map((share): SharedFinance => {
      const mine = accounts.filter((a) => a.userId === share.ownerId);
      const total = (type: "income" | "expense") =>
        Number(totals.find((t) => t.userId === share.ownerId && t.type === type)?.total ?? 0);
      const level: FinanceLevel = share.level === "accounts" ? "accounts" : "summary";
      return {
        ownerId: share.ownerId,
        level,
        // Same rule as the dashboard: the emergency fund ("cash") isn't counted as savings.
        totalSavings: mine.filter((a) => a.type !== "cash").reduce((sum, a) => sum + Number(a.balance), 0),
        monthIncome: total("income"),
        monthExpense: total("expense"),
        ...(level === "accounts"
          ? { accounts: mine.map((a) => ({ name: a.name, type: a.type, balance: Number(a.balance) })) }
          : {}),
      };
    })
    .sort((a, b) => Number(b.ownerId === viewerId) - Number(a.ownerId === viewerId));
}

export async function getMyFinanceLevel(circleId: number, userId: string): Promise<FinanceLevel | null> {
  const row = await db.query.financeShares.findFirst({
    where: and(eq(financeShares.circleId, circleId), eq(financeShares.ownerId, userId)),
  });
  return row && isFinanceLevel(row.level) ? row.level : null;
}

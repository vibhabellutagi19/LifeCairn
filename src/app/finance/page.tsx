import Link from "next/link";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeEntries,
  financeSnapshotItems,
  financeSnapshots,
} from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { saveMonthlyFinanceSnapshot } from "@/lib/actions/finance";
import { requireModule } from "@/lib/moduleSettings";
import { SavingRow } from "@/components/AccountRow";
import { FinanceEntryModal } from "@/components/FinanceEntryModal";
import { FinanceEntryRow } from "@/components/FinanceEntryRow";
import { NewSavingModal } from "@/components/NewSavingModal";
import { currentMonthKey, monthRangeISO, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import { formatEUR, formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

function formatSnapshotValue(value: number | string, currency: string) {
  if (currency === "INR") return formatINR(value);
  return formatEUR(value);
}

function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireModule("finance");
  const { month: requestedMonth } = await searchParams;
  const monthKey = currentMonthKey();
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth ?? "")
    ? requestedMonth!
    : monthKey;
  const { start, end } = monthRangeISO(selectedMonth);

  const [accounts, monthEntries, monthTotals, snapshots, allSnapshotRows] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)).orderBy(financeAccounts.id),
    db
      .select()
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, start), lte(financeEntries.date, end))
      )
      .orderBy(desc(financeEntries.date), desc(financeEntries.id)),
    db
      .select({
        type: financeEntries.type,
        total: sql<string>`coalesce(sum(${financeEntries.amount}), 0)`,
      })
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, start), lte(financeEntries.date, end))
      )
      .groupBy(financeEntries.type),
    db
      .select()
      .from(financeSnapshots)
      .where(eq(financeSnapshots.userId, userId))
      .orderBy(desc(financeSnapshots.month)),
    db
      .select({
        month: financeSnapshots.month,
        snapshotDate: financeSnapshots.snapshotDate,
        accountId: financeSnapshotItems.accountId,
        accountName: financeSnapshotItems.accountName,
        accountType: financeSnapshotItems.accountType,
        investedAmount: financeSnapshotItems.investedAmount,
        currentValue: financeSnapshotItems.currentValue,
        currency: financeSnapshotItems.currency,
        sortOrder: financeSnapshotItems.sortOrder,
      })
      .from(financeSnapshotItems)
      .innerJoin(financeSnapshots, eq(financeSnapshotItems.snapshotId, financeSnapshots.id))
      .where(eq(financeSnapshotItems.userId, userId))
      .orderBy(desc(financeSnapshots.month), financeSnapshotItems.sortOrder),
  ]);

  const portfolioSavings = accounts.filter((saving) => saving.type !== "cash");
  const totalSavings = portfolioSavings.reduce(
    (sum, saving) => sum + Number(saving.balance),
    0
  );
  const income = Number(monthTotals.find((t) => t.type === "income")?.total ?? 0);
  const expense = Number(monthTotals.find((t) => t.type === "expense")?.total ?? 0);
  const savedThisMonth = income - expense;
  const savingsRate = income > 0 ? (savedThisMonth / income) * 100 : 0;
  const incomeEntries = monthEntries.filter((entry) => entry.type === "income");
  const expenseEntries = monthEntries.filter((entry) => entry.type === "expense");
  const expenseByCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: expenseEntries
      .filter((entry) => entry.category === category)
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
  }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total);
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.month === selectedMonth);
  const selectedRows = allSnapshotRows.filter((row) => row.month === selectedMonth);
  const selectedByAccount = new Map(selectedRows.map((row) => [row.accountId, row]));
  const latestByAccount = new Map<number, (typeof allSnapshotRows)[number]>();
  for (const row of allSnapshotRows) {
    if (!latestByAccount.has(row.accountId)) latestByAccount.set(row.accountId, row);
  }

  const investmentRows = selectedRows.filter(
    (row) => row.accountType !== "cash" && row.currency === "INR"
  );
  const investedTotal = investmentRows.reduce(
    (sum, row) => sum + Number(row.investedAmount),
    0
  );
  const currentValueTotal = investmentRows.reduce(
    (sum, row) => sum + Number(row.currentValue),
    0
  );
  const snapshotGain = currentValueTotal - investedTotal;
  const emergencyFundRows = selectedRows.filter((row) => row.accountType === "cash");
  const defaultSnapshotDate =
    selectedSnapshot?.snapshotDate ??
    (selectedMonth === monthKey ? todayISO() : monthRangeISO(selectedMonth).end);
  const defaultEntryDate =
    selectedMonth === monthKey ? todayISO() : monthRangeISO(selectedMonth).end;

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="A clear monthly view of what came in, what went out, and what you saved."
        action={
          <div className="flex flex-wrap gap-2">
            <FinanceEntryModal type="income" defaultDate={defaultEntryDate} />
            <FinanceEntryModal type="expense" defaultDate={defaultEntryDate} />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Monthly dashboard</p>
          <h2 className="font-display text-2xl font-bold">{formatMonthLabel(selectedMonth)}</h2>
        </div>
        <form action="/finance" className="flex items-end gap-2">
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
              View month
            </label>
            <Input type="month" name="month" defaultValue={selectedMonth} required />
          </div>
          <Button type="submit" variant="ghost" size="sm">View</Button>
        </form>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="border-b-[8px] border-b-green">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Income</p>
          <p className="mt-2 font-display text-3xl font-bold text-green">{formatEUR(income)}</p>
          <p className="mt-2 text-xs font-semibold text-muted">Received this month</p>
        </Card>
        <Card className="border-b-[8px] border-b-pink">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Expenses</p>
          <p className="mt-2 font-display text-3xl font-bold text-pink">{formatEUR(expense)}</p>
          <p className="mt-2 text-xs font-semibold text-muted">Spent this month</p>
        </Card>
        <Card className="border-b-[8px] border-b-blue">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Saved this month</p>
          <p className={`mt-2 font-display text-3xl font-bold ${savedThisMonth >= 0 ? "text-blue" : "text-pink"}`}>
            {formatEUR(savedThisMonth)}
          </p>
          <p className="mt-2 text-xs font-semibold text-muted">
            {income > 0 ? `${Math.round(savingsRate)}% of income retained` : "Income minus expenses"}
          </p>
        </Card>
        <Card className="border-b-[8px] border-b-orange">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total savings</p>
          <p className="mt-2 font-display text-3xl font-bold">{formatINR(totalSavings)}</p>
          <p className="mt-2 text-xs font-semibold text-muted">Across all savings and investments</p>
        </Card>
        <Card className="border-b-[8px] border-b-yellow">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Emergency funds</p>
          {emergencyFundRows.length > 0 ? (
            <div className="mt-2 space-y-1">
              {emergencyFundRows.map((row) => (
                <div key={row.accountId} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold uppercase text-muted">{row.currency}</span>
                  <span className="font-display text-xl font-bold">
                    {formatSnapshotValue(row.currentValue, row.currency)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 font-display text-xl font-bold text-muted">No snapshot</p>
          )}
          <p className="mt-2 text-xs font-semibold text-muted">Reserved for unexpected costs</p>
        </Card>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Expense breakdown</h2>
            <p className="text-sm font-semibold text-muted">Where your money went this month</p>
          </div>
          <span className="rounded-md bg-pink px-3 py-1.5 text-sm font-bold text-white">
            {formatEUR(expense)}
          </span>
        </div>
        {expenseByCategory.length === 0 ? (
          <EmptyState>No expenses recorded for {formatMonthLabel(selectedMonth)}.</EmptyState>
        ) : (
          <div className="space-y-3">
            {expenseByCategory.map(({ category, total }) => (
              <div key={category}>
                <div className="mb-1 flex items-center justify-between gap-3 text-sm font-bold">
                  <span>{category}</span>
                  <span>{formatEUR(total)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-pink"
                    style={{ width: `${expense > 0 ? Math.max(4, (total / expense) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <div className="mb-4">
          <h2 className="font-display text-xl font-bold">Monthly activity</h2>
          <p className="text-sm font-semibold text-muted">Income and expenses for {formatMonthLabel(selectedMonth)}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-green">Income</h3>
              <span className="text-sm font-bold text-green">{formatEUR(income)}</span>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {incomeEntries.length === 0 ? (
                <EmptyState>No income logged for this month.</EmptyState>
              ) : (
                incomeEntries.map((entry) => (
                  <FinanceEntryRow
                    key={entry.id}
                    id={entry.id}
                    date={entry.date}
                    type={entry.type}
                    source={entry.source}
                    amount={entry.amount}
                    notes={entry.notes}
                  />
                ))
              )}
            </div>
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-pink">Expenses</h3>
              <span className="text-sm font-bold text-pink">{formatEUR(expense)}</span>
            </div>
            <div className="max-h-[420px] space-y-2 overflow-y-auto">
              {expenseEntries.length === 0 ? (
                <EmptyState>No expenses logged for this month.</EmptyState>
              ) : (
                expenseEntries.map((entry) => (
                  <FinanceEntryRow
                    key={entry.id}
                    id={entry.id}
                    date={entry.date}
                    type={entry.type}
                    source={entry.source}
                    category={entry.category}
                    amount={entry.amount}
                    notes={entry.notes}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </Card>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Savings</h2>
            <p className="text-sm font-semibold text-muted">
              Your investments, deposits, bank balances, and emergency funds.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted">
              {portfolioSavings.length} {portfolioSavings.length === 1 ? "saving" : "savings"}
            </span>
            <NewSavingModal />
          </div>
        </div>
        <div className="grid max-h-[340px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {portfolioSavings.length === 0 ? (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState>No savings added yet.</EmptyState>
            </div>
          ) : (
            portfolioSavings.map((saving) => (
              <SavingRow
                key={saving.id}
                id={saving.id}
                name={saving.name}
                type={saving.type}
                balance={saving.balance}
              />
            ))
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Monthly snapshot</h2>
            <p className="text-sm font-semibold text-muted">
              Savings values and cash flow captured together for {formatMonthLabel(selectedMonth)}.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${selectedSnapshot ? "bg-green text-white" : "bg-yellow text-ink"}`}>
            {selectedSnapshot ? `Saved ${selectedSnapshot.snapshotDate}` : "Not saved yet"}
          </span>
        </div>

        {snapshots.length > 0 ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {snapshots.map((snapshot) => (
              <Link
                key={snapshot.id}
                href={`/finance?month=${snapshot.month}`}
                className={`brut-border rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  snapshot.month === selectedMonth ? "bg-orange text-white" : "bg-surface hover:bg-yellow"
                }`}
              >
                {snapshot.month}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-md bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Invested</p>
            <p className="font-display text-lg font-bold">{formatINR(investedTotal)}</p>
          </div>
          <div className="rounded-md bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Current value</p>
            <p className="font-display text-lg font-bold">{formatINR(currentValueTotal)}</p>
          </div>
          <div className="rounded-md bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Gain / loss</p>
            <p className={`font-display text-lg font-bold ${snapshotGain >= 0 ? "text-green" : "text-pink"}`}>
              {snapshotGain >= 0 ? "+" : ""}{formatINR(snapshotGain)}
            </p>
          </div>
          <div className="rounded-md bg-green/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Income</p>
            <p className="font-display text-lg font-bold text-green">{formatEUR(income)}</p>
          </div>
          <div className="rounded-md bg-pink/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Expenses</p>
            <p className="font-display text-lg font-bold text-pink">{formatEUR(expense)}</p>
          </div>
          <div className="rounded-md bg-blue/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Saved</p>
            <p className={`font-display text-lg font-bold ${savedThisMonth >= 0 ? "text-blue" : "text-pink"}`}>
              {formatEUR(savedThisMonth)}
            </p>
          </div>
        </div>

        <details className="rounded-md bg-background p-4" open={!selectedSnapshot}>
          <summary className="cursor-pointer font-bold">
            {selectedSnapshot ? "Update savings values" : "Create this monthly snapshot"}
          </summary>
          <form action={saveMonthlyFinanceSnapshot.bind(null, selectedMonth)} className="mt-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <p className="text-sm font-semibold text-muted">
                Enter invested amounts and current values for every saving.
              </p>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
                  Snapshot date
                </label>
                <Input
                  key={`${selectedMonth}-date`}
                  type="date"
                  name="snapshotDate"
                  defaultValue={defaultSnapshotDate}
                  required
                />
              </div>
            </div>

            {accounts.length === 0 ? (
              <EmptyState>Add a saving before creating a monthly snapshot.</EmptyState>
            ) : (
              <div className="space-y-2">
                <div className="hidden grid-cols-[minmax(0,1fr)_minmax(120px,180px)_minmax(120px,180px)] gap-3 px-3 text-[11px] font-bold uppercase tracking-wide text-muted sm:grid">
                  <span>Saving</span>
                  <span>Invested</span>
                  <span>Current value</span>
                </div>
                {accounts.map((saving) => {
                  const saved = selectedByAccount.get(saving.id);
                  const latest = latestByAccount.get(saving.id);
                  const currency = saved?.currency ?? latest?.currency ?? (/\bEUR\b/i.test(saving.name) ? "EUR" : "INR");
                  const investedValue = saved?.investedAmount ?? latest?.investedAmount ?? saving.balance;
                  const currentValue = saved?.currentValue ?? latest?.currentValue ?? saving.balance;
                  return (
                    <div
                      key={saving.id}
                      className="brut-border grid grid-cols-1 gap-2 rounded-md bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,180px)_minmax(120px,180px)] sm:items-center sm:gap-3"
                    >
                      <div>
                        <p className="font-bold">{saving.name}</p>
                        <p className="text-xs font-semibold uppercase text-muted">{currency}</p>
                      </div>
                      <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted sm:hidden">Invested</span>
                        <Input
                          key={`${selectedMonth}-${saving.id}-invested`}
                          name={`invested-${saving.id}`}
                          defaultValue={investedValue}
                          inputMode="decimal"
                          required
                        />
                      </label>
                      <label>
                        <span className="mb-1 block text-[10px] font-bold uppercase text-muted sm:hidden">Current value</span>
                        <Input
                          key={`${selectedMonth}-${saving.id}-current`}
                          name={`current-${saving.id}`}
                          defaultValue={currentValue}
                          inputMode="decimal"
                          required
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
            )}

            {accounts.length > 0 ? (
              <Button type="submit" variant="green" className="mt-4 w-full">
                Save {formatMonthLabel(selectedMonth)} snapshot
              </Button>
            ) : null}
          </form>
        </details>
      </Card>
    </div>
  );
}

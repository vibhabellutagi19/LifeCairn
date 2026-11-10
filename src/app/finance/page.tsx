import Link from "next/link";
import Form from "next/form";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeEntries,
  financeSnapshotItems,
  financeSnapshots,
} from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { MonthPulse, NetWorth, TrendBars, type MonthTrend, type NetWorthPoint } from "@/components/FinanceDashboard";
import { QuickExpense } from "@/components/QuickExpense";
import { saveMonthlyFinanceSnapshot } from "@/lib/actions/finance";
import { requireModule } from "@/lib/moduleSettings";
import { SavingAccountControls } from "@/components/AccountRow";
import { BulkExpenseModal } from "@/components/BulkExpenseModal";
import {
  ExpenseBreakdown,
  SpendingByTag,
  type TaggedExpense,
  type TagSummary,
} from "@/components/ExpenseInsights";
import { FinanceEntryModal } from "@/components/FinanceEntryModal";
import { FinanceEntryRow } from "@/components/FinanceEntryRow";
import { NewSavingModal } from "@/components/NewSavingModal";
import { currentMonthKey, daysInMonthISO, monthRangeISO, shiftMonthKey, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import {
  CURRENCIES,
  formatCurrencyTotals,
  type Currency,
  formatDateLong,
  formatEUR,
  formatMoney,
  sumByCurrency,
  type CurrencyTotals,
} from "@/lib/format";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const SEARCH_LIMIT = 200;

// Gain/loss per currency with an explicit sign, e.g. "+₹4,200 · -€150".
function formatSignedTotals(totals: CurrencyTotals) {
  const parts = CURRENCIES.filter((c) => totals[c] !== 0).map(
    (c) => `${totals[c] > 0 ? "+" : ""}${formatMoney(totals[c], c)}`
  );
  return parts.length > 0 ? parts.join(" · ") : formatMoney(0, "INR");
}

function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

// Groups rows (already sorted newest first) by a key, keeping that order.
function groupBy<T>(rows: T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    groups.set(k, [...(groups.get(k) ?? []), row]);
  }
  return [...groups.entries()];
}

function sumAmounts(rows: { amount: string }[]) {
  return rows.reduce((sum, row) => sum + Number(row.amount), 0);
}

function financeHref(month: string) {
  return `/finance?${new URLSearchParams({ month }).toString()}`;
}

function SectionTitle({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div id={id} className="mb-4 flex scroll-mt-6 flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
        <h2 className="font-display text-2xl font-bold">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string }>;
}) {
  const userId = await requireModule("finance");
  const { month: requestedMonth, q: rawQuery } = await searchParams;
  const monthKey = currentMonthKey();
  const selectedMonth = MONTH_RE.test(requestedMonth ?? "") ? requestedMonth! : monthKey;
  const { start, end } = monthRangeISO(selectedMonth);
  const query = (rawQuery ?? "").trim().slice(0, 100);
  // Escape LIKE wildcards so a search for "50%" matches literally.
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const trendStart = monthRangeISO(shiftMonthKey(selectedMonth, -5)).start;
  const trendMonthExpr = sql<string>`to_char(${financeEntries.date}, 'YYYY-MM')`;

  const [accounts, monthEntries, snapshots, allSnapshotRows, searchResults, trendRows] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)).orderBy(financeAccounts.id),
    db
      .select()
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, start), lte(financeEntries.date, end))
      )
      .orderBy(desc(financeEntries.date), desc(financeEntries.id)),
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
    // Expense search spans every month, not just the one being viewed.
    query
      ? db
          .select()
          .from(financeEntries)
          .where(
            and(
              eq(financeEntries.userId, userId),
              eq(financeEntries.type, "expense"),
              or(
                ilike(financeEntries.source, pattern),
                ilike(financeEntries.notes, pattern),
                ilike(financeEntries.category, pattern),
                sql`array_to_string(${financeEntries.tags}, ' ') ilike ${pattern}`
              )
            )
          )
          .orderBy(desc(financeEntries.date), desc(financeEntries.id))
          .limit(SEARCH_LIMIT)
      : Promise.resolve(null),
    db
      .select({
        month: trendMonthExpr,
        type: financeEntries.type,
        total: sql<string>`coalesce(sum(${financeEntries.amount}), 0)`,
      })
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, trendStart), lte(financeEntries.date, end))
      )
      .groupBy(trendMonthExpr, financeEntries.type),
  ]);

  const incomeEntries = monthEntries.filter((entry) => entry.type === "income");
  const expenseEntries = monthEntries.filter((entry) => entry.type === "expense");
  const income = sumAmounts(incomeEntries);
  const expense = sumAmounts(expenseEntries);

  // Month pulse: spending per day, up to today for the current month.
  const isCurrentMonth = selectedMonth === monthKey;
  const monthDays = daysInMonthISO(selectedMonth);
  const daily = monthDays.map((day) =>
    sumAmounts(expenseEntries.filter((entry) => entry.date === day))
  );
  const uptoDay = isCurrentMonth ? Number(todayISO().slice(8, 10)) : monthDays.length;

  // Six-month trend ending at the selected month.
  const trendMonths: MonthTrend[] = [-5, -4, -3, -2, -1, 0].map((offset) => {
    const month = shiftMonthKey(selectedMonth, offset);
    const total = (type: "income" | "expense") =>
      Number(trendRows.find((r) => r.month === month && r.type === type)?.total ?? 0);
    return { month, label: formatMonthLabel(month), income: total("income"), expense: total("expense") };
  });

  const expenseByCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: expenseEntries
      .filter((entry) => entry.category === category)
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
  }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total);

  // Tags for the selected month, built from that month's expenses (newest first).
  const expensesByTag = new Map<string, TaggedExpense[]>();
  for (const entry of expenseEntries) {
    for (const tag of entry.tags) {
      const list = expensesByTag.get(tag) ?? [];
      list.push({
        id: entry.id,
        date: entry.date,
        source: entry.source,
        category: entry.category,
        amount: Number(entry.amount),
        notes: entry.notes,
      });
      expensesByTag.set(tag, list);
    }
  }
  const tagSummaries: TagSummary[] = [...expensesByTag.entries()]
    .map(([tag, expenses]) => {
      const byCategory = new Map<string, number>();
      for (const e of expenses) byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + e.amount);
      const items = [...byCategory.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total);
      return { tag, items, expenses, total: items.reduce((sum, item) => sum + item.total, 0) };
    })
    .sort((a, b) => b.total - a.total);

  const selectedSnapshot = snapshots.find((snapshot) => snapshot.month === selectedMonth);
  const selectedRows = allSnapshotRows.filter((row) => row.month === selectedMonth);
  const selectedByAccount = new Map(selectedRows.map((row) => [row.accountId, row]));
  const latestByAccount = new Map<number, (typeof allSnapshotRows)[number]>();
  for (const row of allSnapshotRows) {
    if (!latestByAccount.has(row.accountId)) latestByAccount.set(row.accountId, row);
  }

  const investmentRows = selectedRows.filter((row) => row.accountType !== "cash");
  const investedTotal = sumByCurrency(investmentRows, (r) => r.investedAmount, (r) => r.currency);
  const currentValueTotal = sumByCurrency(investmentRows, (r) => r.currentValue, (r) => r.currency);
  const snapshotGain: CurrencyTotals = {
    INR: currentValueTotal.INR - investedTotal.INR,
    EUR: currentValueTotal.EUR - investedTotal.EUR,
  };
  const gainPositive = snapshotGain.INR >= 0 && snapshotGain.EUR >= 0;

  // Net worth history: every saving's value per snapshot, per currency, oldest first.
  const netWorthHistory = Object.fromEntries(
    CURRENCIES.map((currency) => [
      currency,
      [...snapshots]
        .reverse()
        .map((snapshot): NetWorthPoint => ({
          month: snapshot.month,
          value: allSnapshotRows
            .filter((row) => row.month === snapshot.month && row.currency === currency)
            .reduce((sum, row) => sum + Number(row.currentValue), 0),
        }))
        .filter((point) => point.value > 0)
        .slice(-12),
    ])
  ) as Record<Currency, NetWorthPoint[]>;
  const defaultSnapshotDate =
    selectedSnapshot?.snapshotDate ??
    (selectedMonth === monthKey ? todayISO() : monthRangeISO(selectedMonth).end);
  const defaultEntryDate = selectedMonth === monthKey ? todayISO() : monthRangeISO(selectedMonth).end;

  const prevMonth = shiftMonthKey(selectedMonth, -1);
  const nextMonth = shiftMonthKey(selectedMonth, 1);
  const monthLabel = formatMonthLabel(selectedMonth);
  const expensesByDay = groupBy(expenseEntries, (entry) => entry.date);
  const resultsByMonth = searchResults ? groupBy(searchResults, (entry) => entry.date.slice(0, 7)) : [];
  const searchTotal = searchResults ? sumAmounts(searchResults) : 0;

  const arrowLink =
    "brut-border brut-shadow-sm flex h-11 w-11 items-center justify-center rounded-md bg-surface text-xl font-bold hover:bg-yellow";
  const navLink =
    "brut-border rounded-full bg-surface px-3 py-1 text-xs font-bold uppercase tracking-wide hover:bg-yellow";

  return (
    <div>
      <PageHeader
        title="Finance"
        subtitle="What came in, what went out, and what you kept."
        action={
          <div className="flex flex-wrap gap-2">
            <FinanceEntryModal type="income" defaultDate={defaultEntryDate} />
            <FinanceEntryModal type="expense" defaultDate={defaultEntryDate} />
            <BulkExpenseModal defaultDate={defaultEntryDate} />
          </div>
        }
      />

      {/* Month switcher */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={financeHref(prevMonth)} aria-label={`Previous month, ${formatMonthLabel(prevMonth)}`} className={arrowLink}>
            ‹
          </Link>
          <div className="min-w-[11rem] text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">
              {selectedMonth === monthKey ? "This month" : "Viewing"}
            </p>
            <p className="font-display text-2xl font-bold leading-tight">{monthLabel}</p>
          </div>
          <Link href={financeHref(nextMonth)} aria-label={`Next month, ${formatMonthLabel(nextMonth)}`} className={arrowLink}>
            ›
          </Link>
          {selectedMonth !== monthKey ? (
            <Link href="/finance" className="ml-1 text-xs font-bold uppercase tracking-wide text-blue hover:underline">
              This month
            </Link>
          ) : null}
        </div>
        <Form action="/finance" className="flex items-center gap-2">
          <Input
            type="month"
            name="month"
            aria-label="Jump to month"
            defaultValue={selectedMonth}
            required
            className="w-auto"
          />
          <Button type="submit" variant="ghost" size="sm">Go</Button>
        </Form>
      </div>

      <MonthPulse
        monthLabel={monthLabel}
        daily={daily}
        uptoDay={uptoDay}
        isCurrent={isCurrentMonth}
        income={income}
        expense={expense}
        quickLog={<QuickExpense defaultDate={defaultEntryDate} />}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrendBars months={trendMonths} selectedMonth={selectedMonth} />
        <NetWorth
          accounts={accounts.map((a) => ({
            name: a.name,
            type: a.type,
            balance: Number(a.balance),
            currency: a.currency,
          }))}
          history={netWorthHistory}
        />
      </div>

      {/* Section links */}
      <nav aria-label="Finance sections" className="mb-8 flex flex-wrap gap-2">
        <a href="#overview" className={navLink}>Overview</a>
        <a href="#transactions" className={navLink}>Transactions</a>
        <a href="#savings" className={navLink}>Savings</a>
      </nav>

      <SectionTitle id="overview" eyebrow="Where it went" title="Overview" />
      <ExpenseBreakdown monthLabel={monthLabel} total={expense} items={expenseByCategory} />
      <SpendingByTag tags={tagSummaries} monthLabel={monthLabel} monthTotal={expense} />

      <SectionTitle id="transactions" eyebrow="Every entry" title="Transactions" />
      <Card className="mb-8">
        <Form action="/finance" scroll={false} className="mb-5 flex flex-wrap items-center gap-2">
          <input type="hidden" name="month" value={selectedMonth} />
          <div className="relative min-w-0 flex-1 basis-60">
            <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">
              ⌕
            </span>
            <Input
              type="search"
              name="q"
              aria-label="Search expenses"
              defaultValue={query}
              placeholder="Search all expenses: name, note, category or tag"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="primary">Search</Button>
          {query ? (
            <Link
              href={financeHref(selectedMonth)}
              scroll={false}
              className="px-2 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </Form>

        {searchResults ? (
          <section aria-live="polite">
            <div className="brut-border mb-4 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-yellow/40 px-4 py-3">
              <p className="text-sm font-bold">
                {searchResults.length === 0
                  ? `No expenses match “${query}”`
                  : `${searchResults.length}${searchResults.length === SEARCH_LIMIT ? "+" : ""} ${
                      searchResults.length === 1 ? "expense matches" : "expenses match"
                    } “${query}” across all months`}
              </p>
              {searchResults.length > 0 ? (
                <p className="font-display text-xl font-bold text-pink">{formatEUR(searchTotal)}</p>
              ) : null}
            </div>
            <div className="space-y-5">
              {resultsByMonth.map(([month, rows]) => (
                <div key={month}>
                  <div className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1">
                    <Link href={financeHref(month)} className="font-display text-lg font-bold hover:text-blue hover:underline">
                      {formatMonthLabel(month)}
                    </Link>
                    <span className="text-sm font-bold text-pink">{formatEUR(sumAmounts(rows))}</span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((entry) => (
                      <FinanceEntryRow
                        key={entry.id}
                        id={entry.id}
                        date={entry.date}
                        type={entry.type}
                        source={entry.source}
                        category={entry.category}
                        tags={entry.tags}
                        amount={entry.amount}
                        notes={entry.notes}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-pink">Expenses</h3>
                <span className="text-sm font-bold text-pink">{formatEUR(expense)}</span>
              </div>
              {expenseEntries.length === 0 ? (
                <EmptyState>No expenses logged for {monthLabel}.</EmptyState>
              ) : (
                <div className="max-h-[640px] space-y-4 overflow-y-auto pr-1">
                  {expensesByDay.map(([day, rows]) => (
                    <div key={day}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1 text-xs font-bold uppercase tracking-wide text-muted">
                        <span>{formatDateLong(day)}</span>
                        <span>{formatEUR(sumAmounts(rows))}</span>
                      </div>
                      <div className="space-y-2">
                        {rows.map((entry) => (
                          <FinanceEntryRow
                            key={entry.id}
                            id={entry.id}
                            date={entry.date}
                            type={entry.type}
                            source={entry.source}
                            category={entry.category}
                            tags={entry.tags}
                            amount={entry.amount}
                            notes={entry.notes}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-display text-lg font-bold text-green">Income</h3>
                <span className="text-sm font-bold text-green">{formatEUR(income)}</span>
              </div>
              {incomeEntries.length === 0 ? (
                <EmptyState>No income logged for {monthLabel}.</EmptyState>
              ) : (
                <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                  {incomeEntries.map((entry) => (
                    <FinanceEntryRow
                      key={entry.id}
                      id={entry.id}
                      date={entry.date}
                      type={entry.type}
                      source={entry.source}
                      amount={entry.amount}
                      notes={entry.notes}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Card>

      <SectionTitle id="savings" eyebrow="Monthly snapshot" title="Savings">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`brut-border rounded-full px-3 py-1 text-xs font-bold uppercase ${
              selectedSnapshot ? "bg-green text-white" : "bg-yellow text-ink"
            }`}
          >
            {selectedSnapshot ? `Saved ${selectedSnapshot.snapshotDate}` : "Not saved yet"}
          </span>
          <NewSavingModal />
        </div>
      </SectionTitle>
      <Card>
        {snapshots.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            {snapshots.map((snapshot) => (
              <Link
                key={snapshot.id}
                href={`${financeHref(snapshot.month)}#savings`}
                className={`brut-border rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                  snapshot.month === selectedMonth ? "bg-orange text-white" : "bg-surface hover:bg-yellow"
                }`}
              >
                {snapshot.month}
              </Link>
            ))}
          </div>
        ) : null}

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="brut-border rounded-md bg-background p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Invested</p>
            <p className="font-display text-xl font-bold">{formatCurrencyTotals(investedTotal)}</p>
          </div>
          <div className="brut-border rounded-md bg-background p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Current value</p>
            <p className="font-display text-xl font-bold">{formatCurrencyTotals(currentValueTotal)}</p>
          </div>
          <div className={`brut-border rounded-md p-4 ${gainPositive ? "bg-green/10" : "bg-pink/10"}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Gain / loss</p>
            <p className={`font-display text-xl font-bold ${gainPositive ? "text-green" : "text-pink"}`}>
              {formatSignedTotals(snapshotGain)}
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
              <EmptyState>Add a saving with the button above before creating a monthly snapshot.</EmptyState>
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
                  const investedValue = saved?.investedAmount ?? latest?.investedAmount ?? saving.balance;
                  const currentValue = saved?.currentValue ?? latest?.currentValue ?? saving.balance;
                  return (
                    <div
                      key={saving.id}
                      className="brut-border grid grid-cols-1 gap-2 rounded-md bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,180px)_minmax(120px,180px)] sm:items-center sm:gap-3"
                    >
                      <div className="min-w-0">
                        <SavingAccountControls
                          id={saving.id}
                          name={saving.name}
                          type={saving.type}
                          balance={saving.balance}
                          currency={saving.currency}
                        />
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
                Save {monthLabel} snapshot
              </Button>
            ) : null}
          </form>
        </details>
      </Card>
    </div>
  );
}

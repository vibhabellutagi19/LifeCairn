import Link from "next/link";
import Form from "next/form";
import { and, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeBudgets,
  financeEntries,
  financeRecurring,
  financeSnapshots,
  financeTargets,
  userSettings,
} from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { CardHeader, SectionHeader } from "@/components/FinanceHeadings";
import { MonthReceipt, SpendCalendar, SpendingPace, TrendBars, YearSummary, type MonthTrend } from "@/components/FinanceDashboard";
import { OneLineLog } from "@/components/OneLineLog";
import { FinanceThumbBar } from "@/components/FinanceThumbBar";
import { RecurringEntries, type RecurringItem } from "@/components/RecurringEntries";
import { PrivacyScope, PrivacyToggle } from "@/components/PrivacyBlur";
import { FinanceMonthBar } from "@/components/FinanceMonthBar";
import { requireModule } from "@/lib/moduleSettings";
import { BulkExpenseModal } from "@/components/BulkExpenseModal";
import { ExpenseBreakdown } from "@/components/ExpenseInsights";
import { FinanceEntryModal } from "@/components/FinanceEntryModal";
import { FinanceEntryRow } from "@/components/FinanceEntryRow";
import { currentMonthKey, daysInMonthISO, monthRangeISO, shiftMonthKey, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES, categoryColor, isExpenseCategory, type Merchant } from "@/lib/financeCategories";
import { CURRENCIES, formatDateLong, formatDateShort, formatEUR, formatMoney, sumByCurrency } from "@/lib/format";
import { financeHref, formatMonthLabel, resolveMonth } from "@/lib/financeView";
import { depositTermsOf, summarizeDeposit } from "@/lib/deposits";

export const dynamic = "force-dynamic";

const SEARCH_LIMIT = 200;

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

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; tag?: string; cat?: string; day?: string }>;
}) {
  const userId = await requireModule("finance");
  const { month: requestedMonth, q: rawQuery, tag: rawTag, cat: rawCat, day: rawDay } = await searchParams;
  const monthKey = currentMonthKey();
  const selectedMonth = resolveMonth(requestedMonth);
  const { start, end } = monthRangeISO(selectedMonth);
  const query = (rawQuery ?? "").trim().slice(0, 100);
  // Escape LIKE wildcards so a search for "50%" matches literally.
  const pattern = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  // Trend (six months) and year summary share one grouped query.
  const year = selectedMonth.slice(0, 4);
  const sixBack = shiftMonthKey(selectedMonth, -5);
  const trendStart = monthRangeISO(sixBack < `${year}-01` ? sixBack : `${year}-01`).start;
  const trendEnd = monthRangeISO(`${year}-12`).end > end ? monthRangeISO(`${year}-12`).end : end;
  const trendMonthExpr = sql<string>`to_char(${financeEntries.date}, 'YYYY-MM')`;
  const yearAgo = monthRangeISO(shiftMonthKey(monthKey, -12)).start;

  const [
    accounts,
    monthEntries,
    latestSnapshot,
    searchResults,
    trendRows,
    budgetRows,
    recurringRows,
    targetRow,
    settings,
    recentExpenses,
  ] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)).orderBy(financeAccounts.id),
    db
      .select()
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, start), lte(financeEntries.date, end))
      )
      .orderBy(desc(financeEntries.date), desc(financeEntries.id)),
    db.query.financeSnapshots.findFirst({
      where: eq(financeSnapshots.userId, userId),
      orderBy: desc(financeSnapshots.month),
    }),
    // Expense search spans every month, not just the one being viewed.
    query
      ? db
          .select()
          .from(financeEntries)
          .where(
            and(
              eq(financeEntries.userId, userId),
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
        and(eq(financeEntries.userId, userId), gte(financeEntries.date, trendStart), lte(financeEntries.date, trendEnd))
      )
      .groupBy(trendMonthExpr, financeEntries.type),
    db.select().from(financeBudgets).where(eq(financeBudgets.userId, userId)),
    db
      .select()
      .from(financeRecurring)
      .where(eq(financeRecurring.userId, userId))
      .orderBy(financeRecurring.dayOfMonth, financeRecurring.id),
    db.query.financeTargets.findFirst({
      where: and(eq(financeTargets.userId, userId), eq(financeTargets.month, selectedMonth)),
    }),
    db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) }),
    // Merchants from the last year, for suggestions and category guesses in Quick log.
    db
      .select({ source: financeEntries.source, category: financeEntries.category })
      .from(financeEntries)
      .where(
        and(eq(financeEntries.userId, userId), eq(financeEntries.type, "expense"), gte(financeEntries.date, yearAgo))
      )
      .orderBy(desc(financeEntries.date), desc(financeEntries.id))
      .limit(2000),
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
  const monthTrend = (month: string): MonthTrend => {
    const total = (type: "income" | "expense") =>
      Number(trendRows.find((r) => r.month === month && r.type === type)?.total ?? 0);
    return { month, label: formatMonthLabel(month), income: total("income"), expense: total("expense") };
  };
  const trendMonths = [-5, -4, -3, -2, -1, 0].map((offset) => monthTrend(shiftMonthKey(selectedMonth, offset)));
  const yearMonths = Array.from({ length: 12 }, (_, i) => monthTrend(`${year}-${String(i + 1).padStart(2, "0")}`));

  const budgets = Object.fromEntries(budgetRows.map((b) => [b.category, Number(b.amount)]));
  const incomeTarget = targetRow ? Number(targetRow.targetAmount) : null;
  const eurToInr = settings?.eurToInr ? Number(settings.eurToInr) : null;
  const addedRecurring = new Set(monthEntries.map((entry) => entry.recurringId).filter((id) => id !== null));
  const recurringItems: RecurringItem[] = recurringRows.map((item) => ({
    id: item.id,
    type: item.type,
    source: item.source,
    category: item.category,
    amount: Number(item.amount),
    dayOfMonth: item.dayOfMonth,
    added: addedRecurring.has(item.id),
  }));

  // Most-used merchants first, each with the category used most recently.
  const merchantStats = new Map<string, Merchant & { count: number }>();
  for (const row of recentExpenses) {
    const key = row.source.trim().toLowerCase();
    const known = merchantStats.get(key);
    if (known) known.count++;
    else merchantStats.set(key, { source: row.source.trim(), category: row.category, count: 1 });
  }
  const merchants: Merchant[] = [...merchantStats.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 150)
    .map(({ source, category }) => ({ source, category }));

  const expenseByCategory = EXPENSE_CATEGORIES.map((category) => ({
    category,
    total: expenseEntries
      .filter((entry) => entry.category === category)
      .reduce((sum, entry) => sum + Number(entry.amount), 0),
  }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total);

  // Tags used in the selected month, biggest first: the Transactions filter chips.
  const tagTotals = new Map<string, { total: number; count: number }>();
  for (const entry of expenseEntries) {
    for (const tag of entry.tags) {
      const t = tagTotals.get(tag) ?? { total: 0, count: 0 };
      tagTotals.set(tag, { total: t.total + Number(entry.amount), count: t.count + 1 });
    }
  }
  const monthTags = [...tagTotals.entries()]
    .map(([tag, t]) => ({ tag, ...t }))
    .sort((a, b) => b.total - a.total);
  // ?tag= and ?cat= filter the month's expenses (ignored while searching).
  const activeTag = !query && rawTag && tagTotals.has(rawTag) ? rawTag : null;
  const activeCategory = !query && rawCat && isExpenseCategory(rawCat) ? rawCat : null;
  const activeDay = !query && rawDay && rawDay.startsWith(`${selectedMonth}-`) && /^\d{4}-\d{2}-\d{2}$/.test(rawDay) ? rawDay : null;
  const filtering = activeTag !== null || activeCategory !== null || activeDay !== null;
  const shownExpenses = expenseEntries.filter(
    (entry) =>
      (!activeTag || entry.tags.includes(activeTag)) &&
      (!activeCategory || entry.category === activeCategory) &&
      (!activeDay || entry.date === activeDay)
  );
  const shownTotal = sumAmounts(shownExpenses);
  const activeTagCategories = activeTag
    ? EXPENSE_CATEGORIES.map((category) => ({
        category,
        total: sumAmounts(shownExpenses.filter((entry) => entry.category === category)),
      }))
        .filter(({ total }) => total > 0)
        .sort((a, b) => b.total - a.total)
    : [];
  const filterHref = ({
    tag = activeTag,
    cat = activeCategory,
    day = activeDay,
  }: {
    tag?: string | null;
    cat?: string | null;
    day?: string | null;
  }) => {
    const params = new URLSearchParams({ month: selectedMonth });
    if (tag) params.set("tag", tag);
    if (cat) params.set("cat", cat);
    if (day) params.set("day", day);
    return `/finance?${params}#transactions`;
  };
  const dayHref = (day: string | null) => filterHref({ day });
  const tagHref = (tag: string | null) => filterHref({ tag });
  const categoryHref = (cat: string | null) => filterHref({ cat });

  // Wealth teaser: everything saved (emergency funds included), per currency.
  const netWorth = sumByCurrency(accounts, (a) => a.balance, (a) => a.currency);
  const netWorthCurrencies = CURRENCIES.filter((c) => netWorth[c] !== 0);
  // The next deposit to mature (a matured one still waiting to be renewed counts first).
  const nextMaturity = accounts
    .flatMap((a) => {
      const terms = depositTermsOf(a);
      return terms ? [{ name: a.name, currency: a.currency, terms, summary: summarizeDeposit(terms, todayISO()) }] : [];
    })
    .sort((a, b) => a.terms.maturity.localeCompare(b.terms.maturity))[0];
  const defaultEntryDate = selectedMonth === monthKey ? todayISO() : monthRangeISO(selectedMonth).end;

  const monthLabel = formatMonthLabel(selectedMonth);
  const expensesByDay = groupBy(shownExpenses, (entry) => entry.date);
  const resultsByMonth = searchResults ? groupBy(searchResults, (entry) => entry.date.slice(0, 7)) : [];
  const searchExpenses = searchResults?.filter((entry) => entry.type === "expense") ?? [];
  const searchIncome = searchResults?.filter((entry) => entry.type === "income") ?? [];
  const latestEntries = monthEntries.slice(0, 4);

  // Receipt and calendar extras.
  const regularsDue = recurringItems.filter((i) => !i.added && i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const biggestIndex = daily.reduce((best, v, i) => (v > daily[best] ? i : best), 0);
  const biggestDayISO = monthDays[biggestIndex];
  const biggestDayEntries = expenseEntries
    .filter((entry) => entry.date === biggestDayISO)
    .sort((a, b) => Number(b.amount) - Number(a.amount));
  const biggestDay =
    daily[biggestIndex] > 0 && biggestDayEntries[0]
      ? {
          day: biggestDayISO,
          amount: daily[biggestIndex],
          what: biggestDayEntries.length > 1 ? `${biggestDayEntries[0].source} +${biggestDayEntries.length - 1}` : biggestDayEntries[0].source,
        }
      : null;

  const sectionLink = "rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow";
  const wealthHref = financeHref(selectedMonth, "/finance/wealth");

  return (
    <div className="pb-24 md:pb-0">
      <FinanceThumbBar defaultDate={defaultEntryDate} />
      <PageHeader
        title="Finance"
        subtitle="What came in, what went out, and what you've built up."
        action={
          // Expenses are logged in Quick log below; these are the other ways in.
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&>button]:w-full sm:[&>button]:w-auto">
            <FinanceEntryModal type="income" defaultDate={defaultEntryDate} />
            <BulkExpenseModal defaultDate={defaultEntryDate} />
            <Link
              href={`/finance/reports?${new URLSearchParams({ p: "month", at: selectedMonth })}`}
              className="brut-border brut-shadow-sm col-span-2 flex min-h-11 items-center justify-center rounded-md bg-yellow px-4 font-display text-sm font-bold sm:col-span-1"
            >
              {selectedMonth === monthKey ? "Reports" : `${monthLabel} report`} →
            </Link>
          </div>
        }
      />

      <FinanceMonthBar
        month={selectedMonth}
        path="/finance"
        mobileAction={
          <Link
            href={wealthHref}
            className="brut-border brut-shadow-sm rounded-md bg-orange px-3 py-2 text-xs font-bold uppercase tracking-wide text-white"
          >
            Wealth →
          </Link>
        }
      >
        <a href="#cash-flow" className={sectionLink}><span className="text-blue">01</span> Cash flow</a>
        <a href="#spending" className={sectionLink}><span className="text-pink">02</span> Spending</a>
        <Link
          href={wealthHref}
          className="brut-border brut-shadow-sm ml-1 rounded-md bg-orange px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-white hover:opacity-90"
        >
          See wealth →
        </Link>
      </FinanceMonthBar>

      {/* 01 · Cash flow */}
      <section className="mb-12">
        <SectionHeader
          id="cash-flow"
          index={1}
          color="blue"
          title="Cash flow"
          description={`Is ${monthLabel} on track, and how it compares with recent months.`}
        />
        <div className="space-y-4">
          {/* Phones: receipt, log, calendar, regulars. Wide screens: receipt and regulars on the left. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start">
            <div className="lg:col-start-1 lg:row-start-1">
              <MonthReceipt
                month={selectedMonth}
                monthLabel={monthLabel}
                daily={daily}
                uptoDay={uptoDay}
                isCurrent={isCurrentMonth}
                income={income}
                expense={expense}
                regularsDue={regularsDue}
                incomeTarget={incomeTarget}
              />
            </div>
            <Card className="bg-yellow/40 lg:col-start-2 lg:row-start-1">
              <OneLineLog today={defaultEntryDate} merchants={merchants} />
            {latestEntries.length > 0 ? (
              <div className="mt-3 border-t-2 border-ink/15 pt-3">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Latest in {monthLabel}</p>
                  <a href="#transactions" className="text-[11px] font-bold uppercase tracking-wide text-blue hover:underline">
                    All {monthEntries.length} ↓
                  </a>
                </div>
                <ul className="space-y-1">
                  {latestEntries.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-2 text-sm">
                      <span className="w-12 shrink-0 text-xs font-bold text-muted">{formatDateShort(entry.date)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{entry.source}</span>
                      <span className={`shrink-0 font-bold ${entry.type === "income" ? "text-green" : "text-pink"}`}>
                        {entry.type === "income" ? "+" : "−"}
                        {formatEUR(entry.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            </Card>
            <div className="lg:col-start-2 lg:row-span-2 lg:row-start-2">
              <SpendCalendar
                month={selectedMonth}
                daily={daily}
                uptoDay={uptoDay}
                activeDay={activeDay}
                hrefFor={dayHref}
                biggestDay={biggestDay}
              />
            </div>
            <Card className="lg:col-start-1 lg:row-start-2">
              <RecurringEntries month={selectedMonth} monthLabel={monthLabel} items={recurringItems} />
            </Card>
          </div>
          <SpendingPace monthLabel={monthLabel} daily={daily} uptoDay={uptoDay} isCurrent={isCurrentMonth} income={income} />
          <TrendBars months={trendMonths} selectedMonth={selectedMonth} />
          <YearSummary year={year} months={yearMonths} selectedMonth={selectedMonth} />
        </div>
      </section>

      {/* 02 · Spending */}
      <section className="mb-12">
        <SectionHeader
          id="spending"
          index={2}
          color="pink"
          title="Spending"
          description={`Where the money went in ${monthLabel}, and every entry.`}
        />
        <div className="space-y-4">
          <ExpenseBreakdown
            monthLabel={monthLabel}
            total={expense}
            items={expenseByCategory}
            budgets={budgets}
            activeCategory={activeCategory}
            hrefFor={categoryHref}
          />
          <div id="transactions" className="scroll-mt-48 md:scroll-mt-24">
          <Card>
            <CardHeader
              title="Transactions"
              description={
                query
                  ? "Search results from every month."
                  : filtering
                    ? `Expenses ${activeDay ? `on ${formatDateLong(activeDay)}` : `in ${monthLabel}`}${activeCategory ? ` under ${activeCategory}` : ""}${activeTag ? ` tagged #${activeTag}` : ""}.`
                    : `Income and expenses logged in ${monthLabel}.`
              }
              action={
                <a
                  href="/finance/export/transactions"
                  className="text-[11px] font-bold uppercase tracking-wide text-blue hover:underline"
                >
                  Download CSV
                </a>
              }
            />
            <Form action="/finance" scroll={false} className="mb-5 flex flex-wrap items-center gap-2">
              <input type="hidden" name="month" value={selectedMonth} />
              <div className="relative min-w-0 flex-1 basis-60">
                <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">
                  ⌕
                </span>
                <Input
                  type="search"
                  name="q"
                  aria-label="Search all entries"
                  defaultValue={query}
                  placeholder="Search everything: name, note, category or tag"
                  className="pl-8"
                />
              </div>
              <Button type="submit" variant="primary">Search</Button>
              {query ? (
                <Link
                  href={`${financeHref(selectedMonth)}#spending`}
                  scroll={false}
                  className="px-2 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
                >
                  Clear
                </Link>
              ) : null}
            </Form>

            {activeDay ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Day</span>
                <Link
                  href={dayHref(null)}
                  scroll={false}
                  className="brut-border flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1.5 text-xs font-bold"
                  aria-label="Show every day again"
                >
                  {formatDateShort(activeDay)} <span aria-hidden>✕</span>
                </Link>
              </div>
            ) : null}

            {activeCategory ? (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-muted">Category</span>
                <Link
                  href={categoryHref(null)}
                  scroll={false}
                  className="brut-border flex items-center gap-1.5 rounded-full bg-yellow px-3 py-1.5 text-xs font-bold"
                  aria-label={`Remove the ${activeCategory} filter`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: categoryColor(activeCategory) }} />
                  {activeCategory} <span aria-hidden>✕</span>
                </Link>
              </div>
            ) : null}

            {!query && monthTags.length > 0 ? (
              <nav aria-label="Filter by tag" className="mb-5">
                {/* One scrolling row on phones, wrapping on wider screens. */}
                <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
                  <Link
                    href={tagHref(null)}
                    scroll={false}
                    aria-current={activeTag ? undefined : "true"}
                    className={`brut-border shrink-0 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                      activeTag ? "bg-surface hover:bg-yellow" : "bg-ink text-surface"
                    }`}
                  >
                    All
                  </Link>
                  {monthTags.map(({ tag, total }) => (
                    <Link
                      key={tag}
                      href={tagHref(activeTag === tag ? null : tag)}
                      scroll={false}
                      aria-current={activeTag === tag ? "true" : undefined}
                      className={`brut-border flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        activeTag === tag ? "bg-blue text-white" : "bg-surface hover:bg-yellow"
                      }`}
                    >
                      #{tag}
                      <span className={activeTag === tag ? "text-white/80" : "text-muted"}>{formatEUR(total)}</span>
                    </Link>
                  ))}
                </div>

                {activeTag ? (
                  <div className="brut-border mt-3 rounded-md bg-blue/10 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <p className="text-sm font-bold">
                        #{activeTag} · {shownExpenses.length} {shownExpenses.length === 1 ? "expense" : "expenses"} ·{" "}
                        {expense > 0 ? Math.round((shownTotal / expense) * 100) : 0}% of {monthLabel}
                      </p>
                      <p className="font-display text-xl font-bold text-pink">{formatEUR(shownTotal)}</p>
                    </div>
                    <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                      {activeTagCategories.map(({ category, total }) => (
                        <span
                          key={category}
                          className="h-full"
                          style={{ width: `${(total / shownTotal) * 100}%`, backgroundColor: categoryColor(category) }}
                        />
                      ))}
                    </div>
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {activeTagCategories.map(({ category, total }) => (
                        <li key={category} className="flex items-center gap-1.5 text-xs">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(category) }} />
                          <span className="font-bold uppercase text-muted">{category}</span>
                          <span className="font-bold">{formatEUR(total)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </nav>
            ) : null}

            {searchResults ? (
              <div aria-live="polite">
                <div className="brut-border mb-4 flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-yellow/40 px-4 py-3">
                  <p className="text-sm font-bold">
                    {searchResults.length === 0
                      ? `Nothing matches “${query}”`
                      : `${searchResults.length}${searchResults.length === SEARCH_LIMIT ? "+" : ""} ${
                          searchResults.length === 1 ? "entry matches" : "entries match"
                        } “${query}” across all months`}
                  </p>
                  {searchResults.length > 0 ? (
                    <p className="font-display text-xl font-bold">
                      {searchExpenses.length > 0 ? <span className="text-pink">−{formatEUR(sumAmounts(searchExpenses))}</span> : null}
                      {searchExpenses.length > 0 && searchIncome.length > 0 ? " · " : null}
                      {searchIncome.length > 0 ? <span className="text-green">+{formatEUR(sumAmounts(searchIncome))}</span> : null}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-5">
                  {resultsByMonth.map(([month, rows]) => (
                    <div key={month}>
                      <div className="mb-2 flex items-baseline justify-between gap-3 border-b-2 border-ink pb-1">
                        <Link href={financeHref(month)} className="font-display font-bold hover:text-blue hover:underline">
                          {formatMonthLabel(month)}
                        </Link>
                        <span className="text-sm font-bold text-pink">
                          {formatEUR(sumAmounts(rows.filter((row) => row.type === "expense")))}
                        </span>
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
              </div>
            ) : (
              <div className={filtering ? "" : "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"}>
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3 border-b-2 border-ink pb-1">
                    <h4 className="text-xs font-bold uppercase tracking-[0.18em]">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-pink" />
                      Expenses
                    </h4>
                    <span className="font-display font-bold">{formatEUR(shownTotal)}</span>
                  </div>
                  {shownExpenses.length === 0 ? (
                    <EmptyState>{filtering ? "No expenses match this filter." : `No expenses logged for ${monthLabel}.`}</EmptyState>
                  ) : (
                    <div className="space-y-4 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
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
                </div>
                {/* Income has no tags or categories, so it's hidden while filtering. */}
                <div className={filtering ? "hidden" : undefined}>
                  <div className="mb-3 flex items-center justify-between gap-3 border-b-2 border-ink pb-1">
                    <h4 className="text-xs font-bold uppercase tracking-[0.18em]">
                      <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-blue" />
                      Income
                    </h4>
                    <span className="font-display font-bold">{formatEUR(income)}</span>
                  </div>
                  {incomeEntries.length === 0 ? (
                    <EmptyState>No income logged for {monthLabel}.</EmptyState>
                  ) : (
                    <div className="space-y-2 lg:max-h-[640px] lg:overflow-y-auto lg:pr-1">
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
                </div>
              </div>
            )}
          </Card>
          </div>
        </div>
      </section>

      {/* 03 · Wealth (its own page) */}
      <section>
        <SectionHeader
          id="wealth"
          index={3}
          color="orange"
          title="Wealth"
          description="Net worth, investment returns and how your portfolio is split."
          action={<PrivacyToggle label="wealth amounts" />}
        />
        <PrivacyScope>
        <Link
          href={wealthHref}
          className="brut-border brut-shadow group flex flex-wrap items-center justify-between gap-4 rounded-lg bg-surface p-4 transition-transform hover:-translate-y-0.5 sm:p-5"
        >
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Net worth</p>
              <p className="private-value font-display text-3xl font-bold">
                {(netWorthCurrencies.length > 0 ? netWorthCurrencies : (["INR"] as const))
                  .map((c) => formatMoney(netWorth[c], c))
                  .join(" · ")}
              </p>
              {eurToInr && netWorthCurrencies.length > 1 ? (
                <p className="private-value text-xs font-bold text-muted">
                  ≈ {formatMoney(netWorth.INR + netWorth.EUR * eurToInr, "INR")} all together
                </p>
              ) : null}
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Latest snapshot</p>
              <p className="font-display text-xl font-bold">
                {latestSnapshot ? formatMonthLabel(latestSnapshot.month) : "None yet"}
              </p>
            </div>
            {nextMaturity ? (
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  {nextMaturity.summary.status === "matured" ? "Matured" : "Next maturity"}
                </p>
                <p className="font-display text-xl font-bold">
                  {nextMaturity.name} · {new Date(`${nextMaturity.terms.maturity}T00:00:00`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="private-value text-xs font-semibold text-muted">
                  {formatMoney(nextMaturity.summary.maturityValue, nextMaturity.currency)}
                  {nextMaturity.summary.status === "matured" ? " · renew or close" : ` · in ${nextMaturity.summary.daysLeft} days`}
                </p>
              </div>
            ) : null}
          </div>
          <span className="brut-border brut-shadow-sm rounded-md bg-orange px-4 py-2 text-sm font-bold uppercase tracking-wide text-white group-hover:opacity-90">
            See wealth →
          </span>
        </Link>
        </PrivacyScope>
      </section>
    </div>
  );
}

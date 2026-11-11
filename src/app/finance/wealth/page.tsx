import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { financeAccounts, financeSnapshotItems, financeSnapshots } from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
import { FinanceMonthBar } from "@/components/FinanceMonthBar";
import { NetWorth, type NetWorthPoint } from "@/components/FinanceDashboard";
import { AllocationCharts, type AllocationRow } from "@/components/AllocationCharts";
import { SavingAccountControls } from "@/components/AccountRow";
import { NewSavingModal } from "@/components/NewSavingModal";
import { DepositsCard, type DepositRow } from "@/components/Deposits";
import { SnapshotHistoryImport } from "@/components/SnapshotHistoryImport";
import { depositTermsOf, isDepositType, summarizeDeposit } from "@/lib/deposits";
import { saveMonthlyFinanceSnapshot } from "@/lib/actions/finance";
import { requireModule } from "@/lib/moduleSettings";
import { currentMonthKey, monthRangeISO, todayISO } from "@/lib/dates";
import { financeHref, formatMonthLabel, formatSignedTotals, resolveMonth } from "@/lib/financeView";
import { CURRENCIES, formatCurrencyTotals, sumByCurrency, type Currency, type CurrencyTotals } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WealthPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireModule("finance");
  const selectedMonth = resolveMonth((await searchParams).month);
  const monthLabel = formatMonthLabel(selectedMonth);

  const [accounts, snapshots, allSnapshotRows] = await Promise.all([
    db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)).orderBy(financeAccounts.id),
    db
      .select()
      .from(financeSnapshots)
      .where(eq(financeSnapshots.userId, userId))
      .orderBy(desc(financeSnapshots.month)),
    db
      .select({
        month: financeSnapshots.month,
        accountId: financeSnapshotItems.accountId,
        accountName: financeSnapshotItems.accountName,
        accountType: financeSnapshotItems.accountType,
        investedAmount: financeSnapshotItems.investedAmount,
        currentValue: financeSnapshotItems.currentValue,
        currency: financeSnapshotItems.currency,
      })
      .from(financeSnapshotItems)
      .innerJoin(financeSnapshots, eq(financeSnapshotItems.snapshotId, financeSnapshots.id))
      .where(eq(financeSnapshotItems.userId, userId))
      .orderBy(desc(financeSnapshots.month), financeSnapshotItems.sortOrder),
  ]);

  const selectedSnapshot = snapshots.find((snapshot) => snapshot.month === selectedMonth);
  const selectedRows = allSnapshotRows.filter((row) => row.month === selectedMonth);
  const selectedByAccount = new Map(selectedRows.map((row) => [row.accountId, row]));
  const latestByAccount = new Map<number, (typeof allSnapshotRows)[number]>();
  for (const row of allSnapshotRows) {
    if (!latestByAccount.has(row.accountId)) latestByAccount.set(row.accountId, row);
  }

  // Returns for the selected month's snapshot (investments only).
  const investmentRows = selectedRows.filter((row) => row.accountType !== "cash");
  const investedTotal = sumByCurrency(investmentRows, (r) => r.investedAmount, (r) => r.currency);
  const currentValueTotal = sumByCurrency(investmentRows, (r) => r.currentValue, (r) => r.currency);
  const snapshotGain: CurrencyTotals = {
    INR: currentValueTotal.INR - investedTotal.INR,
    EUR: currentValueTotal.EUR - investedTotal.EUR,
  };
  const gainPositive = snapshotGain.INR >= 0 && snapshotGain.EUR >= 0;

  // Allocation charts: the latest snapshot on or before the selected month
  // (the current month often has none yet), one portfolio per currency.
  // A saving's colour comes from its position among all savings, so it is stable.
  const savingOrder = new Map(accounts.filter((a) => a.type !== "cash").map((a, index) => [a.id, index]));
  const allocationMonth = snapshots.find((snapshot) => snapshot.month <= selectedMonth)?.month ?? null;
  const allocationSource = allSnapshotRows.filter(
    (row) => row.month === allocationMonth && row.accountType !== "cash"
  );
  const allocationByCurrency = CURRENCIES.map((currency) => ({
    currency,
    rows: allocationSource
      .filter((row) => row.currency === currency)
      .map(
        (row): AllocationRow => ({
          id: row.accountId,
          name: row.accountName,
          invested: Number(row.investedAmount),
          present: Number(row.currentValue),
          order: savingOrder.get(row.accountId) ?? 99,
        })
      )
      .sort((a, b) => a.order - b.order),
  })).filter(({ rows }) => rows.length > 0);

  // Net worth history: every saving's value per snapshot, per currency, oldest first.
  const netWorthHistory = Object.fromEntries(
    CURRENCIES.map((currency) => [
      currency,
      [...snapshots]
        .reverse()
        .map(
          (snapshot): NetWorthPoint => ({
            month: snapshot.month,
            value: allSnapshotRows
              .filter((row) => row.month === snapshot.month && row.currency === currency)
              .reduce((sum, row) => sum + Number(row.currentValue), 0),
          })
        )
        .filter((point) => point.value > 0)
        .slice(-24),
    ])
  ) as Record<Currency, NetWorthPoint[]>;

  const today = todayISO();
  const defaultSnapshotDate =
    selectedSnapshot?.snapshotDate ??
    (selectedMonth === currentMonthKey() ? today : monthRangeISO(selectedMonth).end);

  // Deposits with terms: figures as of today, and an estimate to prefill the
  // snapshot with when that month has nothing saved for them yet.
  const depositRows: DepositRow[] = accounts.flatMap((a) => {
    if (!isDepositType(a.type)) return [];
    const terms = depositTermsOf(a);
    return [
      {
        id: a.id,
        name: a.name,
        type: a.type,
        currency: a.currency,
        terms,
        summary: terms ? summarizeDeposit(terms, today) : null,
      },
    ];
  });

  const snapshotBadge = (
    <span
      className={`brut-border rounded-full px-3 py-1 text-xs font-bold uppercase ${
        selectedSnapshot ? "bg-green text-white" : "bg-yellow text-ink"
      }`}
    >
      {selectedSnapshot ? `Saved ${selectedSnapshot.snapshotDate}` : "Not saved yet"}
    </span>
  );

  return (
    <div>
      <Link
        href={financeHref(selectedMonth)}
        className="mb-3 inline-block text-xs font-bold uppercase tracking-wide text-blue hover:underline"
      >
        ← Finance
      </Link>
      <PageHeader
        title="Wealth"
        subtitle="Your savings and investments, from your monthly snapshots."
        action={
          <div className="grid grid-cols-2 gap-2 sm:flex [&>button]:w-full sm:[&>button]:w-auto">
            <SnapshotHistoryImport
              savings={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))}
              existingMonths={snapshots.map((s) => s.month)}
            />
            <NewSavingModal />
          </div>
        }
      />

      <FinanceMonthBar
        month={selectedMonth}
        path="/finance/wealth"
        mobileAction={
          <a
            href="#snapshot"
            className="brut-border brut-shadow-sm rounded-md bg-green px-3 py-2 text-xs font-bold uppercase tracking-wide text-white"
          >
            Update ↓
          </a>
        }
      >
        <a href="#overview" className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow">
          Overview
        </a>
        {depositRows.length > 0 ? (
          <a href="#deposits" className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow">
            Deposits
          </a>
        ) : null}
        <a href="#portfolio" className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow">
          Portfolio
        </a>
        <a href="#snapshot" className="rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow">
          Update values
        </a>
      </FinanceMonthBar>

      <div className="space-y-4">
        <div id="overview" className="grid scroll-mt-48 grid-cols-1 gap-4 md:scroll-mt-24 lg:grid-cols-2">
          <NetWorth
            accounts={accounts.map((a) => ({
              name: a.name,
              type: a.type,
              balance: Number(a.balance),
              currency: a.currency,
            }))}
            history={netWorthHistory}
          />
          <Card className="flex flex-col">
            <CardHeader
              title="Investment returns"
              description={`From the ${monthLabel} snapshot. Emergency funds not included.`}
              action={snapshotBadge}
            />
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-1 xl:grid-cols-3">
              <div className="brut-border rounded-md bg-background p-3 sm:p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Invested</dt>
                <dd className="font-display text-base font-bold sm:text-xl">{formatCurrencyTotals(investedTotal)}</dd>
              </div>
              <div className="brut-border rounded-md bg-background p-3 sm:p-4">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Worth now</dt>
                <dd className="font-display text-base font-bold sm:text-xl">{formatCurrencyTotals(currentValueTotal)}</dd>
              </div>
              <div className={`brut-border col-span-2 rounded-md p-3 sm:col-span-1 sm:p-4 lg:col-span-1 ${gainPositive ? "bg-green/10" : "bg-pink/10"}`}>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Gain / loss</dt>
                <dd className={`font-display text-base font-bold sm:text-xl ${gainPositive ? "text-green" : "text-pink"}`}>
                  {formatSignedTotals(snapshotGain)}
                </dd>
              </div>
            </dl>
            {snapshots.length > 0 ? (
              <div className="mt-auto pt-5">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Snapshots</p>
                <div className="flex flex-wrap gap-2">
                  {snapshots.map((snapshot) => (
                    <Link
                      key={snapshot.id}
                      href={financeHref(snapshot.month, "/finance/wealth")}
                      className={`brut-border rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${
                        snapshot.month === selectedMonth ? "bg-orange text-white" : "bg-surface hover:bg-yellow"
                      }`}
                    >
                      {snapshot.month}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>
        </div>

        {depositRows.length > 0 ? (
          <div id="deposits" className="scroll-mt-48 md:scroll-mt-24">
            <DepositsCard rows={depositRows} />
          </div>
        ) : null}

        <div id="portfolio" className="scroll-mt-48 space-y-4 md:scroll-mt-24">
          {allocationByCurrency.length > 0 ? (
            allocationByCurrency.map(({ currency, rows }) => (
              <AllocationCharts
                key={currency}
                rows={rows}
                currency={currency}
                monthLabel={
                  allocationMonth === selectedMonth ? monthLabel : `${formatMonthLabel(allocationMonth!)} (latest)`
                }
              />
            ))
          ) : (
            <EmptyState>Save a monthly snapshot to see how your portfolio is split.</EmptyState>
          )}
        </div>

        <Card>
          <details id="snapshot" open={!selectedSnapshot} className="group/snap scroll-mt-48 md:scroll-mt-24">
            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <CardHeader
                className=""
                title={selectedSnapshot ? `Update ${monthLabel} values` : `Create the ${monthLabel} snapshot`}
                description="Enter what you've put in and what each saving is worth now."
                action={
                  <>
                    {snapshotBadge}
                    <span
                      aria-hidden
                      className="brut-border flex h-9 w-9 items-center justify-center rounded-md bg-surface text-xs font-bold transition-transform group-open/snap:rotate-180"
                    >
                      ▼
                    </span>
                  </>
                }
              />
            </summary>
            <form action={saveMonthlyFinanceSnapshot.bind(null, selectedMonth)} className="mt-5">
              <div className="mb-3 flex flex-wrap items-end justify-end gap-3">
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
                    <span>Worth now</span>
                  </div>
                  {accounts.map((saving) => {
                    const saved = selectedByAccount.get(saving.id);
                    const latest = latestByAccount.get(saving.id);
                    const terms = saved ? null : depositTermsOf(saving);
                    const estimate = terms ? summarizeDeposit(terms, defaultSnapshotDate) : null;
                    const investedValue =
                      saved?.investedAmount ?? estimate?.deposited.toFixed(2) ?? latest?.investedAmount ?? saving.balance;
                    const currentValue =
                      saved?.currentValue ?? estimate?.valueNow.toFixed(2) ?? latest?.currentValue ?? saving.balance;
                    return (
                      <div
                        key={saving.id}
                        className="brut-border grid grid-cols-2 gap-2 rounded-md bg-surface p-3 sm:grid-cols-[minmax(0,1fr)_minmax(120px,180px)_minmax(120px,180px)] sm:items-center sm:gap-3"
                      >
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <SavingAccountControls
                            id={saving.id}
                            name={saving.name}
                            type={saving.type}
                            balance={saving.balance}
                            currency={saving.currency}
                            termsHref={isDepositType(saving.type) ? `#deposit-${saving.id}` : undefined}
                            hasTerms={depositTermsOf(saving) !== null}
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
                          <span className="mb-1 block text-[10px] font-bold uppercase text-muted sm:hidden">Worth now</span>
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
    </div>
  );
}

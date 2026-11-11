import Link from "next/link";
import { Card } from "@/components/ui";
import { PaceChart } from "@/components/PaceChart";
import { FINANCE_PRIVACY_KEY, PrivacyBlur } from "@/components/PrivacyBlur";
import { CardHeader } from "@/components/FinanceHeadings";
import { IncomeTargetEditor } from "@/components/IncomeTargetEditor";
import { CURRENCIES, formatEUR, formatMoney, type Currency } from "@/lib/format";

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/** "€1.2k" for tight spots like the six-month labels on a phone. */
function formatEURCompact(value: number) {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/* ------------------------------------------------------------------ */
/* Month pulse: am I on track?                                         */
/* ------------------------------------------------------------------ */

type Verdict = { label: string; icon: string; tone: string; line: string };

function verdictFor({
  income,
  expense,
  projected,
  isCurrent,
}: {
  income: number;
  expense: number;
  projected: number;
  isCurrent: boolean;
}): Verdict {
  if (income <= 0) {
    return {
      label: "No income yet",
      icon: "…",
      tone: "bg-background text-ink",
      line: expense > 0 ? "Log this month’s income to see whether spending is on track." : "Nothing logged yet.",
    };
  }
  if (expense > income) {
    return {
      label: "Over income",
      icon: "✕",
      tone: "bg-pink text-white",
      line: `Spending is ${formatEUR(expense - income)} above income.`,
    };
  }
  if (isCurrent && projected > income) {
    return {
      label: "Watch it",
      icon: "!",
      tone: "bg-orange text-white",
      line: `At this pace you’ll spend about ${formatEUR(projected)}, more than you earned.`,
    };
  }
  return {
    label: isCurrent ? "On track" : "Kept money",
    icon: "✓",
    tone: "bg-green text-white",
    line: isCurrent
      ? `At this pace you’ll spend about ${formatEUR(projected)} and keep ${formatEUR(income - projected)}.`
      : `You kept ${formatEUR(income - expense)} of what came in.`,
  };
}

export function MonthPulse({
  month,
  monthLabel,
  daily,
  uptoDay,
  isCurrent,
  income,
  expense,
  incomeTarget,
}: {
  month: string;
  monthLabel: string;
  daily: number[];
  uptoDay: number;
  isCurrent: boolean;
  income: number;
  expense: number;
  /** The month's income target, if one is set. */
  incomeTarget: number | null;
}) {
  const days = daily.length;
  const projected = uptoDay > 0 ? (expense / uptoDay) * days : 0;
  const verdict = verdictFor({ income, expense, projected, isCurrent });
  const kept = income - expense;
  const daysLeft = isCurrent ? days - uptoDay + 1 : 0;
  const perDayLeft = daysLeft > 0 && kept > 0 ? kept / daysLeft : 0;
  const rate = pct(kept, income);

  return (
    <Card className="overflow-hidden p-0 sm:p-0">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="border-b-[3px] border-ink p-4 sm:p-5 lg:border-b-0 lg:border-r-[3px]">
          <span
            className={`brut-border inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide ${verdict.tone}`}
          >
            <span aria-hidden className="font-display">{verdict.icon}</span>
            {verdict.label}
          </span>
          <p className="mt-3 text-sm font-semibold">{verdict.line}</p>

          <p className="mt-5 text-xs font-bold uppercase tracking-wide text-muted">Kept in {monthLabel}</p>
          <p className={`font-display text-4xl font-bold tracking-tight sm:text-5xl ${kept >= 0 ? "text-ink" : "text-pink"}`}>
            {formatEUR(kept)}
          </p>
          <p className="text-sm font-semibold text-muted">
            {income > 0 ? `${Math.round(rate)}% savings rate` : "Income minus expenses"}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-2">
            <div className="brut-border rounded-md bg-surface px-3 py-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-blue" /> In
              </dt>
              <dd className="font-display text-xl font-bold">{formatEUR(income)}</dd>
            </div>
            <div className="brut-border rounded-md bg-surface px-3 py-2">
              <dt className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                <span className="h-2.5 w-2.5 rounded-full bg-pink" /> Out
              </dt>
              <dd className="font-display text-xl font-bold">{formatEUR(expense)}</dd>
            </div>
            {isCurrent ? (
              <div className="brut-border col-span-2 flex items-baseline justify-between gap-3 rounded-md bg-background px-3 py-2">
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  Can spend per day · {daysLeft} {daysLeft === 1 ? "day" : "days"} left
                </dt>
                <dd className="font-display text-xl font-bold">{formatEUR(perDayLeft)}</dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4">
            {incomeTarget !== null ? (
              <div className="mb-1.5">
                <div className="flex items-baseline justify-between gap-2 text-[11px] font-bold uppercase tracking-wide">
                  <span className="text-muted">Income target {formatEUR(incomeTarget)}</span>
                  <span className={income >= incomeTarget ? "text-green" : "text-ink"}>
                    {income >= incomeTarget ? "✓ reached" : `${Math.round(pct(income, incomeTarget))}%`}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-background" aria-hidden>
                  <div
                    className={`h-full rounded-full ${income >= incomeTarget ? "bg-green" : "bg-blue"}`}
                    style={{ width: `${Math.min(100, pct(income, incomeTarget))}%` }}
                  />
                </div>
              </div>
            ) : null}
            <IncomeTargetEditor month={month} target={incomeTarget} />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <CardHeader
            className="mb-2"
            title="Spending pace"
            description="What you've spent so far, day by day, against your income."
            action={
              <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted">
                {isCurrent ? `Day ${uptoDay} of ${days}` : monthLabel}
              </span>
            }
          />
          <PaceChart daily={daily} income={income} uptoDay={uptoDay} monthLabel={monthLabel} />
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Trends: six months of in vs out                                     */
/* ------------------------------------------------------------------ */

export type MonthTrend = { month: string; label: string; income: number; expense: number };

export function TrendBars({ months, selectedMonth }: { months: MonthTrend[]; selectedMonth: string }) {
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const withIncome = months.filter((m) => m.income > 0);
  const avgRate =
    withIncome.length > 0
      ? withIncome.reduce((sum, m) => sum + pct(m.income - m.expense, m.income), 0) / withIncome.length
      : null;
  const avgSpend = months.reduce((sum, m) => sum + m.expense, 0) / Math.max(1, months.length);

  return (
    <Card className="flex flex-col">
      <CardHeader
        className="mb-1"
        title="Six-month trend"
        description="Money in and out each month. Tap a month to open it."
        action={
        <div className="flex gap-3 text-xs font-bold text-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-blue" /> In
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-pink" /> Out
          </span>
        </div>
        }
      />

      <div className="mt-4 grid flex-1 grid-cols-6 items-end gap-1 border-b-2 border-ink sm:gap-2" style={{ minHeight: "11rem" }}>
        {months.map((m) => {
          const kept = m.income - m.expense;
          const selected = m.month === selectedMonth;
          return (
            <Link
              key={m.month}
              href={`/finance?month=${m.month}`}
              aria-label={`${m.label}: in ${formatEUR(m.income)}, out ${formatEUR(m.expense)}, kept ${formatEUR(kept)}`}
              className={`group relative flex h-full items-end justify-center gap-[2px] rounded-t-md px-1 pt-6 ${
                selected ? "bg-yellow/50" : "hover:bg-background"
              }`}
            >
              <span
                className="w-1/3 max-w-5 rounded-t-[4px] bg-blue"
                style={{ height: `${Math.max(m.income > 0 ? 2 : 0, pct(m.income, max))}%` }}
              />
              <span
                className="w-1/3 max-w-5 rounded-t-[4px] bg-pink"
                style={{ height: `${Math.max(m.expense > 0 ? 2 : 0, pct(m.expense, max))}%` }}
              />
              <span className="brut-border brut-shadow-sm pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-md bg-surface px-3 py-2 text-left text-xs group-hover:block group-focus-visible:block">
                <span className="block font-bold">{m.label}</span>
                <span className="block font-semibold text-muted">
                  In <b className="text-ink">{formatEUR(m.income)}</b> · Out <b className="text-ink">{formatEUR(m.expense)}</b>
                </span>
                <span className="block font-semibold text-muted">
                  Kept <b className="text-ink">{formatEUR(kept)}</b>
                </span>
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mt-1.5 grid grid-cols-6 gap-1 sm:gap-2">
        {months.map((m) => {
          const kept = m.income - m.expense;
          return (
            <div key={m.month} className="text-center">
              <p className={`text-xs font-bold uppercase ${m.month === selectedMonth ? "text-ink" : "text-muted"}`}>
                {m.label.slice(0, 3)}
              </p>
              <p className={`text-[11px] font-bold ${kept < 0 ? "text-pink" : "text-muted"}`}>
                {m.income > 0 || m.expense > 0 ? (
                  <>
                    <span className="sm:hidden">{`${kept >= 0 ? "+" : ""}${formatEURCompact(kept)}`}</span>
                    <span className="hidden sm:inline">{`${kept >= 0 ? "+" : ""}${formatEUR(kept)}`}</span>
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md bg-background px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Avg. spend / month</p>
          <p className="font-display text-lg font-bold">{formatEUR(avgSpend)}</p>
        </div>
        <div className="rounded-md bg-background px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Avg. savings rate</p>
          <p className="font-display text-lg font-bold">{avgRate === null ? "—" : `${Math.round(avgRate)}%`}</p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Year at a glance                                                    */
/* ------------------------------------------------------------------ */

export function YearSummary({
  year,
  months,
  selectedMonth,
}: {
  year: string;
  /** January to December of `year` (months with nothing logged have zeros). */
  months: MonthTrend[];
  selectedMonth: string;
}) {
  const active = months.filter((m) => m.income > 0 || m.expense > 0);
  const income = months.reduce((sum, m) => sum + m.income, 0);
  const expense = months.reduce((sum, m) => sum + m.expense, 0);
  const kept = income - expense;
  const withKept = active.map((m) => ({ ...m, kept: m.income - m.expense }));
  const best = withKept.length > 0 ? withKept.reduce((a, b) => (b.kept > a.kept ? b : a)) : null;
  const worst = withKept.length > 1 ? withKept.reduce((a, b) => (b.kept < a.kept ? b : a)) : null;
  const maxAbs = Math.max(1, ...withKept.map((m) => Math.abs(m.kept)));

  return (
    <Card>
      <CardHeader
        title={`${year} so far`}
        description="What you kept each month this year: above the line saved, below it overspent."
      />
      {active.length === 0 ? (
        <p className="text-sm font-semibold text-muted">Nothing logged in {year} yet.</p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-md bg-background px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">In</dt>
              <dd className="font-display text-lg font-bold">{formatEUR(income)}</dd>
            </div>
            <div className="rounded-md bg-background px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Out</dt>
              <dd className="font-display text-lg font-bold">{formatEUR(expense)}</dd>
            </div>
            <div className="rounded-md bg-background px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Kept</dt>
              <dd className={`font-display text-lg font-bold ${kept < 0 ? "text-pink" : ""}`}>{formatEUR(kept)}</dd>
            </div>
            <div className="rounded-md bg-background px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Savings rate</dt>
              <dd className="font-display text-lg font-bold">{income > 0 ? `${Math.round(pct(kept, income))}%` : "—"}</dd>
            </div>
          </dl>

          {/* Kept per month: one baseline, bars up (saved) or down (overspent). */}
          <div className="mt-4 grid grid-cols-12 gap-1" style={{ height: "7rem" }}>
            {months.map((m) => {
              const k = m.income - m.expense;
              const has = m.income > 0 || m.expense > 0;
              const h = has ? Math.max(3, (Math.abs(k) / maxAbs) * 50) : 0;
              return (
                <Link
                  key={m.month}
                  href={`/finance?month=${m.month}`}
                  title={has ? `${m.label}: kept ${formatEUR(k)}` : `${m.label}: nothing logged`}
                  aria-label={has ? `${m.label}: kept ${formatEUR(k)}` : `${m.label}: nothing logged`}
                  className={`relative rounded-sm ${m.month === selectedMonth ? "bg-yellow/50" : "hover:bg-background"}`}
                >
                  <span className="absolute inset-x-0 top-1/2 h-0.5 bg-ink" aria-hidden />
                  {has ? (
                    <span
                      aria-hidden
                      className={`absolute inset-x-[15%] ${k >= 0 ? "bottom-1/2 rounded-t-[4px] bg-green" : "top-1/2 rounded-b-[4px] bg-pink"}`}
                      style={{ height: `${h}%` }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </div>
          <div className="mt-1 grid grid-cols-12 gap-1">
            {months.map((m) => (
              <span
                key={m.month}
                className={`text-center text-[10px] font-bold uppercase ${m.month === selectedMonth ? "text-ink" : "text-muted"}`}
              >
                {m.label.slice(0, 1)}
                <span className="hidden sm:inline">{m.label.slice(1, 3)}</span>
              </span>
            ))}
          </div>

          {best ? (
            <p className="mt-3 text-sm font-semibold">
              Best month: <b>{best.label}</b> (kept {formatEUR(best.kept)})
              {worst && worst.month !== best.month ? (
                <>
                  {" "}
                  · toughest: <b>{worst.label}</b> ({worst.kept >= 0 ? "kept" : "overspent"} {formatEUR(Math.abs(worst.kept))})
                </>
              ) : null}
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Net worth: savings per currency, by type, and growth                */
/* ------------------------------------------------------------------ */

const TYPE_LABEL: Record<string, string> = {
  fd: "Fixed deposits",
  rd: "Recurring deposits",
  mutual_fund: "Mutual funds",
  stocks: "Stocks",
  bank: "Bank",
  cash: "Emergency fund",
  other: "Other",
};

export type NetWorthAccount = { name: string; type: string; balance: number; currency: string };
export type NetWorthPoint = { month: string; value: number };

export function NetWorth({
  accounts,
  history,
  eurToInr,
  rateEditor,
}: {
  accounts: NetWorthAccount[];
  history: Record<Currency, NetWorthPoint[]>;
  /** ₹ per €, when set: shows INR and EUR as one total too. */
  eurToInr: number | null;
  /** The form to set that rate (a client component). */
  rateEditor?: React.ReactNode;
}) {
  const currencies = CURRENCIES.filter((c) => accounts.some((a) => a.currency === c));
  const totalOf = (currency: Currency) =>
    accounts.filter((a) => a.currency === currency).reduce((sum, a) => sum + a.balance, 0);
  const combined = eurToInr && currencies.length > 1 ? totalOf("INR") + totalOf("EUR") * eurToInr : null;

  return (
    <Card className="flex flex-col">
      <PrivacyBlur
        storageKey={FINANCE_PRIVACY_KEY}
        label="net worth amounts"
        title="Net worth"
        description="Everything you’ve saved, including emergency funds, by currency."
      >

        {combined !== null ? (
          <div className="mb-3 rounded-md bg-ink px-3 py-2 text-surface">
            <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">All together, in ₹</p>
            <p className="private-value font-display text-3xl font-bold">{formatMoney(combined, "INR")}</p>
            <p className="text-[11px] font-semibold opacity-80">At €1 = ₹{eurToInr}</p>
          </div>
        ) : null}

        {currencies.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Add a saving in the Savings section to see it here.</p>
        ) : (
          <div className="space-y-5">
            {currencies.map((currency) => {
              const mine = accounts.filter((a) => a.currency === currency);
              const total = mine.reduce((sum, a) => sum + a.balance, 0);
              const byType = [...new Set(mine.map((a) => a.type))]
                .map((type) => ({
                  type,
                  value: mine.filter((a) => a.type === type).reduce((sum, a) => sum + a.balance, 0),
                }))
                .filter((t) => t.value > 0)
                .sort((a, b) => b.value - a.value);
              const points = history[currency];
              const prev = points.length >= 2 ? points[points.length - 2] : null;
              const last = points.length >= 1 ? points[points.length - 1] : null;
              const change = prev && last ? last.value - prev.value : null;
              return (
                <section key={currency} className="brut-border rounded-md bg-background p-3">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{currency} savings</p>
                      <p className="private-value font-display text-3xl font-bold">{formatMoney(total, currency)}</p>
                      {change !== null && prev ? (
                        <p className={`private-value text-xs font-bold ${change >= 0 ? "text-green" : "text-pink"}`}>
                          {change >= 0 ? "▲ +" : "▼ "}
                          {formatMoney(change, currency)} since {prev.month}
                        </p>
                      ) : (
                        <p className="text-xs font-semibold text-muted">Save two snapshots to see growth</p>
                      )}
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {byType.map(({ type, value }) => (
                      <li key={type} className="grid grid-cols-[6rem_minmax(0,1fr)_auto] items-center gap-2 text-xs sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]">
                        <span className="truncate font-bold uppercase text-muted">{TYPE_LABEL[type] ?? type}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-surface">
                          <span
                            className="block h-full rounded-full bg-orange"
                            style={{ width: `${Math.max(2, pct(value, total))}%` }}
                          />
                        </span>
                        <span className="private-value font-bold">{formatMoney(value, currency)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        {rateEditor ? <div className="mt-3">{rateEditor}</div> : null}
      </PrivacyBlur>
    </Card>
  );
}

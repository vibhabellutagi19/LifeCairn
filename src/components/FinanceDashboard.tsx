import Link from "next/link";
import { Card } from "@/components/ui";
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
/* The month as a receipt: am I on track?                              */
/* ------------------------------------------------------------------ */

type Verdict = { label: string; icon: string; tone: string; line: string };

function verdictFor({
  income,
  expense,
  projected,
  isCurrent,
  perDayLeft,
  daysLeft,
}: {
  income: number;
  expense: number;
  projected: number;
  isCurrent: boolean;
  perDayLeft: number;
  daysLeft: number;
}): Verdict {
  if (income <= 0) {
    return {
      label: "No income yet",
      icon: "…",
      tone: "border-muted text-muted",
      line: expense > 0 ? "Log this month’s income to see whether spending is on track." : "Nothing logged yet.",
    };
  }
  if (expense > income) {
    return {
      label: "Over",
      icon: "✕",
      tone: "border-pink text-pink",
      line: `Spending is ${formatEUR(expense - income)} above what came in.`,
    };
  }
  if (isCurrent && projected > income) {
    return {
      label: "Watch it",
      icon: "!",
      tone: "border-orange text-orange",
      line: `At this pace you’ll spend about ${formatEUR(projected)}, more than came in.`,
    };
  }
  return {
    label: isCurrent ? "On track" : "Kept",
    icon: "✓",
    tone: "border-green text-green",
    line: isCurrent
      ? `At this pace you keep about ${formatEUR(income - projected)} this month. You can spend ${formatEUR(perDayLeft)} a day for the next ${daysLeft} ${daysLeft === 1 ? "day" : "days"}.`
      : `You kept ${formatEUR(income - expense)} of what came in, ${Math.round(pct(income - expense, income))}%.`,
  };
}

function ReceiptLine({ label, value, quiet = false }: { label: string; value: string; quiet?: boolean }) {
  return (
    <div className={`flex items-baseline gap-1.5 font-display ${quiet ? "text-sm text-muted" : "text-base"}`}>
      <span>{label}</span>
      <span aria-hidden className={`flex-1 -translate-y-1 border-b-2 border-dotted ${quiet ? "border-ink/15" : "border-ink/30"}`} />
      <span className={quiet ? "" : "font-bold"}>{value}</span>
    </div>
  );
}

/** The top of Finance: in, out, regulars still due and what's kept, with a verdict stamp. */
export function MonthReceipt({
  month,
  monthLabel,
  daily,
  uptoDay,
  isCurrent,
  income,
  expense,
  regularsDue,
  incomeTarget,
}: {
  month: string;
  monthLabel: string;
  daily: number[];
  uptoDay: number;
  isCurrent: boolean;
  income: number;
  expense: number;
  /** Regular expenses not yet added this month. */
  regularsDue: number;
  incomeTarget: number | null;
}) {
  const days = daily.length;
  const projected = uptoDay > 0 ? (expense / uptoDay) * days : 0;
  const kept = income - expense;
  const daysLeft = isCurrent ? days - uptoDay + 1 : 0;
  const perDayLeft = daysLeft > 0 && kept - regularsDue > 0 ? (kept - regularsDue) / daysLeft : 0;
  const verdict = verdictFor({ income, expense, projected, isCurrent, perDayLeft, daysLeft });

  return (
    <section aria-label={`${monthLabel} so far`} className="w-full">
      <div className="brut-border rounded-t-lg border-b-0 bg-surface px-4 pb-2 pt-4 shadow-[5px_0_0_0_var(--ink)] sm:px-5 sm:pt-5">
        <div className="flex justify-between font-display text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
          <span>{monthLabel}</span>
          <span>{isCurrent ? `Day ${uptoDay} / ${days}` : "Closed"}</span>
        </div>
        <div className="mt-4 space-y-2.5">
          <ReceiptLine label="Came in" value={`+${formatEUR(income)}`} />
          <ReceiptLine label="Went out" value={`−${formatEUR(expense)}`} />
          {regularsDue > 0 ? <ReceiptLine label="Regulars still due" value={`−${formatEUR(regularsDue)}`} quiet /> : null}
        </div>
        <div className="mt-3.5 flex items-end justify-between gap-2 border-t-[3px] border-double border-ink pt-3">
          <div className="min-w-0">
            <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
              {isCurrent ? "Kept so far" : "Kept"}
            </p>
            <p className={`font-display text-4xl font-bold leading-none tracking-tight sm:text-5xl ${kept < 0 ? "text-pink" : ""}`}>
              {formatEUR(kept)}
            </p>
          </div>
          <span
            className={`mb-1.5 inline-flex shrink-0 -rotate-[9deg] items-center gap-1.5 rounded-lg border-[3px] px-2.5 py-1.5 font-display text-sm font-bold uppercase tracking-wider ${verdict.tone}`}
          >
            <span aria-hidden>{verdict.icon}</span>
            {verdict.label}
          </span>
        </div>
        <p className="mb-1.5 mt-2.5 text-sm leading-snug text-ink/85">{verdict.line}</p>
        <div className="mb-2 mt-3">
          {incomeTarget !== null ? (
            <div className="mb-1.5">
              <div className="flex items-baseline justify-between gap-2 font-display text-[11px] font-bold uppercase tracking-wide">
                <span className="text-muted">Income target {formatEUR(incomeTarget)}</span>
                <span className={income >= incomeTarget ? "text-green" : "text-ink"}>
                  {income >= incomeTarget ? "✓ reached" : `${Math.round(pct(income, incomeTarget))}%`}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full border-2 border-ink bg-background" aria-hidden>
                <div
                  className={`h-full ${income >= incomeTarget ? "bg-green" : "bg-blue"}`}
                  style={{ width: `${Math.min(100, pct(income, incomeTarget))}%` }}
                />
              </div>
            </div>
          ) : null}
          <IncomeTargetEditor month={month} target={incomeTarget} />
        </div>
      </div>
      <div aria-hidden className="receipt-edge border-x-[3px] border-ink" />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Where the days went: a month calendar shaded by spending            */
/* ------------------------------------------------------------------ */

// One hue, light to dark (sequential): how much was spent that day.
const SPEND_STEPS = [
  { below: 0.01, color: "#fdebe2", ink: "text-ink" },
  { below: 20, color: "#fbc4a6", ink: "text-ink" },
  { below: 50, color: "#f7905f", ink: "text-ink" },
  { below: 150, color: "#e45a22", ink: "text-white" },
  { below: Infinity, color: "#9e3a12", ink: "text-white" },
];
const stepFor = (amount: number) => SPEND_STEPS.find((s) => amount < s.below) ?? SPEND_STEPS[SPEND_STEPS.length - 1];

/** The calendar itself; shown inside DayViews, which provides the card and title. */
export function SpendCalendar({
  month,
  daily,
  uptoDay,
  activeDay,
  hrefFor,
  biggestDay,
}: {
  month: string;
  /** Spent on each day of the month, index 0 = the 1st. */
  daily: number[];
  /** Last day with figures (today in the current month). */
  uptoDay: number;
  activeDay: string | null;
  /** Link that filters Transactions to one day (null clears it). */
  hrefFor: (day: string | null) => string;
  biggestDay: { day: string; amount: number; what: string } | null;
}) {
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const blanks = (first + 6) % 7; // Monday-first grid
  const noSpend = daily.slice(0, uptoDay).filter((v) => v < 0.01).length;
  const dayISO = (n: number) => `${month}-${String(n).padStart(2, "0")}`;
  const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="text-center font-display text-[11px] font-bold text-muted">
            <span className="sm:hidden">{d[0]}</span>
            <span className="hidden sm:inline">{d}</span>
          </span>
        ))}
        {Array.from({ length: blanks }, (_, i) => (
          <span key={`b${i}`} aria-hidden />
        ))}
        {daily.map((amount, i) => {
          const n = i + 1;
          const iso = dayISO(n);
          const past = n <= uptoDay;
          if (!past) {
            return (
              <span
                key={iso}
                className="flex aspect-square flex-col rounded-md border-2 border-dashed border-ink/20 p-1 text-[11px] font-bold text-muted sm:aspect-auto sm:h-14"
              >
                {n}
              </span>
            );
          }
          const step = stepFor(amount);
          const active = activeDay === iso;
          return (
            <Link
              key={iso}
              href={hrefFor(active ? null : iso)}
              scroll={false}
              aria-label={`${weekday(iso)}: ${formatEUR(amount)}`}
              aria-current={active ? "true" : undefined}
              title={`${weekday(iso)}: ${formatEUR(amount)}`}
              className={`flex aspect-square flex-col justify-between rounded-md p-1 text-[11px] font-bold sm:aspect-auto sm:h-14 sm:p-1.5 ${step.ink} ${
                active || n === uptoDay ? "outline outline-[3px] outline-offset-1 outline-ink" : ""
              }`}
              style={{ backgroundColor: step.color }}
            >
              <span>{n}</span>
              {amount >= 0.01 ? <span className="hidden font-semibold sm:block">{formatEUR(amount)}</span> : null}
            </Link>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-muted" aria-hidden>
        <span>€0</span>
        {SPEND_STEPS.map((s) => (
          <span key={s.color} className="h-3 w-5 rounded-sm" style={{ backgroundColor: s.color }} />
        ))}
        <span>€150+</span>
      </div>
      <dl className="mt-3 space-y-1 border-t-2 border-ink pt-2.5 text-sm">
        {biggestDay ? (
          <div className="flex justify-between gap-3">
            <dt>
              Biggest day: <b>{weekday(biggestDay.day)}</b> · {biggestDay.what}
            </dt>
            <dd className="shrink-0 font-bold">{formatEUR(biggestDay.amount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt>{noSpend} no-spend {noSpend === 1 ? "day" : "days"}</dt>
          {noSpend > 0 ? <dd className="font-bold text-green">nice</dd> : null}
        </div>
      </dl>
    </div>
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

// Warm stone tones for the cairn: identity comes from each stone's label, not its colour.
const STONE_TONES = ["#ddd2bf", "#c9bca4", "#e2d8c5", "#d4c8b2", "#e9e1d2", "#cdc1ab", "#e6dccb", "#d9cfbd", "#efe8da"];

/**
 * Savings as a cairn: one stone per kind of saving, biggest at the bottom.
 * Width follows the square root of the share, so small stones stay readable.
 */
function SavingsCairn({ stones, total, currency }: { stones: { type: string; value: number }[]; total: number; currency: Currency }) {
  if (stones.length === 0) return null;
  const stack = [...stones].sort((a, b) => a.value - b.value); // top first
  const max = stack[stack.length - 1].value;
  return (
    <figure className="mt-4">
      <figcaption className="sr-only">
        {`${currency} savings by kind: ${stones.map((s) => `${TYPE_LABEL[s.type] ?? s.type} ${formatMoney(s.value, currency)}`).join(", ")}.`}
      </figcaption>
      <div className="flex flex-col items-center" aria-hidden>
        {stack.map((stone, i) => {
          const share = Math.sqrt(stone.value / max);
          const tilt = (i % 2 === 0 ? -1 : 1) * (1 + (i % 3));
          return (
            <div
              key={stone.type}
              className="relative flex flex-col items-center justify-center border-[3px] border-ink px-3 text-center"
              style={{
                width: `max(8.5rem, ${Math.round(38 + share * 62)}%)`,
                height: `${Math.round(2.6 + share * 1.6)}rem`,
                marginTop: i === 0 ? 0 : "-0.35rem",
                borderRadius: "48% 52% 46% 54% / 58% 55% 45% 42%",
                background: STONE_TONES[(stack.length - 1 - i) % STONE_TONES.length],
                transform: `rotate(${tilt}deg)`,
                zIndex: stack.length - i,
                boxShadow: i === stack.length - 1 ? "0 4px 0 var(--ink)" : undefined,
              }}
            >
              <span className="font-display text-xs font-bold leading-tight">{TYPE_LABEL[stone.type] ?? stone.type}</span>
              <span className="private-value text-[11px] font-semibold leading-tight">
                {formatMoney(stone.value, currency)} · {Math.round(pct(stone.value, total))}%
              </span>
            </div>
          );
        })}
        <div className="-mt-1 h-2.5 w-[95%] rounded-[50%] bg-ink/10" />
      </div>
    </figure>
  );
}

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
        description="Your cairn: everything you’ve saved, one stone per kind, biggest at the bottom."
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
                  <SavingsCairn stones={byType} total={total} currency={currency} />
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

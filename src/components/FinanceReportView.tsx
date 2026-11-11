// The sections of /finance/reports. Server components; data from buildReport().

import Link from "next/link";
import Form from "next/form";
import { clsx } from "clsx";
import { Button, Card, EmptyState, Input } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
import { PrintButton } from "@/components/PrintButton";
import { categoryColor } from "@/lib/financeCategories";
import { formatEUR, formatMoney } from "@/lib/format";
import { currentMonthKey, shiftMonthKey } from "@/lib/dates";
import { parsePeriod, shiftPeriod, type FinanceReport, type Period, type PeriodKind } from "@/lib/financeReport";

const shortMonth = (month: string) =>
  new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short" });
const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const pct = (value: number | null) => (value === null ? "—" : `${Math.round(value)}%`);
const signedEUR = (value: number) => `${value >= 0 ? "+" : "−"}${formatEUR(Math.abs(value))}`;

export function reportHref(params: Record<string, string>) {
  return `/finance/reports?${new URLSearchParams(params)}`;
}

/* ------------------------------------------------------------------ */
/* Period picker                                                       */
/* ------------------------------------------------------------------ */

export function PeriodPicker({ period }: { period: Period }) {
  const now = currentMonthKey();
  const kinds: { kind: PeriodKind; label: string; params: Record<string, string> }[] = [
    { kind: "month", label: "Month", params: { p: "month", at: shiftMonthKey(now, -1) } },
    { kind: "quarter", label: "Quarter", params: { p: "quarter" } },
    { kind: "year", label: "Year", params: { p: "year" } },
    { kind: "custom", label: "Custom", params: { p: "custom" } },
  ];
  const next = shiftPeriod(period, 1);
  // Don't offer a period that starts after this month.
  const hasNext = parsePeriod(next).from <= now;
  const arrow = "brut-border flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface text-xl font-bold hover:bg-yellow";

  return (
    <div className="mb-6 space-y-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Report period" className="brut-border flex overflow-hidden rounded-md bg-surface">
          {kinds.map((k, i) => (
            <Link
              key={k.kind}
              href={reportHref(k.params)}
              aria-current={period.kind === k.kind ? "true" : undefined}
              className={clsx(
                "px-3 py-2 text-xs font-bold uppercase tracking-wide sm:px-4",
                i > 0 && "border-l-[3px] border-ink",
                period.kind === k.kind ? "bg-ink text-surface" : "hover:bg-yellow"
              )}
            >
              {k.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={reportHref(shiftPeriod(period, -1))} aria-label="Previous period" className={arrow}>
            ‹
          </Link>
          <span className="brut-border brut-shadow-sm rounded-full bg-yellow px-4 py-2 font-display text-sm font-bold">
            {period.label}
            {period.ongoing ? " · so far" : ""}
          </span>
          {hasNext ? (
            <Link href={reportHref(next)} aria-label="Next period" className={arrow}>
              ›
            </Link>
          ) : null}
        </div>
        <div className="ml-auto flex gap-2">
          <PrintButton />
          <a
            href="/finance/export/transactions"
            className="brut-border flex min-h-11 items-center rounded-md bg-surface px-3 text-xs font-bold uppercase tracking-wide hover:bg-yellow"
          >
            CSV
          </a>
        </div>
      </div>
      {period.kind === "custom" ? (
        <Form action="/finance/reports" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="p" value="custom" />
          <label className="text-xs font-bold uppercase tracking-wide">
            From
            <Input type="month" name="from" defaultValue={period.from} className="mt-1 w-auto" required />
          </label>
          <label className="text-xs font-bold uppercase tracking-wide">
            To
            <Input type="month" name="to" defaultValue={period.to} className="mt-1 w-auto" required />
          </label>
          <Button type="submit" variant="primary">
            Show
          </Button>
        </Form>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Headline                                                            */
/* ------------------------------------------------------------------ */

function rankWords(position: number) {
  if (position === 1) return "your best month yet";
  const suffix = position === 2 ? "nd" : position === 3 ? "rd" : "th";
  return `your ${position}${suffix} best month`;
}

/** Month: a dark cover sentence. Longer periods: four tiles. Both compare with the usual month. */
export function ReportHeadline({ report }: { report: FinanceReport }) {
  const { period, usual, highlights } = report;
  const perMonth = (value: number) => value / period.months.length;
  const usualNote = report.baselineMonths.length
    ? `Compared with your usual month: the average of ${report.baselineMonths.map(shortMonth).join(", ")}.`
    : "No months before this one to compare with yet.";

  if (period.kind === "month") {
    return (
      <section aria-label="The month in one line" className="print-avoid-break rounded-xl bg-ink p-5 text-surface sm:p-7">
        <p className="font-display text-xs font-bold uppercase tracking-[0.18em] text-yellow">
          {period.label} {period.ongoing ? "so far" : "in review"}
        </p>
        <p className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">
          {report.kept >= 0 ? (
            <>
              You kept <span className="text-yellow">{formatEUR(report.kept)}</span>
              {highlights?.rank ? `, ${rankWords(highlights.rank.position)}` : ""}.
            </>
          ) : (
            <>
              You spent <span className="text-yellow">{formatEUR(-report.kept)}</span> more than came in.
            </>
          )}
        </p>
        <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-xl">
          {[
            ["In", formatEUR(report.income)],
            ["Out", formatEUR(report.expense)],
            ["Saved", pct(report.rate)],
          ].map(([label, value], i) => (
            <div
              key={label}
              className={clsx("rounded-lg border-2 px-3 py-2", i === 2 ? "border-yellow bg-yellow text-ink" : "border-surface")}
            >
              <p className="text-[11px] font-semibold opacity-90">{label}</p>
              <p className="font-display text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
        {usual ? (
          <p className="mt-4 text-sm font-semibold opacity-90">
            A usual month: in {formatEUR(usual.income)}, out {formatEUR(usual.expense)}, saved {pct(usual.rate)}.
          </p>
        ) : null}
      </section>
    );
  }

  const tiles = [
    { label: "Came in", value: formatEUR(report.income), delta: usual ? perMonth(report.income) - usual.income : null, goodWhenUp: true },
    { label: "Went out", value: formatEUR(report.expense), delta: usual ? perMonth(report.expense) - usual.expense : null, goodWhenUp: false },
    { label: "Kept", value: formatEUR(report.kept), delta: usual ? perMonth(report.kept) - usual.kept : null, goodWhenUp: true },
  ];
  const rateDelta = usual && report.rate !== null && usual.rate !== null ? report.rate - usual.rate : null;
  return (
    <section aria-label="Headline">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => {
          const good = t.delta === null ? null : t.goodWhenUp ? t.delta >= 0 : t.delta <= 0;
          return (
            <div key={t.label} className={clsx("brut-border rounded-lg bg-surface p-4", t.label === "Kept" && "brut-shadow")}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{t.label}</p>
              <p className="font-display text-2xl font-bold sm:text-3xl">{t.value}</p>
              {t.delta !== null ? (
                <p className={clsx("text-xs font-bold", good ? "text-green" : "text-pink")}>
                  {t.delta >= 0 ? "▲" : "▼"} {formatEUR(Math.abs(t.delta))} a month vs usual
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="brut-border rounded-lg bg-surface p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Savings rate</p>
          <p className="font-display text-2xl font-bold sm:text-3xl">{pct(report.rate)}</p>
          {rateDelta !== null ? (
            <p className={clsx("text-xs font-bold", rateDelta >= 0 ? "text-green" : "text-pink")}>
              {rateDelta >= 0 ? "▲" : "▼"} {Math.abs(Math.round(rateDelta))} points vs usual
            </p>
          ) : null}
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-muted">{usualNote}</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Month highlights                                                    */
/* ------------------------------------------------------------------ */

export function MonthHighlights({ report }: { report: FinanceReport }) {
  const h = report.highlights;
  if (!h) return null;
  const items: { mark: string; title: string; body: string; accent?: boolean }[] = [];
  items.push({
    mark: String(h.noSpendDays),
    title: `${h.noSpendDays} no-spend ${h.noSpendDays === 1 ? "day" : "days"}`,
    body:
      h.noSpendDaysBefore === null
        ? "Days without a single expense."
        : h.noSpendDays === h.noSpendDaysBefore
          ? "Same as the month before."
          : `${Math.abs(h.noSpendDays - h.noSpendDaysBefore)} ${h.noSpendDays > h.noSpendDaysBefore ? "more" : "fewer"} than the month before.`,
    accent: true,
  });
  if (h.biggest) {
    items.push({
      mark: "€",
      title: `Biggest spend: ${h.biggest.source}, ${formatEUR(h.biggest.amount)}`,
      body: `On ${shortDate(h.biggest.date)}.${h.runnerUp ? ` Then ${h.runnerUp.source}, ${formatEUR(h.runnerUp.amount)}.` : ""}`,
    });
  }
  if (h.topTag) {
    items.push({
      mark: "#",
      title: `#${h.topTag.tag} cost ${formatEUR(h.topTag.total)}`,
      body: h.topTag.days > 1 ? `${formatEUR(h.topTag.total / h.topTag.days)} a day across ${h.topTag.days} days.` : "Your biggest tag this month.",
    });
  }
  const target = report.months[0]?.target ?? null;
  if (target !== null) {
    items.push({
      mark: h.targetReachedOn ? "✓" : "…",
      title: h.targetReachedOn ? `Income target reached on ${shortDate(h.targetReachedOn)}` : "Income target not reached",
      body: `${formatEUR(report.income)} of ${formatEUR(target)}.`,
    });
  }
  for (const m of h.maturing) {
    items.push({
      mark: "⏳",
      title: `${m.name} matures on ${shortDate(m.date)}`,
      body: `${formatMoney(m.amount, m.currency)} coming back: renew it or move it?`,
    });
  }
  return (
    <section aria-label="Highlights" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.title} className="print-avoid-break brut-border flex items-start gap-3 rounded-lg bg-surface p-3">
          <span
            aria-hidden
            className={clsx(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-ink font-display font-bold",
              item.accent ? "bg-yellow" : "bg-background"
            )}
          >
            {item.mark}
          </span>
          <p className="text-sm">
            <b>{item.title}</b>
            <br />
            <span className="text-muted">{item.body}</span>
          </p>
        </div>
      ))}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Savings rate per month                                              */
/* ------------------------------------------------------------------ */

export function SavingsRateBars({ report }: { report: FinanceReport }) {
  const months = report.months;
  if (months.length < 2) return null;
  const avg = report.rate;
  const withRate = months.filter((m) => m.rate !== null);
  const best = withRate.length ? withRate.reduce((a, b) => ((b.rate ?? 0) > (a.rate ?? 0) ? b : a)) : null;
  const worst = withRate.length > 1 ? withRate.reduce((a, b) => ((b.rate ?? 0) < (a.rate ?? 0) ? b : a)) : null;
  return (
    <Card className="print-avoid-break">
      <CardHeader
        title="Savings rate, month by month"
        description={avg !== null ? `The dashed line is the whole period: ${pct(avg)}.` : "No income logged in this period."}
      />
      <div className="relative grid h-48 items-end gap-1 border-b-[3px] border-ink sm:gap-2" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {avg !== null && avg > 0 ? (
          <div aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-ink" style={{ bottom: `${Math.min(100, avg) * 0.8}%` }} />
        ) : null}
        {months.map((m) => {
          const rate = m.rate;
          const h = rate === null ? 0 : Math.max(2, Math.min(100, Math.max(0, rate)) * 0.8);
          return (
            <div key={m.month} className="flex h-full flex-col items-center justify-end gap-1" title={`${shortMonth(m.month)}: ${pct(rate)}`}>
              <span className={clsx("font-display text-[11px] font-bold", rate !== null && rate < 0 && "text-pink")}>
                {m.hasData ? pct(rate) : ""}
              </span>
              <div
                className={clsx(
                  "w-full max-w-11 rounded-t-md border-2 border-b-0 border-ink",
                  rate !== null && avg !== null && rate >= avg ? "bg-ink" : "bg-[#d4c8b2]"
                )}
                style={{ height: `${h}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid gap-1 sm:gap-2" style={{ gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` }}>
        {months.map((m) => (
          <span key={m.month} className="text-center font-display text-[10px] font-bold uppercase text-muted">
            {months.length > 8 ? shortMonth(m.month).slice(0, 1) : shortMonth(m.month)}
          </span>
        ))}
      </div>
      {best && worst && best.month !== worst.month ? (
        <p className="mt-3 text-sm font-semibold">
          Best: <b>{shortMonth(best.month)}, {pct(best.rate)}</b> · Toughest: <b>{shortMonth(worst.month)}, {pct(worst.rate)}</b>
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Categories against the usual month                                  */
/* ------------------------------------------------------------------ */

export function CategoryChanges({ report }: { report: FinanceReport }) {
  const rows = report.categories.filter((c) => c.usualPerMonth !== null);
  const isMonth = report.period.kind === "month";
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader title="Against your usual month" />
        <EmptyState>There are no earlier months to compare with yet.</EmptyState>
      </Card>
    );
  }
  const deltas = rows.map((c) => ({ ...c, delta: c.perMonth - (c.usualPerMonth ?? 0) })).sort((a, b) => b.delta - a.delta);
  const max = Math.max(1, ...deltas.map((d) => Math.abs(d.delta)));
  return (
    <Card className="print-avoid-break">
      <CardHeader
        title="Against your usual month"
        description={isMonth ? "Each category this month, against your usual month." : "Average per month in this period, against your usual month."}
      />
      <div className="space-y-2.5">
        {deltas.map((d) => {
          const more = d.delta > 0.5;
          const less = d.delta < -0.5;
          const width = (Math.abs(d.delta) / max) * 48;
          return (
            <div key={d.category} className="grid grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)_7rem]">
              <span className="flex min-w-0 items-center gap-1.5 font-bold">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(d.category) }} />
                <span className="truncate">{d.category}</span>
              </span>
              <div className="relative h-4" aria-hidden>
                <span className="absolute -inset-y-1 left-1/2 w-0.5 bg-ink" />
                {more || less ? (
                  <span
                    className={clsx("absolute inset-y-0 rounded-sm", more ? "left-1/2 bg-orange" : "right-1/2 bg-blue")}
                    style={{ width: `${Math.max(1.5, width)}%` }}
                  />
                ) : null}
              </div>
              <span className={clsx("text-right text-xs font-bold", more ? "text-[#a8320b]" : less ? "text-blue" : "text-muted")}>
                {more || less ? signedEUR(d.delta) : "same"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-xs font-semibold text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-blue" /> Spending less
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-orange" /> Spending more
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Small multiples: each category over the period                      */
/* ------------------------------------------------------------------ */

export function CategoryTrends({ report }: { report: FinanceReport }) {
  const months = report.period.months;
  const cats = report.categories.filter((c) => c.total > 0);
  if (months.length < 3 || cats.length === 0) return null;
  const W = 200;
  const H = 54;
  return (
    <Card className="print-avoid-break">
      <CardHeader title="Each category over time" description="One chart per category, each on its own scale. Tap one to see its transactions." />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cats.map((c) => {
          const max = Math.max(1, ...c.monthly);
          const x = (i: number) => 4 + (i / (months.length - 1)) * (W - 8);
          const y = (v: number) => H - 4 - (v / max) * (H - 12);
          const points = c.monthly.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
          const third = Math.max(1, Math.floor(months.length / 3));
          const early = c.monthly.slice(0, third).reduce((a, b) => a + b, 0) / third;
          const late = c.monthly.slice(-third).reduce((a, b) => a + b, 0) / third;
          const trend = late > early * 1.15 ? "rising" : late < early * 0.85 ? "easing" : "steady";
          return (
            <Link
              key={c.category}
              href={`/finance?${new URLSearchParams({ month: months[months.length - 1], cat: c.category })}#transactions`}
              className="brut-border block rounded-md bg-background p-2.5 hover:bg-yellow/40"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: categoryColor(c.category) }} />
                <span className="flex-1 truncate font-display text-xs font-bold">{c.category}</span>
                <span className={clsx("text-[10px] font-bold", trend === "rising" ? "text-[#a8320b]" : trend === "easing" ? "text-blue" : "text-muted")}>
                  {trend === "rising" ? "▲ rising" : trend === "easing" ? "▼ easing" : "steady"}
                </span>
              </span>
              <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 block h-12 w-full" role="img" aria-label={`${c.category} per month`}>
                <line x1={0} x2={W} y1={H - 2} y2={H - 2} stroke="var(--ink)" strokeWidth={1.5} />
                <polyline points={points} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {c.monthly.map((v, i) => (
                  <circle key={months[i]} cx={x(i)} cy={y(v)} r={i === c.monthly.length - 1 ? 3.5 : 2} fill={i === c.monthly.length - 1 ? "var(--orange)" : "var(--ink)"}>
                    <title>{`${shortMonth(months[i])}: ${formatEUR(v)}`}</title>
                  </circle>
                ))}
              </svg>
              <span className="mt-1 flex justify-between text-xs">
                <span className="font-semibold text-muted">total</span>
                <span className="font-bold">{formatEUR(c.total)}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Budgets                                                             */
/* ------------------------------------------------------------------ */

export function BudgetScorecard({ report }: { report: FinanceReport }) {
  const { budgets, period } = report;
  if (budgets.length === 0) return null;
  const isMonth = period.kind === "month";
  const kept = isMonth ? budgets.filter((b) => b.spent <= b.limit).length : budgets.reduce((s, b) => s + b.keptMonths, 0);
  const total = isMonth ? budgets.length : budgets.reduce((s, b) => s + b.months, 0);
  const over = budgets.filter((b) => (isMonth ? b.spent > b.limit : b.keptMonths < b.months));
  return (
    <Card className="print-avoid-break">
      <CardHeader
        title="Budgets kept"
        description={isMonth ? "Each category's monthly limit." : "Months each budget was kept."}
        action={<span className="font-display text-2xl font-bold">{kept} / {total}</span>}
      />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {budgets.map((b) => {
          const ok = isMonth ? b.spent <= b.limit : b.keptMonths === b.months;
          return (
            <div key={b.category} className={clsx("rounded-md border-2 border-ink px-3 py-2", ok ? "bg-green/15" : "bg-pink text-white")}>
              <p className="font-display text-sm font-bold">
                {ok ? "✓" : "✕"} {b.category}
              </p>
              <p className="text-xs font-semibold">
                {isMonth ? `${formatEUR(b.spent)} of ${formatEUR(b.limit)}` : `${b.keptMonths} of ${b.months} months`}
              </p>
            </div>
          );
        })}
      </div>
      {isMonth && over.length > 0 ? (
        <p className="mt-3 text-sm font-semibold">
          {over.map((b) => `${b.category} went ${formatEUR(b.spent - b.limit)} over`).join(" · ")}.
        </p>
      ) : null}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tags, places, income                                                */
/* ------------------------------------------------------------------ */

function Bars({ rows, empty }: { rows: { name: string; total: number; count: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm font-semibold text-muted">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate font-bold">{r.name}</span>
            <span className="shrink-0">
              <b>{formatEUR(r.total)}</b>
              <span className="text-muted"> · {r.count}×</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-background" aria-hidden>
            <div className="h-full rounded-full bg-ink" style={{ width: `${(r.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function TagsPlacesIncome({ report }: { report: FinanceReport }) {
  const totalIncome = report.income;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="print-avoid-break">
        <CardHeader title="Trips & tags" description="Everything you tagged in this period." />
        {report.tags.length === 0 ? (
          <p className="text-sm font-semibold text-muted">Nothing tagged in this period.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-[3px] border-ink text-left text-[10px] font-bold uppercase tracking-wide text-muted">
                  <th className="py-1.5">Tag</th>
                  <th className="py-1.5">When</th>
                  <th className="py-1.5 text-right">Total</th>
                  <th className="py-1.5 text-right">Per day</th>
                </tr>
              </thead>
              <tbody>
                {report.tags.slice(0, 8).map((t) => (
                  <tr key={t.tag} className="border-b border-ink/10">
                    <td className="py-2 font-bold text-blue">
                      <Link href={`/finance?${new URLSearchParams({ month: t.last.slice(0, 7), tag: t.tag })}#transactions`} className="hover:underline">
                        #{t.tag}
                      </Link>
                    </td>
                    <td className="py-2 text-muted">{t.first === t.last ? shortDate(t.first) : `${shortDate(t.first)}–${shortDate(t.last)}`}</td>
                    <td className="py-2 text-right font-bold">{formatEUR(t.total)}</td>
                    <td className="py-2 text-right">{t.perDay === null ? "—" : formatEUR(t.perDay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="print-avoid-break">
        <CardHeader title="Top places" description="Where most of the money went." />
        <Bars rows={report.places.slice(0, 6)} empty="No expenses in this period." />
      </Card>
      <Card className="print-avoid-break">
        <CardHeader title="Income" description="By source." />
        {report.incomeSources.length === 0 ? (
          <p className="text-sm font-semibold text-muted">No income logged in this period.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {report.incomeSources.map((s) => (
              <div key={s.name} className="flex justify-between gap-2">
                <span className="truncate font-bold">{s.name}</span>
                <span className="shrink-0 font-bold">{formatEUR(s.total)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t-[3px] border-ink pt-2">
              <span className="font-bold">Total</span>
              <span className="font-bold">{formatEUR(totalIncome)}</span>
            </div>
            {report.targets.set > 0 ? (
              <p className="pt-1 text-sm font-semibold text-muted">
                Income target reached in <b className="text-ink">{report.targets.hit} of {report.targets.set}</b>{" "}
                {report.targets.set === 1 ? "month" : "months"}.
              </p>
            ) : null}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Savings over the period: a waterfall                                */
/* ------------------------------------------------------------------ */

export function WealthWaterfall({ report }: { report: FinanceReport }) {
  if (report.wealth.length === 0) {
    return (
      <Card>
        <CardHeader title="Your savings" />
        <EmptyState>Needs two savings snapshots that cover this period. Save one on the Wealth page each month.</EmptyState>
      </Card>
    );
  }
  return (
    <Card className="print-avoid-break">
      <CardHeader
        title="Your savings over the period"
        description={`From the ${shortMonth(report.wealth[0].fromMonth)} ${report.wealth[0].fromMonth.slice(0, 4)} snapshot to the ${shortMonth(report.wealth[0].toMonth)} ${report.wealth[0].toMonth.slice(0, 4)} one.`}
      />
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {report.wealth.map((w) => {
          const money = (v: number) => formatMoney(v, w.currency);
          const top = Math.max(w.start, w.end, w.start + w.putIn, 1);
          const scale = (v: number) => (v / top) * 100;
          const steps = [
            { label: "Start", from: 0, to: w.start, value: money(w.start), kind: "total" },
            { label: "You put in", from: w.start, to: w.start + w.putIn, value: `${w.putIn >= 0 ? "+" : "−"}${money(Math.abs(w.putIn))}`, kind: "put" },
            { label: "Growth", from: w.start + w.putIn, to: w.end, value: `${w.growth >= 0 ? "+" : "−"}${money(Math.abs(w.growth))}`, kind: w.growth >= 0 ? "up" : "down" },
            { label: "End", from: 0, to: w.end, value: money(w.end), kind: "total" },
          ];
          return (
            <figure key={w.currency}>
              <figcaption className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{w.currency} savings</figcaption>
              <div className="grid h-44 grid-cols-4 gap-3 border-b-[3px] border-ink" aria-hidden>
                {steps.map((s) => {
                  const low = Math.min(s.from, s.to);
                  const high = Math.max(s.from, s.to);
                  return (
                    <div key={s.label} className="relative">
                      <span
                        className={clsx(
                          "absolute inset-x-[12%] rounded-sm border-2 border-ink",
                          s.kind === "total" ? "bg-[#d4c8b2]" : s.kind === "put" ? "bg-ink" : s.kind === "up" ? "bg-orange" : "bg-pink"
                        )}
                        style={{ bottom: `${scale(low) * 0.82}%`, height: `max(3px, ${(scale(high) - scale(low)) * 0.82}%)` }}
                      />
                      <span
                        className="absolute inset-x-0 text-center font-display text-[11px] font-bold"
                        style={{ bottom: `calc(${scale(high) * 0.82}% + 4px)` }}
                      >
                        {s.value}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 grid grid-cols-4 gap-3 text-center text-[11px] font-bold text-muted">
                {steps.map((s) => (
                  <span key={s.label}>{s.label}</span>
                ))}
              </div>
              <p className="sr-only">
                {`Savings went from ${money(w.start)} to ${money(w.end)}: ${money(w.putIn)} put in and ${money(w.growth)} growth.`}
              </p>
            </figure>
          );
        })}
      </div>
    </Card>
  );
}

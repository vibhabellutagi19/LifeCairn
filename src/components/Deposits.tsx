// The Wealth page's Deposits card. A server component: the figures come from
// src/lib/deposits.ts; only the eye toggle and the terms editor are client-side.

import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { PrivacyBlur } from "@/components/PrivacyBlur";
import { DepositTermsEditor, type DepositTermsValues } from "@/components/DepositTerms";
import { PAYOUT_LABEL, type DepositSummary, type DepositTerms } from "@/lib/deposits";
import { formatCurrencyTotals, formatMoney, sumByCurrency } from "@/lib/format";

export type DepositRow = {
  id: number;
  name: string;
  type: "fd" | "rd";
  currency: string;
  terms: DepositTerms | null;
  summary: DepositSummary | null;
};

/** Window for the "maturing soon" total, in days. */
const UPCOMING_DAYS = 90;

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatRate(rate: number) {
  return `${rate.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function StatusBadge({ summary, terms }: { summary: DepositSummary; terms: DepositTerms }) {
  const base = "brut-border shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase";
  switch (summary.status) {
    case "matured":
      return <span className={`${base} bg-yellow text-ink`}>Matured · renew or close</span>;
    case "soon":
      return (
        <span className={`${base} bg-orange text-white`}>
          {summary.daysLeft === 1 ? "Matures tomorrow" : `Matures in ${summary.daysLeft} days`}
        </span>
      );
    case "upcoming":
      return <span className={`${base} bg-background text-muted`}>Starts {formatDate(terms.start)}</span>;
    default:
      return null;
  }
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="private-value font-display text-base font-bold">{value}</dd>
      {note ? <dd className="text-[11px] font-semibold text-muted">{note}</dd> : null}
    </div>
  );
}

function DepositItem({ row }: { row: DepositRow }) {
  const { terms, summary, currency } = row;
  const money = (value: number) => formatMoney(value, currency);
  const initial: DepositTermsValues | null = terms
    ? {
        amount: String(terms.amount),
        rate: String(terms.rate),
        start: terms.start,
        maturity: terms.maturity,
        payout: terms.payout,
      }
    : null;

  return (
    <li className="brut-border rounded-md bg-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-bold" title={row.name}>
              {row.name}
            </p>
            <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
              {row.type === "rd" ? "RD" : "FD"} · {currency}
            </span>
            {terms && summary ? <StatusBadge summary={summary} terms={terms} /> : null}
          </div>
          <p className="mt-0.5 text-xs font-semibold text-muted">
            {terms
              ? `${formatRate(terms.rate)} · ${
                  terms.type === "rd" ? `${money(terms.amount)} a month` : PAYOUT_LABEL[terms.payout]
                } · ${formatDate(terms.start)} → ${formatDate(terms.maturity)}`
              : "Add the rate and dates to see interest and when it matures."}
          </p>
        </div>
        <DepositTermsEditor id={row.id} name={row.name} type={row.type} initial={initial} />
      </div>

      {terms && summary ? (
        <>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-background"
            role="progressbar"
            aria-label={`${row.name}: share of the term passed`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.elapsed * 100)}
          >
            <div
              className={clsx("h-full rounded-full", summary.status === "matured" ? "bg-green" : "bg-orange")}
              style={{ width: `${Math.max(2, summary.elapsed * 100)}%` }}
            />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
            {terms.payout === "maturity" ? (
              <Figure
                label={summary.status === "matured" ? "Paid out" : "Worth now"}
                value={money(summary.valueNow)}
                note={terms.type === "rd" ? `${money(summary.deposited)} paid in` : undefined}
              />
            ) : (
              <Figure label="Principal" value={money(summary.deposited)} />
            )}
            <Figure
              label="At maturity"
              value={money(summary.maturityValue)}
              note={terms.payout === "maturity" ? undefined : "Principal back"}
            />
            <Figure
              label={terms.payout === "maturity" ? "Interest so far" : "Interest paid so far"}
              value={money(summary.interestSoFar)}
              note={`of ${money(summary.totalInterest)}`}
            />
            {summary.payoutAmount !== null ? (
              <Figure
                label={terms.payout === "monthly" ? "Each month" : "Each quarter"}
                value={money(summary.payoutAmount)}
                note={summary.nextPayout ? `Next ${formatDate(summary.nextPayout)}` : "No payouts left"}
              />
            ) : (
              <Figure
                label={summary.status === "matured" ? "Matured" : "Time left"}
                value={
                  summary.status === "matured"
                    ? formatDate(terms.maturity)
                    : summary.daysLeft >= 60
                      ? `${Math.round(summary.daysLeft / 30.4)} months`
                      : `${summary.daysLeft} days`
                }
              />
            )}
          </dl>
        </>
      ) : null}
    </li>
  );
}

const STATUS_ORDER = { matured: 0, soon: 1, active: 2, upcoming: 3 } as const;

export function DepositsCard({ rows }: { rows: DepositRow[] }) {
  const withTerms = rows.filter(
    (row): row is DepositRow & { terms: DepositTerms; summary: DepositSummary } => !!row.terms && !!row.summary
  );
  const sorted = [
    ...withTerms.sort(
      (a, b) =>
        STATUS_ORDER[a.summary.status] - STATUS_ORDER[b.summary.status] ||
        a.terms.maturity.localeCompare(b.terms.maturity)
    ),
    ...rows.filter((row) => !row.terms),
  ];

  const live = withTerms.filter((row) => row.summary.status !== "matured");
  const deposited = sumByCurrency(live, (r) => r.summary.deposited, (r) => r.currency);
  const interest = sumByCurrency(live, (r) => r.summary.interestSoFar, (r) => r.currency);
  const maturingSoon = live.filter((r) => r.summary.daysLeft <= UPCOMING_DAYS);
  const maturingTotal = sumByCurrency(maturingSoon, (r) => r.summary.maturityValue, (r) => r.currency);
  const payoutRows = live.filter((r) => r.summary.monthlyIncome > 0);
  const monthlyIncome = sumByCurrency(payoutRows, (r) => r.summary.monthlyIncome, (r) => r.currency);
  const matured = withTerms.length - live.length;

  return (
    <Card className="flex flex-col">
      <PrivacyBlur
        storageKey="lifecairn:finance:networth-hidden"
        label="deposit amounts"
        title="Deposits"
        description="Your FDs and RDs: interest, maturity and payouts. Estimates before tax."
      >
        {withTerms.length > 0 ? (
          <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="brut-border rounded-md bg-background p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">In deposits</dt>
              <dd className="private-value font-display text-lg font-bold">{formatCurrencyTotals(deposited)}</dd>
            </div>
            <div className="brut-border rounded-md bg-background p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Interest so far</dt>
              <dd className="private-value font-display text-lg font-bold text-green">
                {formatCurrencyTotals(interest)}
              </dd>
            </div>
            <div className="brut-border rounded-md bg-background p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Maturing in {UPCOMING_DAYS} days
              </dt>
              <dd className="private-value font-display text-lg font-bold">
                {maturingSoon.length > 0 ? formatCurrencyTotals(maturingTotal) : "Nothing"}
              </dd>
              {maturingSoon.length > 0 ? (
                <dd className="text-[11px] font-semibold text-muted">
                  {maturingSoon.length} deposit{maturingSoon.length === 1 ? "" : "s"}
                </dd>
              ) : null}
            </div>
            <div className="brut-border rounded-md bg-background p-3">
              <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">Interest payouts</dt>
              <dd className="private-value font-display text-lg font-bold">
                {payoutRows.length > 0 ? `≈ ${formatCurrencyTotals(monthlyIncome)}` : "None"}
              </dd>
              <dd className="text-[11px] font-semibold text-muted">
                {payoutRows.length > 0 ? "a month, on average" : "All paid at maturity"}
              </dd>
            </div>
          </dl>
        ) : null}

        {matured > 0 ? (
          <p className="mb-3 text-sm font-bold">
            {matured === 1 ? "1 deposit has" : `${matured} deposits have`} matured. Renew with new terms, or delete
            under Update values once the money has moved.
          </p>
        ) : null}

        <ul className="space-y-2">
          {sorted.map((row) => (
            <DepositItem key={row.id} row={row} />
          ))}
        </ul>
      </PrivacyBlur>
    </Card>
  );
}

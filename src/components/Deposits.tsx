// The Wealth page's Deposits card. A server component: the figures come from
// src/lib/deposits.ts; only the eye toggle and the terms editor are client-side.
// One compact row per deposit; tap it to see the details and edit the terms.

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

type FullRow = DepositRow & { terms: DepositTerms; summary: DepositSummary };

/** Window for the "maturing soon" total, in days. */
const UPCOMING_DAYS = 90;

function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function formatRate(rate: number) {
  return `${rate.toFixed(2).replace(/\.?0+$/, "")}%`;
}

function timeLeft(days: number) {
  if (days <= 0) return "Matured";
  if (days === 1) return "Tomorrow";
  if (days < 60) return `${days} days`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `${months} months` : `${(days / 365).toFixed(1).replace(/\.0$/, "")} years`;
}

/** One line under the name: what kind of deposit this is, in plain words. */
function metaLine({ terms, summary, currency }: FullRow) {
  const rate = formatRate(terms.rate);
  if (terms.type === "rd") {
    return `${formatMoney(terms.amount, currency)}/month · ${summary.instalmentsPaid} of ${summary.instalmentsTotal} paid · ${rate}`;
  }
  return `${rate} · ${terms.payout === "maturity" ? "interest at maturity" : PAYOUT_LABEL[terms.payout].toLowerCase()}`;
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

function Figures({ row }: { row: FullRow }) {
  const { terms, summary, currency } = row;
  const money = (value: number) => formatMoney(value, currency);
  const interest = (
    <Figure
      label={terms.payout === "maturity" ? "Interest so far" : "Interest paid so far"}
      value={money(summary.interestSoFar)}
      note={`of ${money(summary.totalInterest)}`}
    />
  );
  const matures = (
    <Figure
      label={summary.status === "matured" ? "Matured on" : "Matures"}
      value={formatDate(terms.maturity)}
      note={summary.status === "matured" ? "Renew or close it" : `in ${timeLeft(summary.daysLeft)}`}
    />
  );

  if (terms.type === "rd") {
    return (
      <>
        <Figure
          label="Deducted monthly"
          value={money(terms.amount)}
          note={summary.nextInstalment ? `Next ${formatDate(summary.nextInstalment)}` : "All deductions done"}
        />
        <Figure
          label="Paid in"
          value={money(summary.deposited)}
          note={`${summary.instalmentsPaid} of ${summary.instalmentsTotal} months`}
        />
        {interest}
        <Figure label="At maturity" value={money(summary.maturityValue)} note={`on ${formatDate(terms.maturity)}`} />
      </>
    );
  }
  if (terms.payout === "maturity") {
    return (
      <>
        <Figure label="Worth now" value={money(summary.valueNow)} note={`${money(terms.amount)} put in`} />
        {interest}
        <Figure label="At maturity" value={money(summary.maturityValue)} />
        {matures}
      </>
    );
  }
  return (
    <>
      <Figure
        label={terms.payout === "monthly" ? "Paid each month" : "Paid each quarter"}
        value={money(summary.payoutAmount ?? 0)}
        note={summary.nextPayout ? `Next ${formatDate(summary.nextPayout)}` : "No payouts left"}
      />
      {interest}
      <Figure label="Principal" value={money(terms.amount)} note="Comes back at maturity" />
      {matures}
    </>
  );
}

function StatusText({ summary }: { summary: DepositSummary }) {
  if (summary.status === "matured") {
    return <span className="rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase text-ink">Matured</span>;
  }
  if (summary.status === "soon") {
    return (
      <span className="rounded-full bg-orange px-2 py-0.5 text-[10px] font-bold uppercase text-white">
        {timeLeft(summary.daysLeft)}
      </span>
    );
  }
  if (summary.status === "upcoming") return <span className="text-[11px] font-semibold text-muted">Not started</span>;
  return <span className="text-[11px] font-semibold text-muted">in {timeLeft(summary.daysLeft)}</span>;
}

function Chevron() {
  return (
    <span aria-hidden className="shrink-0 text-xs font-bold text-muted transition-transform group-open/dep:rotate-180">
      ▼
    </span>
  );
}

function DepositItem({ row }: { row: DepositRow }) {
  const { terms, summary } = row;
  const kindChip = (
    <span className="shrink-0 rounded-full bg-background px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">
      {row.type === "rd" ? "RD" : "FD"}
    </span>
  );
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
    <li>
      <details className="group/dep">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 hover:bg-background sm:px-4 [&::-webkit-details-marker]:hidden">
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-bold">{row.name}</span>
              {kindChip}
            </p>
            <p className="truncate text-xs font-semibold text-muted">
              {terms && summary ? metaLine(row as FullRow) : "No rate or dates yet"}
            </p>
            {summary ? (
              <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                <span
                  className={clsx("block h-full rounded-full", summary.status === "matured" ? "bg-green" : "bg-orange")}
                  style={{ width: `${Math.max(2, summary.elapsed * 100)}%` }}
                />
              </span>
            ) : null}
          </div>
          {terms && summary ? (
            <div className="shrink-0 text-right">
              <p className="private-value font-display font-bold leading-tight">
                {formatMoney(summary.maturityValue, row.currency)}
              </p>
              <StatusText summary={summary} />
            </div>
          ) : (
            <span className="shrink-0 rounded-md bg-blue px-2.5 py-1 text-[11px] font-bold uppercase text-white">
              Add terms
            </span>
          )}
          <Chevron />
        </summary>

        <div className="space-y-3 border-t-2 border-ink/10 bg-background px-3 py-3 sm:px-4">
          {terms && summary ? (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                <Figures row={row as FullRow} />
              </dl>
              <p className="text-[11px] font-semibold text-muted">
                Started {formatDate(terms.start)}. Estimate before tax.
              </p>
            </>
          ) : null}
          <DepositTermsEditor id={row.id} name={row.name} type={row.type} initial={initial} />
        </div>
      </details>
    </li>
  );
}

const STATUS_ORDER = { matured: 0, soon: 1, active: 2, upcoming: 3 } as const;

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="brut-border min-w-0 rounded-md bg-background p-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      {children}
    </div>
  );
}

export function DepositsCard({ rows }: { rows: DepositRow[] }) {
  const withTerms = rows.filter((row): row is FullRow => !!row.terms && !!row.summary);
  const sorted = [
    ...[...withTerms].sort(
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
  const deductions = sumByCurrency(live, (r) => r.summary.monthlyDeduction, (r) => r.currency);
  const payouts = sumByCurrency(live, (r) => r.summary.monthlyIncome, (r) => r.currency);
  const hasDeductions = live.some((r) => r.summary.monthlyDeduction > 0);
  const hasPayouts = live.some((r) => r.summary.monthlyIncome > 0);
  const matured = withTerms.length - live.length;

  return (
    <Card className="flex flex-col">
      <PrivacyBlur
        storageKey="lifecairn:finance:networth-hidden"
        label="deposit amounts"
        title="Deposits"
        description="FDs and RDs: what they're worth and when they mature. Tap one for details."
      >
        {withTerms.length > 0 ? (
          <dl className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <Tile label="In deposits">
              <dd className="private-value font-display text-lg font-bold">{formatCurrencyTotals(deposited)}</dd>
            </Tile>
            <Tile label="Interest so far">
              <dd className="private-value font-display text-lg font-bold text-green">{formatCurrencyTotals(interest)}</dd>
            </Tile>
            <Tile label={`Maturing · ${UPCOMING_DAYS} days`}>
              <dd className="private-value font-display text-lg font-bold">
                {maturingSoon.length > 0 ? formatCurrencyTotals(maturingTotal) : "Nothing"}
              </dd>
              {maturingSoon.length > 0 ? (
                <dd className="text-[11px] font-semibold text-muted">
                  {maturingSoon.length} deposit{maturingSoon.length === 1 ? "" : "s"}
                </dd>
              ) : null}
            </Tile>
            <Tile label="Each month">
              {hasDeductions ? (
                <dd className="private-value text-sm font-bold">−{formatCurrencyTotals(deductions)} into RDs</dd>
              ) : null}
              {hasPayouts ? (
                <dd className="private-value text-sm font-bold text-green">
                  +≈{formatCurrencyTotals(payouts)} interest
                </dd>
              ) : null}
              {!hasDeductions && !hasPayouts ? (
                <dd className="text-sm font-bold text-muted">Nothing in or out</dd>
              ) : null}
            </Tile>
          </dl>
        ) : null}

        {matured > 0 ? (
          <p className="mb-3 rounded-md bg-yellow/50 px-3 py-2 text-sm font-bold">
            {matured === 1 ? "1 deposit has" : `${matured} deposits have`} matured: renew with new terms, or delete
            under Update values once the money has moved.
          </p>
        ) : null}

        <ul className="brut-border divide-y-2 divide-ink/10 overflow-hidden rounded-md bg-surface">
          {sorted.map((row) => (
            <DepositItem key={row.id} row={row} />
          ))}
        </ul>
      </PrivacyBlur>
    </Card>
  );
}

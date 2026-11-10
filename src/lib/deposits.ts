// Fixed and recurring deposits: everything here is derived from the terms on
// the account (amount, rate, dates, payout) and is an estimate before tax.
// Compounding follows the usual bank convention for the currency: quarterly
// for INR deposits, yearly for EUR ones.

export const DEPOSIT_TYPES = ["fd", "rd"] as const;
export type DepositType = (typeof DEPOSIT_TYPES)[number];

export const INTEREST_PAYOUTS = ["maturity", "monthly", "quarterly"] as const;
export type InterestPayout = (typeof INTEREST_PAYOUTS)[number];

export const PAYOUT_LABEL: Record<InterestPayout, string> = {
  maturity: "Paid at maturity",
  monthly: "Paid monthly",
  quarterly: "Paid quarterly",
};

export function isDepositType(type: string): type is DepositType {
  return DEPOSIT_TYPES.includes(type as DepositType);
}

export function isInterestPayout(value: string): value is InterestPayout {
  return INTEREST_PAYOUTS.includes(value as InterestPayout);
}

export type DepositTerms = {
  type: DepositType;
  /** FD principal, or RD monthly instalment. */
  amount: number;
  /** % per year. */
  rate: number;
  start: string;
  maturity: string;
  payout: InterestPayout;
  currency: string;
};

type AccountLike = {
  type: string;
  currency: string;
  depositAmount: string | null;
  interestRate: string | null;
  depositStart: string | null;
  depositMaturity: string | null;
  interestPayout: string | null;
};

/** The account's deposit terms, or null when it isn't a deposit or any term is missing. */
export function depositTermsOf(account: AccountLike): DepositTerms | null {
  const { type, depositAmount, interestRate, depositStart, depositMaturity } = account;
  if (!isDepositType(type) || !depositAmount || !interestRate || !depositStart || !depositMaturity) return null;
  const payout = type === "rd" ? "maturity" : account.interestPayout ?? "maturity";
  return {
    type,
    amount: Number(depositAmount),
    rate: Number(interestRate),
    start: depositStart,
    maturity: depositMaturity,
    payout: isInterestPayout(payout) ? payout : "maturity",
    currency: account.currency,
  };
}

/* ------------------------------------------------------------------ */
/* Date helpers on yyyy-MM-dd strings (UTC, so no DST surprises).      */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(from: string, to: string) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

/** Same day of the month, `months` later; clamped to the month's last day (31 Jan + 1 → 28/29 Feb). */
export function addMonthsISO(iso: string, months: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Whole months from `from` to `to` (an instalment/payout schedule step count). */
function monthsBetween(from: string, to: string) {
  let n = 0;
  while (addMonthsISO(from, n + 1) <= to) n++;
  return n;
}

const minISO = (a: string, b: string) => (a < b ? a : b);

/* ------------------------------------------------------------------ */
/* The maths                                                           */
/* ------------------------------------------------------------------ */

function compoundsPerYear(currency: string) {
  return currency === "EUR" ? 1 : 4;
}

function grow(principal: number, rate: number, from: string, to: string, perYear: number) {
  const years = Math.max(0, daysBetween(from, to)) / 365;
  return principal * Math.pow(1 + rate / 100 / perYear, perYear * years);
}

export type DepositStatus = "upcoming" | "active" | "soon" | "matured";

export type DepositSummary = {
  /** What has gone in so far (RD: instalments paid so far). */
  deposited: number;
  /** What the deposit is worth today (payout FDs stay at the principal). */
  valueNow: number;
  /** Interest earned so far: accrued, or paid out for payout FDs. */
  interestSoFar: number;
  /** What comes back at maturity (payout FDs: the principal). */
  maturityValue: number;
  /** All the interest over the full term. */
  totalInterest: number;
  /** Interest per payout for monthly/quarterly FDs. */
  payoutAmount: number | null;
  /** Interest per month on average from payout FDs, for the overall picture. */
  monthlyIncome: number;
  nextPayout: string | null;
  daysLeft: number;
  /** Share of the term that has passed, 0–1. */
  elapsed: number;
  status: DepositStatus;
};

/** Days before maturity at which a deposit counts as maturing soon. */
export const MATURING_SOON_DAYS = 30;

export function summarizeDeposit(terms: DepositTerms, today: string): DepositSummary {
  const { amount, rate, start, maturity, currency } = terms;
  const perYear = compoundsPerYear(currency);
  const asOf = minISO(today, maturity);
  const started = today >= start;
  const term = Math.max(1, daysBetween(start, maturity));
  const elapsed = started ? Math.min(1, daysBetween(start, asOf) / term) : 0;
  const daysLeft = daysBetween(today, maturity);
  const status: DepositStatus = !started
    ? "upcoming"
    : daysLeft <= 0
      ? "matured"
      : daysLeft <= MATURING_SOON_DAYS
        ? "soon"
        : "active";

  let deposited: number;
  let valueNow: number;
  let maturityValue: number;
  let totalInterest: number;
  let payoutAmount: number | null = null;
  let monthlyIncome = 0;
  let nextPayout: string | null = null;

  if (terms.type === "rd") {
    // One instalment on the start date and on the same day each month after,
    // each growing from the day it went in.
    const count = Math.max(1, monthsBetween(start, maturity));
    let paid = 0;
    valueNow = 0;
    maturityValue = 0;
    for (let k = 0; k < count; k++) {
      const date = addMonthsISO(start, k);
      maturityValue += grow(amount, rate, date, maturity, perYear);
      if (date <= today) {
        paid++;
        valueNow += grow(amount, rate, date, asOf, perYear);
      }
    }
    deposited = paid * amount;
    totalInterest = maturityValue - count * amount;
  } else if (terms.payout === "maturity") {
    deposited = amount;
    valueNow = started ? grow(amount, rate, start, asOf, perYear) : amount;
    maturityValue = grow(amount, rate, start, maturity, perYear);
    totalInterest = maturityValue - amount;
  } else {
    // Interest is paid out every month or quarter, so the principal stays put.
    const step = terms.payout === "monthly" ? 1 : 3;
    payoutAmount = (amount * rate) / 100 / (12 / step);
    const totalPayouts = Math.floor(monthsBetween(start, maturity) / step);
    const paidPayouts = started ? Math.floor(monthsBetween(start, asOf) / step) : 0;
    deposited = amount;
    valueNow = amount;
    maturityValue = amount;
    totalInterest = payoutAmount * totalPayouts;
    if (status !== "matured") {
      monthlyIncome = (amount * rate) / 100 / 12;
      const next = addMonthsISO(start, (paidPayouts + 1) * step);
      nextPayout = next <= maturity ? next : null;
    }
    return {
      deposited,
      valueNow,
      interestSoFar: payoutAmount * paidPayouts,
      maturityValue,
      totalInterest,
      payoutAmount,
      monthlyIncome,
      nextPayout,
      daysLeft,
      elapsed,
      status,
    };
  }

  return {
    deposited,
    valueNow,
    interestSoFar: Math.max(0, valueNow - deposited),
    maturityValue,
    totalInterest,
    payoutAmount,
    monthlyIncome,
    nextPayout,
    daysLeft,
    elapsed,
    status,
  };
}

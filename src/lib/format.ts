export function formatINR(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatEUR(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "€0";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateLong(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export const CURRENCIES = ["INR", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isCurrency(value: unknown): value is Currency {
  return CURRENCIES.includes(value as Currency);
}

export function formatMoney(value: number | string, currency: string) {
  return currency === "EUR" ? formatEUR(value) : formatINR(value);
}

export type CurrencyTotals = Record<Currency, number>;

// Savings can be in different currencies; totals are kept apart rather than converted.
export function sumByCurrency<T>(
  rows: T[],
  amount: (row: T) => number | string,
  currency: (row: T) => string
): CurrencyTotals {
  const totals: CurrencyTotals = { INR: 0, EUR: 0 };
  for (const row of rows) {
    const key: Currency = currency(row) === "EUR" ? "EUR" : "INR";
    totals[key] += Number(amount(row)) || 0;
  }
  return totals;
}

// "₹1,20,000 · €3,500"; currencies with nothing in them are left out (₹0 if all are empty).
export function formatCurrencyTotals(totals: CurrencyTotals) {
  const parts = CURRENCIES.filter((c) => totals[c] !== 0).map((c) => formatMoney(totals[c], c));
  return parts.length > 0 ? parts.join(" · ") : formatINR(0);
}

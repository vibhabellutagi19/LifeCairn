// Small helpers shared by the Finance and Wealth pages.
import { currentMonthKey } from "@/lib/dates";
import { CURRENCIES, formatMoney, type CurrencyTotals } from "@/lib/format";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** The ?month= param if valid, else the current month. */
export function resolveMonth(requested: string | undefined) {
  return requested && MONTH_RE.test(requested) ? requested : currentMonthKey();
}

export function formatMonthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** Link to a Finance page for a month, e.g. financeHref("2026-10", "/finance/wealth"). */
export function financeHref(month: string, path = "/finance") {
  return `${path}?${new URLSearchParams({ month }).toString()}`;
}

/** Gain/loss per currency with an explicit sign, e.g. "+₹4,200 · -€150". */
export function formatSignedTotals(totals: CurrencyTotals) {
  const parts = CURRENCIES.filter((c) => totals[c] !== 0).map(
    (c) => `${totals[c] > 0 ? "+" : ""}${formatMoney(totals[c], c)}`
  );
  return parts.length > 0 ? parts.join(" · ") : formatMoney(0, "INR");
}

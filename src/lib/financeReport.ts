// Finance reports for any period: totals, month-by-month, categories against
// your usual month, tags, places, income sources, budgets, targets and how the
// savings snapshots moved. Everything is derived from stored entries and
// snapshots; nothing here is stored. Used by /finance/reports and the monthly
// Telegram digest.

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeBudgets,
  financeEntries,
  financeSnapshotItems,
  financeSnapshots,
  financeTargets,
} from "@/db/schema";
import { currentMonthKey, monthRangeISO, shiftMonthKey, todayISO } from "@/lib/dates";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import { depositTermsOf, summarizeDeposit } from "@/lib/deposits";
import { CURRENCIES, type Currency } from "@/lib/format";

/* ------------------------------------------------------------------ */
/* Periods                                                             */
/* ------------------------------------------------------------------ */

export type PeriodKind = "month" | "quarter" | "year" | "custom";

export type Period = {
  kind: PeriodKind;
  /** First and last month, yyyy-MM. */
  from: string;
  to: string;
  months: string[];
  /** "October 2026", "Q3 2026", "2026", "Jan 2026 – Oct 2026". */
  label: string;
  /** True when the period runs into the current month (figures are "so far"). */
  ongoing: boolean;
};

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthsBetween(from: string, to: string) {
  const out: string[] = [];
  for (let m = from; m <= to && out.length < 120; m = shiftMonthKey(m, 1)) out.push(m);
  return out;
}

function monthName(month: string, style: "long" | "short" = "long") {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: style, year: "numeric" });
}

function build(kind: PeriodKind, from: string, to: string, label: string): Period {
  const now = currentMonthKey();
  const end = to > now ? now : to;
  return { kind, from, to: end, months: monthsBetween(from, end), label, ongoing: end === now };
}

/**
 * Reads ?p=month|quarter|year|custom&at=…&from=…&to=… . Defaults to last month,
 * the most recent finished one. Months after the current one are cut off.
 */
export function parsePeriod(params: { p?: string; at?: string; from?: string; to?: string }): Period {
  const now = currentMonthKey();
  const kind = (["month", "quarter", "year", "custom"] as const).find((k) => k === params.p) ?? "month";
  const at = params.at ?? "";

  if (kind === "year") {
    const year = /^\d{4}$/.test(at) ? at : now.slice(0, 4);
    return build("year", `${year}-01`, `${year}-12`, year);
  }
  if (kind === "quarter") {
    const m = at.match(/^(\d{4})-Q([1-4])$/);
    const year = m ? m[1] : now.slice(0, 4);
    const q = m ? Number(m[2]) : Math.floor((Number(now.slice(5, 7)) - 1) / 3) + 1;
    const first = `${year}-${String((q - 1) * 3 + 1).padStart(2, "0")}`;
    return build("quarter", first, shiftMonthKey(first, 2), `Q${q} ${year}`);
  }
  if (kind === "custom") {
    let from = MONTH_RE.test(params.from ?? "") ? params.from! : shiftMonthKey(now, -5);
    let to = MONTH_RE.test(params.to ?? "") ? params.to! : now;
    if (from > to) [from, to] = [to, from];
    if (monthsBetween(from, to).length > 60) from = shiftMonthKey(to, -59);
    return build("custom", from, to, `${monthName(from, "short")} – ${monthName(to > now ? now : to, "short")}`);
  }
  const month = MONTH_RE.test(at) ? at : shiftMonthKey(now, -1);
  return build("month", month, month, monthName(month));
}

/** The period just before (‹) or after (›) this one, as URL params; custom shifts by its length. */
export function shiftPeriod(period: Period, step: -1 | 1): Record<string, string> {
  switch (period.kind) {
    case "month":
      return { p: "month", at: shiftMonthKey(period.from, step) };
    case "quarter": {
      const first = shiftMonthKey(period.from, step * 3);
      return { p: "quarter", at: `${first.slice(0, 4)}-Q${Math.floor((Number(first.slice(5, 7)) - 1) / 3) + 1}` };
    }
    case "year":
      return { p: "year", at: String(Number(period.from.slice(0, 4)) + step) };
    default: {
      const n = period.months.length;
      return { p: "custom", from: shiftMonthKey(period.from, step * n), to: shiftMonthKey(period.to, step * n) };
    }
  }
}

/* ------------------------------------------------------------------ */
/* The report                                                          */
/* ------------------------------------------------------------------ */

export type MonthFigures = {
  month: string;
  income: number;
  expense: number;
  kept: number;
  /** Kept as a share of income; null without income. */
  rate: number | null;
  target: number | null;
  hasData: boolean;
};

export type CategoryFigures = {
  category: string;
  total: number;
  perMonth: number;
  /** Average per month in the usual-month baseline; null without baseline data. */
  usualPerMonth: number | null;
  monthly: number[];
};

export type TagFigures = { tag: string; total: number; count: number; first: string; last: string; perDay: number | null };
export type PlaceFigures = { name: string; total: number; count: number };
export type WealthMove = {
  currency: Currency;
  fromMonth: string;
  toMonth: string;
  start: number;
  end: number;
  putIn: number;
  growth: number;
};

export type Highlights = {
  noSpendDays: number;
  /** Same count for the month before, for comparison (null when it had no data). */
  noSpendDaysBefore: number | null;
  biggest: { source: string; amount: number; date: string } | null;
  runnerUp: { source: string; amount: number } | null;
  topTag: { tag: string; total: number; days: number } | null;
  /** Date the month's income reached its target, if it did. */
  targetReachedOn: string | null;
  /** Rank of this month's kept amount among every month with data (1 = best). */
  rank: { position: number; of: number } | null;
  maturing: { name: string; date: string; amount: number; currency: string }[];
};

export type FinanceReport = {
  period: Period;
  income: number;
  expense: number;
  kept: number;
  rate: number | null;
  months: MonthFigures[];
  /** Months of the six before the period that have any entries: the "usual month". */
  baselineMonths: string[];
  usual: { income: number; expense: number; kept: number; rate: number | null } | null;
  categories: CategoryFigures[];
  tags: TagFigures[];
  places: PlaceFigures[];
  incomeSources: PlaceFigures[];
  budgets: { category: string; limit: number; spent: number; keptMonths: number; months: number }[];
  targets: { set: number; hit: number };
  wealth: WealthMove[];
  highlights: Highlights | null;
};

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const rateOf = (income: number, expense: number) => (income > 0 ? ((income - expense) / income) * 100 : null);

function daysBetweenISO(a: string, b: string) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Groups rows by a case-insensitive name, keeping the most recent spelling. */
function groupByName(rows: { source: string; amount: number }[]) {
  const map = new Map<string, PlaceFigures>();
  for (const row of rows) {
    const key = row.source.trim().toLowerCase();
    const item = map.get(key) ?? { name: row.source.trim(), total: 0, count: 0 };
    item.total += row.amount;
    item.count += 1;
    map.set(key, item);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export async function buildReport(userId: string, period: Period): Promise<FinanceReport> {
  const today = todayISO();
  const start = monthRangeISO(period.from).start;
  const lastDay = monthRangeISO(period.to).end;
  const end = lastDay > today ? today : lastDay;
  const baselineAll = monthsBetween(shiftMonthKey(period.from, -6), shiftMonthKey(period.from, -1));
  const baselineStart = monthRangeISO(baselineAll[0]).start;
  const isMonth = period.kind === "month";
  // A month report also needs the month before (no-spend comparison) and every
  // month ever (rank); fetch from the earliest of those.
  const fetchFrom = isMonth ? "2000-01-01" : baselineStart;

  const [rows, budgetRows, targetRows, snapshotRows, accounts] = await Promise.all([
    db
      .select({
        date: financeEntries.date,
        type: financeEntries.type,
        source: financeEntries.source,
        category: financeEntries.category,
        amount: financeEntries.amount,
        tags: financeEntries.tags,
      })
      .from(financeEntries)
      .where(and(eq(financeEntries.userId, userId), gte(financeEntries.date, fetchFrom), lte(financeEntries.date, end)))
      .orderBy(asc(financeEntries.date), asc(financeEntries.id)),
    db.select().from(financeBudgets).where(eq(financeBudgets.userId, userId)),
    db
      .select()
      .from(financeTargets)
      .where(and(eq(financeTargets.userId, userId), gte(financeTargets.month, period.from), lte(financeTargets.month, period.to))),
    db
      .select({
        month: financeSnapshots.month,
        currency: financeSnapshotItems.currency,
        invested: financeSnapshotItems.investedAmount,
        current: financeSnapshotItems.currentValue,
      })
      .from(financeSnapshotItems)
      .innerJoin(financeSnapshots, eq(financeSnapshotItems.snapshotId, financeSnapshots.id))
      .where(and(eq(financeSnapshotItems.userId, userId), lte(financeSnapshots.month, period.to))),
    isMonth ? db.select().from(financeAccounts).where(eq(financeAccounts.userId, userId)) : Promise.resolve([]),
  ]);

  const entries = rows.map((r) => ({ ...r, amount: Number(r.amount), month: r.date.slice(0, 7) }));
  const inPeriod = entries.filter((e) => e.date >= start && e.date <= end);
  const expenses = inPeriod.filter((e) => e.type === "expense");
  const incomes = inPeriod.filter((e) => e.type === "income");
  const targetsByMonth = new Map(targetRows.map((t) => [t.month, Number(t.targetAmount)]));

  const figuresFor = (month: string): MonthFigures => {
    const mine = entries.filter((e) => e.month === month);
    const income = sum(mine.filter((e) => e.type === "income").map((e) => e.amount));
    const expense = sum(mine.filter((e) => e.type === "expense").map((e) => e.amount));
    return {
      month,
      income,
      expense,
      kept: income - expense,
      rate: rateOf(income, expense),
      target: targetsByMonth.get(month) ?? null,
      hasData: mine.length > 0,
    };
  };
  const months = period.months.map(figuresFor);
  const income = sum(incomes.map((e) => e.amount));
  const expense = sum(expenses.map((e) => e.amount));

  // The usual month: the six months before the period, counting only months with entries.
  const baselineMonths = baselineAll.filter((m) => entries.some((e) => e.month === m));
  const baselineEntries = entries.filter((e) => baselineMonths.includes(e.month));
  const n = baselineMonths.length;
  const usual =
    n > 0
      ? (() => {
          const i = sum(baselineEntries.filter((e) => e.type === "income").map((e) => e.amount)) / n;
          const x = sum(baselineEntries.filter((e) => e.type === "expense").map((e) => e.amount)) / n;
          return { income: i, expense: x, kept: i - x, rate: rateOf(i, x) };
        })()
      : null;

  const categories: CategoryFigures[] = EXPENSE_CATEGORIES.map((category) => {
    const mine = expenses.filter((e) => e.category === category);
    const total = sum(mine.map((e) => e.amount));
    const base = baselineEntries.filter((e) => e.type === "expense" && e.category === category);
    return {
      category,
      total,
      perMonth: total / period.months.length,
      usualPerMonth: n > 0 ? sum(base.map((e) => e.amount)) / n : null,
      monthly: period.months.map((m) => sum(mine.filter((e) => e.month === m).map((e) => e.amount))),
    };
  })
    .filter((c) => c.total > 0 || (c.usualPerMonth ?? 0) > 0)
    .sort((a, b) => b.total - a.total);

  const tagMap = new Map<string, TagFigures>();
  for (const e of expenses) {
    for (const tag of e.tags) {
      const t = tagMap.get(tag) ?? { tag, total: 0, count: 0, first: e.date, last: e.date, perDay: null };
      t.total += e.amount;
      t.count += 1;
      if (e.date < t.first) t.first = e.date;
      if (e.date > t.last) t.last = e.date;
      tagMap.set(tag, t);
    }
  }
  const tags = [...tagMap.values()]
    .map((t) => {
      const days = daysBetweenISO(t.first, t.last) + 1;
      // A cost per day only makes sense for something trip-like: several entries within a month.
      return { ...t, perDay: t.count > 1 && days <= 31 ? t.total / days : null };
    })
    .sort((a, b) => b.total - a.total);

  const budgets = budgetRows
    .map((b) => {
      const limit = Number(b.amount);
      const perMonthSpent = period.months.map((m) =>
        sum(expenses.filter((e) => e.month === m && e.category === b.category).map((e) => e.amount))
      );
      return {
        category: b.category,
        limit,
        spent: sum(perMonthSpent),
        keptMonths: perMonthSpent.filter((s) => s <= limit).length,
        months: period.months.length,
      };
    })
    .sort((a, b) => EXPENSE_CATEGORIES.indexOf(a.category as never) - EXPENSE_CATEGORIES.indexOf(b.category as never));

  const withTargets = months.filter((m) => m.target !== null);
  const targets = { set: withTargets.length, hit: withTargets.filter((m) => m.income >= (m.target ?? 0)).length };

  // Savings: from the last snapshot before the period (or its first one) to the last one in it.
  const snapshotMonths = [...new Set(snapshotRows.map((r) => r.month))].sort();
  const before = snapshotMonths.filter((m) => m < period.from).pop();
  const firstIn = snapshotMonths.find((m) => m >= period.from);
  const fromMonth = before ?? firstIn;
  const toMonth = snapshotMonths.filter((m) => m <= period.to).pop();
  const wealth: WealthMove[] = [];
  if (fromMonth && toMonth && fromMonth !== toMonth) {
    for (const currency of CURRENCIES) {
      const at = (month: string) => snapshotRows.filter((r) => r.month === month && r.currency === currency);
      const a = at(fromMonth);
      const b = at(toMonth);
      if (a.length === 0 && b.length === 0) continue;
      const investedA = sum(a.map((r) => Number(r.invested)));
      const investedB = sum(b.map((r) => Number(r.invested)));
      const startValue = sum(a.map((r) => Number(r.current)));
      const endValue = sum(b.map((r) => Number(r.current)));
      wealth.push({
        currency,
        fromMonth,
        toMonth,
        start: startValue,
        end: endValue,
        putIn: investedB - investedA,
        growth: endValue - startValue - (investedB - investedA),
      });
    }
  }

  let highlights: Highlights | null = null;
  if (isMonth) {
    const month = period.from;
    const countNoSpend = (m: string, upTo: string) => {
      const days = new Set(entries.filter((e) => e.month === m && e.type === "expense").map((e) => e.date));
      let count = 0;
      for (let d = monthRangeISO(m).start; d <= upTo; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) {
        if (!days.has(d)) count++;
      }
      return count;
    };
    const prev = shiftMonthKey(month, -1);
    const sortedExpenses = [...expenses].sort((a, b) => b.amount - a.amount);
    const topTag = tags[0] ?? null;

    let targetReachedOn: string | null = null;
    const target = targetsByMonth.get(month);
    if (target !== undefined) {
      let running = 0;
      for (const e of incomes) {
        running += e.amount;
        if (running >= target) {
          targetReachedOn = e.date;
          break;
        }
      }
    }

    const keptByMonth = new Map<string, number>();
    for (const e of entries) keptByMonth.set(e.month, (keptByMonth.get(e.month) ?? 0) + (e.type === "income" ? e.amount : -e.amount));
    const ranked = [...keptByMonth.entries()].sort((a, b) => b[1] - a[1]);
    const position = ranked.findIndex(([m]) => m === month) + 1;

    const horizon = new Date(Date.parse(`${end}T00:00:00Z`) + 45 * 86_400_000).toISOString().slice(0, 10);
    const maturing = accounts
      .flatMap((a) => {
        const terms = depositTermsOf(a);
        if (!terms || terms.maturity < today || terms.maturity > horizon) return [];
        return [{ name: a.name, date: terms.maturity, amount: summarizeDeposit(terms, today).maturityValue, currency: a.currency }];
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    highlights = {
      noSpendDays: countNoSpend(month, end),
      noSpendDaysBefore: entries.some((e) => e.month === prev) ? countNoSpend(prev, monthRangeISO(prev).end) : null,
      biggest: sortedExpenses[0] ? { source: sortedExpenses[0].source, amount: sortedExpenses[0].amount, date: sortedExpenses[0].date } : null,
      runnerUp: sortedExpenses[1] ? { source: sortedExpenses[1].source, amount: sortedExpenses[1].amount } : null,
      topTag: topTag ? { tag: topTag.tag, total: topTag.total, days: daysBetweenISO(topTag.first, topTag.last) + 1 } : null,
      targetReachedOn,
      rank: position > 0 && ranked.length > 1 ? { position, of: ranked.length } : null,
      maturing,
    };
  }

  return {
    period,
    income,
    expense,
    kept: income - expense,
    rate: rateOf(income, expense),
    months,
    baselineMonths,
    usual,
    categories,
    tags,
    places: groupByName(expenses).slice(0, 8),
    incomeSources: groupByName(incomes).slice(0, 6),
    budgets,
    targets,
    wealth,
    highlights,
  };
}

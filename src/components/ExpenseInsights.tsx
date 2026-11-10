import { Card, EmptyState } from "@/components/ui";
import { categoryColor } from "@/lib/financeCategories";
import { formatDateShort, formatEUR } from "@/lib/format";

type CategoryTotal = { category: string; total: number };

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function Donut({ items, total }: { items: CategoryTotal[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const segments = items.map(({ category, total: value }, index) => ({
    category,
    value,
    length: (value / total) * circumference,
    offset: items.slice(0, index).reduce((sum, item) => sum + (item.total / total) * circumference, 0),
  }));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[220px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--background)" strokeWidth="14" />
        {segments.map(({ category, value, length, offset }) => (
            <circle
              key={category}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={categoryColor(category)}
              strokeWidth="14"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
            >
              <title>{`${category}: ${formatEUR(value)}`}</title>
            </circle>
        ))}
        <circle cx="50" cy="50" r={radius + 7} fill="none" stroke="var(--ink)" strokeWidth="1" />
        <circle cx="50" cy="50" r={radius - 7} fill="none" stroke="var(--ink)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Spent</span>
        <span className="font-display text-xl font-bold">{formatEUR(total)}</span>
      </div>
    </div>
  );
}

export function ExpenseBreakdown({
  monthLabel,
  total,
  items,
}: {
  monthLabel: string;
  total: number;
  items: CategoryTotal[];
}) {
  return (
    <Card className="mb-6">
      <div className="mb-5">
        <h2 className="font-display text-xl font-bold">Expense breakdown</h2>
        <p className="text-sm font-semibold text-muted">Where your money went in {monthLabel}</p>
      </div>

      {items.length === 0 ? (
        <EmptyState>No expenses recorded for {monthLabel}.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <Donut items={items} total={total} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map(({ category, total: value }, index) => (
              <div
                key={category}
                className={`brut-border relative overflow-hidden rounded-md bg-surface p-3 ${index === 0 ? "brut-shadow" : ""}`}
              >
                <span
                  className="absolute inset-y-0 left-0 w-1.5"
                  style={{ backgroundColor: categoryColor(category) }}
                />
                <p className="truncate pl-1 text-xs font-bold uppercase tracking-wide text-muted">
                  {category}
                </p>
                <p className="pl-1 font-display text-lg font-bold">{formatEUR(value)}</p>
                <p className="pl-1 text-xs font-bold">{pct(value, total).toFixed(0)}% of month</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export type TaggedExpense = {
  id: number;
  date: string;
  source: string;
  category: string;
  amount: number;
  notes: string | null;
};

export type TagSummary = {
  tag: string;
  total: number;
  items: CategoryTotal[];
  expenses: TaggedExpense[];
};

export function SpendingByTag({
  tags,
  monthLabel,
  monthTotal,
}: {
  tags: TagSummary[];
  monthLabel: string;
  monthTotal: number;
}) {
  if (tags.length === 0) return null;
  return (
    <Card className="mb-6">
      {/* Named group so the per-tag <details> inside keep their own open state styling. */}
      <details open className="group/tags">
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="font-display text-xl font-bold">Spending by tag</h2>
            <p className="text-sm font-semibold text-muted">Trips and projects you tagged in {monthLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted">
              {tags.length} {tags.length === 1 ? "tag" : "tags"} ·{" "}
              {formatEUR(tags.reduce((sum, t) => sum + t.total, 0))}
            </span>
            <span
              aria-hidden
              className="brut-border flex h-9 w-9 items-center justify-center rounded-md bg-surface text-xs font-bold transition-transform group-open/tags:rotate-180"
            >
              ▼
            </span>
          </div>
        </summary>

        <div className="mt-5 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
          {tags.map(({ tag, total, items, expenses }, index) => (
            <div
              key={tag}
              className={`brut-border overflow-hidden rounded-md bg-surface ${index === 0 ? "brut-shadow" : ""}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="brut-border truncate rounded-full bg-blue px-3 py-0.5 text-sm font-bold text-white">
                    #{tag}
                  </span>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted">
                    {pct(total, monthTotal).toFixed(0)}% of month
                  </span>
                </div>
                <p className="mt-3 font-display text-3xl font-bold">{formatEUR(total)}</p>
                <p className="text-xs font-bold text-muted">
                  {expenses.length} {expenses.length === 1 ? "expense" : "expenses"}
                </p>

                <div className="brut-border mt-4 flex h-3 overflow-hidden rounded-full bg-background">
                  {items.map(({ category, total: value }) => (
                    <span
                      key={category}
                      className="h-full"
                      title={`${category}: ${formatEUR(value)}`}
                      style={{ width: `${pct(value, total)}%`, backgroundColor: categoryColor(category) }}
                    />
                  ))}
                </div>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                  {items.map(({ category, total: value }) => (
                    <li key={category} className="flex items-center gap-1.5 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: categoryColor(category) }}
                      />
                      <span className="font-bold uppercase text-muted">{category}</span>
                      <span className="font-bold">{formatEUR(value)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <details className="group border-t-2 border-ink">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-background px-4 py-2.5 text-xs font-bold uppercase tracking-wide hover:bg-yellow [&::-webkit-details-marker]:hidden">
                  <span className="group-open:hidden">Show {expenses.length === 1 ? "expense" : `all ${expenses.length} expenses`}</span>
                  <span className="hidden group-open:inline">Hide expenses</span>
                  <span aria-hidden className="transition-transform group-open:rotate-180">▼</span>
                </summary>
                <ul className="max-h-80 divide-y divide-ink/10 overflow-y-auto">
                  {expenses.map((expense) => (
                    <li key={expense.id} className="relative flex items-center gap-3 py-2.5 pl-5 pr-4">
                      <span
                        className="absolute inset-y-0 left-0 w-1.5"
                        style={{ backgroundColor: categoryColor(expense.category) }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold" title={expense.source}>{expense.source}</p>
                        <p className="truncate text-xs font-semibold text-muted">
                          {formatDateShort(expense.date)} · {expense.category}
                          {expense.notes ? ` · ${expense.notes}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 font-display font-bold">{formatEUR(expense.amount)}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      </details>
    </Card>
  );
}

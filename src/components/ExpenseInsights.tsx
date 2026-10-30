import { Card, EmptyState } from "@/components/ui";
import { categoryColor } from "@/lib/financeCategories";
import { formatEUR } from "@/lib/format";

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

export type TagSummary = { tag: string; total: number; count: number; items: CategoryTotal[] };

export function SpendingByTag({ tags }: { tags: TagSummary[] }) {
  if (tags.length === 0) return null;
  const max = tags[0].total;
  return (
    <Card className="mb-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Spending by tag</h2>
          <p className="text-sm font-semibold text-muted">All-time, per trip or project. Tap a tag for details.</p>
        </div>
        <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted">
          {tags.length} {tags.length === 1 ? "tag" : "tags"}
        </span>
      </div>
      <div className="divide-y-2 divide-ink/10">
        {tags.map(({ tag, total, count, items }) => (
          <details key={tag} className="group py-3">
            <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
              <span className="w-4 shrink-0 text-xs font-bold text-muted transition-transform group-open:rotate-90">
                ▶
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-bold text-blue">#{tag}</span>
                  <span className="shrink-0 font-display text-lg font-bold">{formatEUR(total)}</span>
                </div>
                <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-background">
                  <div className="flex h-full" style={{ width: `${Math.max(4, pct(total, max))}%` }}>
                    {items.map(({ category, total: value }) => (
                      <span
                        key={category}
                        className="h-full"
                        style={{ width: `${pct(value, total)}%`, backgroundColor: categoryColor(category) }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </summary>
            <div className="ml-7 mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {items.map(({ category, total: value }) => (
                <div key={category} className="rounded-md bg-background px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: categoryColor(category) }}
                    />
                    <span className="truncate text-xs font-bold uppercase text-muted">{category}</span>
                  </div>
                  <p className="font-bold">{formatEUR(value)}</p>
                </div>
              ))}
              <p className="col-span-full text-xs font-semibold text-muted">
                {count} {count === 1 ? "expense" : "expenses"} tagged
              </p>
            </div>
          </details>
        ))}
      </div>
    </Card>
  );
}

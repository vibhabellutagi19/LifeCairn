import Link from "next/link";
import { clsx } from "clsx";
import { Card, EmptyState } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
import { BudgetEditor } from "@/components/BudgetEditor";
import { OTHER_CATEGORY_COLOR, categoryColor, hasOwnColor } from "@/lib/financeCategories";
import { formatEUR } from "@/lib/format";

type CategoryTotal = { category: string; total: number };

function pct(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Categories without their own colour are one "Other" slice, so no two slices
 * share a colour. The tiles beside it still list every category.
 */
function Donut({ items, total }: { items: CategoryTotal[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const hued = items.filter((item) => hasOwnColor(item.category));
  const rest = items.filter((item) => !hasOwnColor(item.category));
  const slices = [
    ...hued.map((item) => ({ key: item.category, label: item.category, value: item.total, color: categoryColor(item.category) })),
    ...(rest.length > 0
      ? [
          {
            key: "__other",
            label: rest.map((item) => item.category).join(", "),
            value: rest.reduce((sum, item) => sum + item.total, 0),
            color: OTHER_CATEGORY_COLOR,
          },
        ]
      : []),
  ];
  const gap = slices.length > 1 ? 1 : 0; // surface gap between slices
  const lengths = slices.map((slice) => (slice.value / total) * circumference);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, l) => sum + l, 0));
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[200px] sm:max-w-[220px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Spending by category">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--background)" strokeWidth="14" />
        {slices.map((slice, i) => {
          const dash = Math.max(0, lengths[i] - gap);
          return (
            <circle
              key={slice.key}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offsets[i]}
            >
              <title>{`${slice.label}: ${formatEUR(slice.value)}`}</title>
            </circle>
          );
        })}
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
  budgets,
  activeCategory,
  hrefFor,
}: {
  monthLabel: string;
  total: number;
  items: CategoryTotal[];
  /** Monthly limit per category. */
  budgets: Record<string, number>;
  activeCategory: string | null;
  /** Link that filters Transactions by a category (null clears it). */
  hrefFor: (category: string | null) => string;
}) {
  // Budgeted categories show even before anything is spent in them.
  const tiles = [
    ...items,
    ...Object.keys(budgets)
      .filter((category) => !items.some((item) => item.category === category))
      .map((category) => ({ category, total: 0 })),
  ];
  const budgeted = tiles.filter((tile) => budgets[tile.category] !== undefined);
  const over = budgeted.filter((tile) => tile.total > budgets[tile.category]);

  return (
    <Card>
      <CardHeader
        className="mb-5"
        title="By category"
        description={`Where your money went in ${monthLabel}. Tap a category to see its transactions.`}
        action={<BudgetEditor budgets={budgets} />}
      />

      {budgeted.length > 0 ? (
        <p
          className={clsx(
            "brut-border mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold",
            over.length > 0 ? "bg-pink text-white" : "bg-green/15 text-ink"
          )}
        >
          <span aria-hidden>{over.length > 0 ? "✕" : "✓"}</span>
          {over.length > 0
            ? `${over.length} of ${budgeted.length} budgets over: ${over.map((tile) => tile.category).join(", ")}`
            : `All ${budgeted.length} budgets on track`}
        </p>
      ) : null}

      {tiles.length === 0 ? (
        <EmptyState>No expenses recorded for {monthLabel}.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
          {total > 0 ? <Donut items={items} total={total} /> : <div />}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            {tiles.map(({ category, total: value }) => {
              const budget = budgets[category];
              const isOver = budget !== undefined && value > budget;
              const active = activeCategory === category;
              return (
                <Link
                  key={category}
                  href={hrefFor(active ? null : category)}
                  scroll={false}
                  aria-current={active ? "true" : undefined}
                  className={clsx(
                    "brut-border relative overflow-hidden rounded-md p-3 transition-transform hover:-translate-y-0.5",
                    active ? "brut-shadow bg-yellow/60" : "bg-surface"
                  )}
                >
                  <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: categoryColor(category) }} />
                  <p className="truncate pl-1 text-xs font-bold uppercase tracking-wide text-muted">{category}</p>
                  <p className="pl-1 font-display text-lg font-bold">{formatEUR(value)}</p>
                  {budget !== undefined ? (
                    <div className="pl-1">
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-background" aria-hidden>
                        <div
                          className={clsx("h-full rounded-full", isOver ? "bg-pink" : "bg-green")}
                          style={{ width: `${Math.min(100, pct(value, budget))}%` }}
                        />
                      </div>
                      <p className={clsx("mt-1 text-xs font-bold", isOver ? "text-pink" : "text-muted")}>
                        {isOver
                          ? `✕ ${formatEUR(value - budget)} over`
                          : `${formatEUR(budget - value)} left of ${formatEUR(budget)}`}
                      </p>
                    </div>
                  ) : (
                    <p className="pl-1 text-xs font-bold">{pct(value, total).toFixed(0)}% of month</p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

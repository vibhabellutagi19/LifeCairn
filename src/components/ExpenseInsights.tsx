import { Card, EmptyState } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
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
    <Card>
      <CardHeader className="mb-5" title="By category" description={`Where your money went in ${monthLabel}.`} />

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

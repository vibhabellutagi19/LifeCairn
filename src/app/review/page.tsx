import Link from "next/link";
import { and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  financeEntries,
  journalEntries,
  milestones,
  roadmaps,
  tasks,
} from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { formatDateShort, formatEUR } from "@/lib/format";
import {
  currentMonthKey,
  monthRangeISO,
  shiftDateISO,
  todayISO,
  weekRangeISO,
} from "@/lib/dates";
import { addMonths, format } from "date-fns";

export const dynamic = "force-dynamic";

function daysBetweenInclusive(start: string, end: string) {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; anchor?: string }>;
}) {
  const { period: periodParam, anchor: anchorParam } = await searchParams;
  const period = periodParam === "month" ? "month" : "week";

  const today = todayISO();
  const monthKey = currentMonthKey();

  const range =
    period === "week"
      ? weekRangeISO(anchorParam || today)
      : monthRangeISO(anchorParam || monthKey);

  const totalDays = daysBetweenInclusive(range.start, range.end);
  const cappedEnd = range.end > today ? today : range.end;
  const elapsedDays = range.start > today ? 0 : daysBetweenInclusive(range.start, cappedEnd);

  const [
    periodTasks,
    journalCount,
    affirmationCheckinRows,
    financeTotals,
    dueMilestones,
    allRoadmaps,
  ] = await Promise.all([
    db.select().from(tasks).where(and(gte(tasks.date, range.start), lte(tasks.date, range.end))),
    db.$count(
      journalEntries,
      and(gte(journalEntries.date, range.start), lte(journalEntries.date, range.end))
    ),
    db
      .select({ date: affirmationCheckins.date, slot: affirmationCheckins.slot })
      .from(affirmationCheckins)
      .where(
        and(
          gte(affirmationCheckins.date, range.start),
          lte(affirmationCheckins.date, range.end)
        )
      ),
    db
      .select({
        type: financeEntries.type,
        total: sql<string>`coalesce(sum(${financeEntries.amount}), 0)`,
      })
      .from(financeEntries)
      .where(and(gte(financeEntries.date, range.start), lte(financeEntries.date, range.end)))
      .groupBy(financeEntries.type),
    db
      .select({
        id: milestones.id,
        title: milestones.title,
        status: milestones.status,
        targetDate: milestones.targetDate,
        roadmapId: milestones.roadmapId,
      })
      .from(milestones)
      .where(
        and(
          gte(milestones.targetDate, range.start),
          lte(milestones.targetDate, range.end)
        )
      ),
    db.select().from(roadmaps),
  ]);

  const taskDone = periodTasks.filter((t) => t.completed).length;
  const taskPct = periodTasks.length ? Math.round((taskDone / periodTasks.length) * 100) : 0;
  const slotsByDate = new Map<string, Set<string>>();
  for (const c of affirmationCheckinRows) {
    const set = slotsByDate.get(c.date) ?? new Set<string>();
    set.add(c.slot);
    slotsByDate.set(c.date, set);
  }
  const affirmationCount = [...slotsByDate.values()].filter((s) => s.size >= 3).length;
  const income = Number(financeTotals.find((f) => f.type === "income")?.total ?? 0);
  const expense = Number(financeTotals.find((f) => f.type === "expense")?.total ?? 0);
  const roadmapTitle = (id: number | null) =>
    allRoadmaps.find((r) => r.id === id)?.title ?? "General";

  const prevAnchor =
    period === "week"
      ? shiftDateISO(range.start, -1)
      : format(addMonths(new Date(`${(anchorParam || monthKey)}-01T00:00:00`), -1), "yyyy-MM");
  const nextAnchor =
    period === "week"
      ? shiftDateISO(range.end, 1)
      : format(addMonths(new Date(`${(anchorParam || monthKey)}-01T00:00:00`), 1), "yyyy-MM");

  return (
    <div>
      <PageHeader
        title="Review"
        subtitle="Zoom out and measure the week or month."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Link
              href="/review?period=week"
              className={`brut-border brut-shadow-sm brut-press inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${period === "week" ? "bg-orange text-white" : "bg-surface hover:bg-yellow"}`}
            >
              Week
            </Link>
            <Link
              href="/review?period=month"
              className={`brut-border brut-shadow-sm brut-press inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wide ${period === "month" ? "bg-orange text-white" : "bg-surface hover:bg-yellow"}`}
            >
              Month
            </Link>
          </div>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
            <Link
              href={`/review?period=${period}&anchor=${prevAnchor}`}
              aria-label={`Previous ${period}`}
              className="brut-border brut-shadow-sm brut-press flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface font-bold hover:bg-yellow"
            >
              &larr;
            </Link>
            <span className="min-w-0 text-center text-sm font-bold">
              {period === "week"
                ? `${formatDateShort(range.start)} – ${formatDateShort(range.end)}`
                : range.start.slice(0, 7)}
            </span>
            <Link
              href={`/review?period=${period}&anchor=${nextAnchor}`}
              aria-label={`Next ${period}`}
              className="brut-border brut-shadow-sm brut-press flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-surface font-bold hover:bg-yellow"
            >
              &rarr;
            </Link>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Tasks completed</p>
          <p className="mb-2 font-display text-2xl font-bold">
            {taskDone}/{periodTasks.length}
          </p>
          <ProgressBar value={taskPct} />
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Journal entries</p>
          <p className="mb-2 font-display text-2xl font-bold">
            {journalCount}/{elapsedDays || totalDays}
          </p>
          <ProgressBar
            value={elapsedDays ? (journalCount / elapsedDays) * 100 : 0}
            color="pink"
          />
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Affirmation days (3x)</p>
          <p className="mb-2 font-display text-2xl font-bold">
            {affirmationCount}/{elapsedDays || totalDays}
          </p>
          <ProgressBar
            value={elapsedDays ? (affirmationCount / elapsedDays) * 100 : 0}
            color="green"
          />
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Net cash flow</p>
          <p className="font-display text-2xl font-bold">{formatEUR(income - expense)}</p>
          <p className="mt-1 text-xs font-semibold text-muted">
            +{formatEUR(income)} / -{formatEUR(expense)}
          </p>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 font-display text-xl font-bold">
          Milestones due this {period}
        </h2>
        {dueMilestones.length === 0 ? (
          <EmptyState>No milestones with a target date in this {period}.</EmptyState>
        ) : (
          <div className="space-y-2">
            {dueMilestones.map((m) => (
              <div key={m.id} className="brut-border flex items-center justify-between gap-3 rounded-md bg-surface p-3">
                <div>
                  <p className="font-bold">{m.title}</p>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {roadmapTitle(m.roadmapId)} &middot; {m.targetDate ? formatDateShort(m.targetDate) : ""}
                  </p>
                </div>
                <Badge color={m.status === "done" ? "green" : m.status === "in_progress" ? "orange" : "muted"}>
                  {m.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

import Link from "next/link";
import { db } from "@/db";
import { habitLogs, habits, roadmaps } from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader, Select } from "@/components/ui";
import { createHabit } from "@/lib/actions/habits";
import { HabitCalendarGrid, type GridHabit } from "@/components/HabitCalendarGrid";
import { Collapsible } from "@/components/Collapsible";
import { computeHabitStats } from "@/lib/habitStats";
import { currentMonthKey, daysInMonthISO, monthRangeISO, shiftMonthKey, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const today = todayISO();
  const monthKey = monthParam || currentMonthKey();
  const monthDays = daysInMonthISO(monthKey);
  const range = monthRangeISO(monthKey);
  const elapsedDaysInMonth =
    range.start > today ? 0 : range.end < today ? monthDays.length : monthDays.indexOf(today) + 1;

  const [allHabits, allLogs, allRoadmaps] = await Promise.all([
    db.select().from(habits).orderBy(habits.sortOrder, habits.id),
    db.select().from(habitLogs),
    db.select().from(roadmaps).orderBy(roadmaps.sortOrder, roadmaps.id),
  ]);

  const toGridHabit = (h: (typeof allHabits)[number]): GridHabit => {
    const dates = allLogs.filter((l) => l.habitId === h.id).map((l) => l.date);
    const stats = computeHabitStats(dates, today);
    return {
      id: h.id,
      title: h.title,
      roadmapId: h.roadmapId,
      endDate: h.endDate,
      active: h.active,
      currentStreak: stats.currentStreak,
      score: stats.score,
      checkedDates: dates,
    };
  };

  // "Active for this view" is relative to the month being looked at, not
  // today's real date — a habit that ended Sept 30 shouldn't show as a live
  // row when you navigate forward to October, even if today is still Sept 25.
  const current = allHabits.filter((h) => h.active && (!h.endDate || h.endDate >= range.start));
  const finished = allHabits.filter((h) => h.active && h.endDate && h.endDate < range.start);
  const paused = allHabits.filter((h) => !h.active);

  const prevMonth = shiftMonthKey(monthKey, -1);
  const nextMonth = shiftMonthKey(monthKey, 1);

  return (
    <div>
      <PageHeader
        title="Habit Tracker"
        subtitle="Check in daily. Click any past day to backfill it."
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Link
              href={`/habits?month=${prevMonth}`}
              aria-label="Previous month"
              className="brut-border brut-shadow-sm brut-press flex h-11 w-11 items-center justify-center rounded-md bg-surface font-bold hover:bg-yellow"
            >
              &larr;
            </Link>
            <span className="min-w-20 text-center text-sm font-bold">{monthKey}</span>
            <Link
              href={`/habits?month=${nextMonth}`}
              aria-label="Next month"
              className="brut-border brut-shadow-sm brut-press flex h-11 w-11 items-center justify-center rounded-md bg-surface font-bold hover:bg-yellow"
            >
              &rarr;
            </Link>
            <Link
              href={`/habits?month=${currentMonthKey()}`}
              className="brut-border brut-shadow-sm brut-press inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-yellow px-3 py-1.5 text-xs font-bold uppercase tracking-wide sm:flex-none"
            >
              This month
            </Link>
          </div>
          <form action={createHabit} className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:flex xl:w-auto xl:items-center">
            <Input name="title" placeholder="New habit..." required className="w-full" />
            <Select name="roadmapId" defaultValue="" className="w-full">
              <option value="">No roadmap</option>
              {allRoadmaps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
            <Input type="date" name="endDate" title="Optional end date" className="w-full" />
            <Button type="submit" variant="primary" size="sm" className="w-full xl:w-auto">
              Add Habit
            </Button>
          </form>
        </div>
      </Card>

      {current.length === 0 && finished.length === 0 && paused.length === 0 ? (
        <EmptyState>No habits yet. Add your first one above.</EmptyState>
      ) : (
        <div className="space-y-6">
          {current.length > 0 ? (
            <HabitCalendarGrid
              habits={current.map(toGridHabit)}
              monthDays={monthDays}
              today={today}
              elapsedDaysInMonth={elapsedDaysInMonth}
              roadmaps={allRoadmaps}
            />
          ) : (
            <EmptyState>No active habits this month.</EmptyState>
          )}

          {finished.length > 0 ? (
            <Collapsible title="Finished" count={finished.length}>
              <HabitCalendarGrid
                habits={finished.map(toGridHabit)}
                monthDays={monthDays}
                today={today}
                elapsedDaysInMonth={elapsedDaysInMonth}
                roadmaps={allRoadmaps}
              />
            </Collapsible>
          ) : null}

          {paused.length > 0 ? (
            <Collapsible title="Paused" count={paused.length}>
              <HabitCalendarGrid
                habits={paused.map(toGridHabit)}
                monthDays={monthDays}
                today={today}
                elapsedDaysInMonth={elapsedDaysInMonth}
                roadmaps={allRoadmaps}
              />
            </Collapsible>
          ) : null}
        </div>
      )}
    </div>
  );
}

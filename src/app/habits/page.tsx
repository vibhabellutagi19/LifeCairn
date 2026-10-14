import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roadmaps } from "@/db/schema";
import { EmptyState } from "@/components/ui";
import { HabitCalendarGrid } from "@/components/HabitCalendarGrid";
import { Collapsible } from "@/components/Collapsible";
import { HabitsShell } from "@/components/HabitsShell";
import { HabitTodayView } from "@/components/HabitTodayView";
import { requireModule } from "@/lib/moduleSettings";
import { loadHabits } from "@/lib/habitData";
import { goalProgress } from "@/lib/habitGoals";
import { habitIcon } from "@/lib/habitLook";
import { rewardState } from "@/lib/habitRewards";
import { currentMonthKey, daysInMonthISO, monthRangeISO, shiftMonthKey, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

function monthTitle(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default async function HabitsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const userId = await requireModule("habits");
  const { month: monthParam } = await searchParams;
  const today = todayISO();
  const thisMonth = currentMonthKey();
  const monthKey = monthParam || thisMonth;
  const monthDays = daysInMonthISO(monthKey);
  const range = monthRangeISO(monthKey);
  const elapsedDaysInMonth =
    range.start > today ? 0 : range.end < today ? monthDays.length : monthDays.indexOf(today) + 1;

  const [{ habits: allHabits }, allRoadmaps] = await Promise.all([
    loadHabits(today, userId),
    db
      .select({ id: roadmaps.id, title: roadmaps.title })
      .from(roadmaps)
      .where(eq(roadmaps.userId, userId))
      .orderBy(roadmaps.sortOrder, roadmaps.id),
  ]);

  // "Active for this view" is relative to the month being looked at, not
  // today's real date — a habit that ended Sept 30 shouldn't show as a live
  // row when you navigate forward to October, even if today is still Sept 25.
  const current = allHabits.filter((h) => h.active && (!h.endDate || h.endDate >= range.start));
  const finished = allHabits.filter((h) => h.active && h.endDate && h.endDate < range.start);
  const paused = allHabits.filter((h) => !h.active);

  // Hero stats are always about today and this month, whichever month the grid shows.
  const live = allHabits.filter((h) => h.active && (!h.endDate || h.endDate >= today));
  const doneToday = live.filter((h) => h.checkedDates.includes(today)).length;
  const goals = live.filter((h) => h.targetDays).map((h) => goalProgress(h.checkedDates, thisMonth, h.targetDays));
  const goalsReached = goals.filter((g) => g.reached).length;
  const goalAverage = goals.length ? Math.round(goals.reduce((sum, g) => sum + Math.min(100, g.percent), 0) / goals.length) : 0;
  const streakLeader = [...live].sort((a, b) => b.currentStreak - a.currentStreak)[0];
  const rewardStates = live.flatMap((h) => h.rewards.map((r) => ({ reward: r, state: rewardState(r, h, thisMonth, today) })));
  const ready = rewardStates.filter(({ state }) => state.status === "unlocked").length;
  const nextUp = rewardStates
    .filter(({ state }) => state.status === "locked")
    .sort((a, b) => a.state.left - b.state.left)[0];

  const prevMonth = shiftMonthKey(monthKey, -1);
  const nextMonth = shiftMonthKey(monthKey, 1);

  return (
    <div className="pb-24 md:pb-0">
      <section className="hb-hero relative mb-6 overflow-hidden rounded-3xl p-5 text-white sm:p-7">
        <div aria-hidden className="hb-floaters">
          {live.slice(0, 6).map((h, i) => (
            <span key={h.id} style={{ "--i": i, "--r": i % 3 } as React.CSSProperties}>
              {habitIcon(h.title)}
            </span>
          ))}
        </div>
        <div className="relative z-10">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-yellow">Tiny wins, every day</p>
          <h1 className="font-display text-4xl font-bold leading-none sm:text-5xl">
            Habit <span className="hb-wobble">Tracker</span>
          </h1>
          <p className="mt-2 max-w-md text-sm font-semibold text-white/70">
            Set a monthly target, keep the streak alive, and cash in the rewards you picked for yourself.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div className="hb-stat">
              <p className="hb-stat-value">
                {doneToday}
                <span className="text-white/50">/{live.length}</span>
              </p>
              <p className="hb-stat-label">done today</p>
            </div>
            <div className="hb-stat">
              <p className="hb-stat-value">{goals.length ? `${goalAverage}%` : "—"}</p>
              <p className="hb-stat-label">
                {goals.length ? `monthly goals · ${goalsReached}/${goals.length} hit` : "no monthly goals yet"}
              </p>
            </div>
            <div className="hb-stat">
              <p className="hb-stat-value">
                {streakLeader?.currentStreak ?? 0}
                <span className="hb-flame">🔥</span>
              </p>
              <p className="hb-stat-label truncate">
                {streakLeader?.currentStreak ? `streak · ${streakLeader.title}` : "start a streak today"}
              </p>
            </div>
            <Link href="/habits/rewards" className={`hb-stat hb-shop ${ready ? "is-ready" : ""}`}>
              <p className="hb-stat-value">
                {ready ? ready : "🎁"}
                {ready ? <span className="ml-1 text-2xl">🎁</span> : null}
              </p>
              <p className="hb-stat-label truncate">
                {ready
                  ? `${ready === 1 ? "reward" : "rewards"} ready · open shop →`
                  : nextUp
                    ? `${nextUp.state.left} to go · ${nextUp.reward.title} →`
                    : "Reward shop · add one →"}
              </p>
            </Link>
          </div>
        </div>
      </section>

      <HabitsShell
        roadmaps={allRoadmaps}
        today={
          <HabitTodayView
            habits={current}
            today={today}
            roadmaps={allRoadmaps}
          />
        }
        month={
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Link href={`/habits?month=${prevMonth}`} aria-label="Previous month" className="hb-nav">
                &larr;
              </Link>
              <span className="min-w-36 text-center font-display text-lg font-bold">{monthTitle(monthKey)}</span>
              <Link href={`/habits?month=${nextMonth}`} aria-label="Next month" className="hb-nav">
                &rarr;
              </Link>
              {monthKey !== thisMonth ? (
                <Link href="/habits" className="hb-nav w-auto bg-yellow px-3 text-xs uppercase tracking-wide">
                  This month
                </Link>
              ) : null}
            </div>

            {current.length === 0 && finished.length === 0 && paused.length === 0 ? (
              <EmptyState>No habits yet. Add your first one with “+ New habit”.</EmptyState>
            ) : (
              <div className="space-y-6">
                {current.length > 0 ? (
                  <HabitCalendarGrid
                    habits={current}
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
                      habits={finished}
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
                      habits={paused}
                      monthDays={monthDays}
                      today={today}
                      elapsedDaysInMonth={elapsedDaysInMonth}
                      roadmaps={allRoadmaps}
                    />
                  </Collapsible>
                ) : null}
              </div>
            )}
          </>
        }
      />
    </div>
  );
}

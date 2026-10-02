import Link from "next/link";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmations,
  financeAccounts,
  financeEntries,
  financeTargets,
  habitLogs,
  habits,
  journalEntries,
  milestones,
  projectTasks,
  projects,
  roadmaps,
  tasks,
} from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader, ProgressBar } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { AffirmationCheckin } from "@/components/AffirmationCheckin";
import { FocusNextList } from "@/components/FocusNextList";
import { ProjectTaskRow } from "@/components/ProjectTaskRow";
import { HabitQuickRow } from "@/components/HabitQuickRow";
import { createTask } from "@/lib/actions/tasks";
import { isActiveToday, rankFocusTasks } from "@/lib/focusNext";
import { computeHabitStats } from "@/lib/habitStats";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { currentMonthKey, monthRangeISO, todayISO } from "@/lib/dates";
import { formatDateLong, formatEUR, formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const today = todayISO();
  const monthKey = currentMonthKey();
  const { start: monthStart, end: monthEnd } = monthRangeISO(monthKey);

  const [
    todaysTasks,
    todaysJournal,
    affirmationCheckinRows,
    activeAffirmationCount,
    allRoadmaps,
    allMilestones,
    accounts,
    monthIncome,
    target,
    allProjectTasks,
    activeHabits,
    allHabitLogs,
  ] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.date, today)).orderBy(tasks.sortOrder, tasks.id),
    db.query.journalEntries.findFirst({ where: eq(journalEntries.date, today) }),
    db.select().from(affirmationCheckins),
    db.$count(affirmations, eq(affirmations.active, true)),
    db.select().from(roadmaps).orderBy(roadmaps.sortOrder, roadmaps.id),
    db.select().from(milestones),
    db.select().from(financeAccounts),
    db
      .select({ total: sql<string>`coalesce(sum(${financeEntries.amount}), 0)` })
      .from(financeEntries)
      .where(
        and(
          eq(financeEntries.type, "income"),
          gte(financeEntries.date, monthStart),
          lte(financeEntries.date, monthEnd)
        )
      ),
    db.query.financeTargets.findFirst({ where: eq(financeTargets.month, monthKey) }),
    db
      .select({
        id: projectTasks.id,
        title: projectTasks.title,
        branchName: projectTasks.branchName,
        priority: projectTasks.priority,
        status: projectTasks.status,
        startDate: projectTasks.startDate,
        dueDate: projectTasks.dueDate,
        estHours: projectTasks.estHours,
        notes: projectTasks.notes,
        projectId: projectTasks.projectId,
        projectName: projects.name,
      })
      .from(projectTasks)
      .innerJoin(projects, eq(projectTasks.projectId, projects.id)),
    db.select().from(habits).where(eq(habits.active, true)).orderBy(habits.sortOrder, habits.id),
    db.select().from(habitLogs),
  ]);

  const activeHabitsToday = activeHabits.filter((h) => !h.endDate || h.endDate >= today);

  const completedCount = todaysTasks.filter((t) => t.completed).length;
  const totalBalance = accounts
    .filter((saving) => saving.type !== "cash")
    .reduce((sum, saving) => sum + Number(saving.balance), 0);
  const monthIncomeTotal = Number(monthIncome[0]?.total ?? 0);
  const targetAmount = target ? Number(target.targetAmount) : 0;
  const openProjectTasks = allProjectTasks.filter(
    (t) => t.status !== "done" && t.status !== "blocked"
  );
  const focusItems = rankFocusTasks(openProjectTasks).slice(0, 4);
  const todaysProjectTasks = allProjectTasks.filter((t) => isActiveToday(t, today));
  const habitRows = activeHabitsToday.map((h) => {
    const dates = allHabitLogs.filter((l) => l.habitId === h.id).map((l) => l.date);
    const stats = computeHabitStats(dates, today);
    return { habit: h, stats, doneToday: dates.includes(today) };
  });
  const habitsDoneToday = habitRows.filter((h) => h.doneToday).length;
  const affirmationStats = computeAffirmationStats(affirmationCheckinRows, today);

  return (
    <div>
      <PageHeader
        title="Good to see you, Vibs."
        subtitle={formatDateLong(today)}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's tasks */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Today&apos;s Tasks</h2>
            <Badge color={completedCount === todaysTasks.length && todaysTasks.length > 0 ? "green" : "orange"}>
              {completedCount}/{todaysTasks.length} done
            </Badge>
          </div>
          <form action={createTask.bind(null, today)} className="mb-4 flex gap-2">
            <Input name="title" placeholder="Add a task for today..." required />
            <Button type="submit" variant="primary" className="shrink-0">
              Add
            </Button>
          </form>
          <div className="space-y-2">
            {todaysTasks.length === 0 ? (
              <EmptyState>No tasks planned for today yet. Add your first one above.</EmptyState>
            ) : (
              todaysTasks.map((t) => (
                <TaskRow key={t.id} id={t.id} title={t.title} completed={t.completed} />
              ))
            )}
          </div>

          {todaysProjectTasks.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                From your projects &mdash; active today
              </p>
              <div className="space-y-2">
                {todaysProjectTasks.map((t) => (
                  <ProjectTaskRow
                    key={`pt-${t.id}`}
                    id={t.id}
                    projectId={t.projectId}
                    title={t.title}
                    priority={t.priority}
                    status={t.status}
                    startDate={t.startDate}
                    dueDate={t.dueDate}
                    estHours={t.estHours}
                    notes={t.notes}
                    projectName={t.projectName}
                    detailHref={`/projects/${t.projectId}/tasks/${t.branchName || t.id}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <Link href="/tasks" className="mt-4 inline-block text-sm font-bold underline underline-offset-4">
            Plan other days &rarr;
          </Link>
        </Card>

        {/* Journal + affirmations */}
        <div className="flex flex-col gap-6">
          <Card>
            <h2 className="mb-3 font-display text-xl font-bold">Journal</h2>
            {todaysJournal?.content ? (
              <p className="mb-3 line-clamp-4 text-sm text-ink/80">{todaysJournal.content}</p>
            ) : (
              <p className="mb-3 text-sm font-semibold text-muted">
                You haven&apos;t written today&apos;s entry yet.
              </p>
            )}
            <Link href={`/journal/${today}`}>
              <Button variant="pink" className="w-full">
                {todaysJournal?.content ? "Edit today's entry" : "Write today's entry"}
              </Button>
            </Link>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Affirmations</h2>
              <div className="flex items-center gap-2">
                <Badge color="orange">🔥 {affirmationStats.currentStreak}</Badge>
                <Badge color="green">⭐ {affirmationStats.score}</Badge>
              </div>
            </div>
            <p className="mb-3 text-sm font-semibold text-muted">
              {activeAffirmationCount} affirmations in your list
            </p>
            <AffirmationCheckin date={today} checked={affirmationStats.checkedToday} compact />
            <Link
              href="/affirmations"
              className="mt-3 inline-block text-sm font-bold underline underline-offset-4"
            >
              Open Affirmations &rarr;
            </Link>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold">Habits</h2>
              {habitRows.length > 0 ? (
                <Badge color={habitsDoneToday === habitRows.length ? "green" : "orange"}>
                  {habitsDoneToday}/{habitRows.length}
                </Badge>
              ) : null}
            </div>
            {habitRows.length === 0 ? (
              <p className="mb-3 text-sm font-semibold text-muted">No habits yet.</p>
            ) : (
              <div className="mb-3 space-y-2">
                {habitRows.map(({ habit, stats, doneToday }) => (
                  <HabitQuickRow
                    key={habit.id}
                    id={habit.id}
                    title={habit.title}
                    today={today}
                    doneToday={doneToday}
                    currentStreak={stats.currentStreak}
                  />
                ))}
              </div>
            )}
            <Link href="/habits" className="inline-block text-sm font-bold underline underline-offset-4">
              Open Habit Tracker &rarr;
            </Link>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Up Next (Projects)</h2>
          <Link href="/projects" className="text-sm font-bold underline underline-offset-4">
            View all &rarr;
          </Link>
        </div>
        <FocusNextList items={focusItems} />
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Roadmaps progress */}
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Roadmap Progress</h2>
            <Link href="/roadmaps" className="text-sm font-bold underline underline-offset-4">
              View all &rarr;
            </Link>
          </div>
          {allRoadmaps.length === 0 ? (
            <EmptyState>No roadmaps yet. Create one to start tracking milestones.</EmptyState>
          ) : (
            <div className="space-y-4">
              {allRoadmaps.map((r) => {
                const ms = allMilestones.filter((m) => m.roadmapId === r.id);
                const done = ms.filter((m) => m.status === "done").length;
                const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
                return (
                  <div key={r.id}>
                    <div className="mb-1 flex items-center justify-between text-sm font-bold">
                      <Link href={`/roadmaps/${r.id}`} className="hover:underline">
                        {r.title}
                      </Link>
                      <span className="text-muted">
                        {done}/{ms.length} milestones
                      </span>
                    </div>
                    <ProgressBar value={pct} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Finance snapshot */}
        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">Finance Snapshot</h2>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Total savings (INR)</p>
          <p className="font-display text-2xl font-bold">{formatINR(totalBalance)}</p>
          <div className="my-4 h-px bg-ink/10" />
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            This month&apos;s income {targetAmount ? `vs ${formatEUR(targetAmount)} target` : ""}
          </p>
          <p className="mb-2 font-display text-xl font-bold">{formatEUR(monthIncomeTotal)}</p>
          {targetAmount > 0 && <ProgressBar value={(monthIncomeTotal / targetAmount) * 100} color="green" />}
          <Link href="/finance" className="mt-4 inline-block text-sm font-bold underline underline-offset-4">
            Open finance page &rarr;
          </Link>
        </Card>
      </div>
    </div>
  );
}

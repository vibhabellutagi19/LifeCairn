import Link from "next/link";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmations,
  customEmotions,
  emotionalCheckins,
  emotionalTrackingSettings,
  financeAccounts,
  financeEntries,
  habitLogs,
  habits,
  journalEntries,
  milestones,
  projectTasks,
  projects,
  roadmaps,
  tasks,
} from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, ProgressBar } from "@/components/ui";
import { TaskRow } from "@/components/TaskRow";
import { ManifestationSection } from "@/components/ManifestationSection";
import { ProjectTaskRow } from "@/components/ProjectTaskRow";
import { HabitQuickRow } from "@/components/HabitQuickRow";
import { createTask } from "@/lib/actions/tasks";
import { isActiveOnDate } from "@/lib/focusNext";
import { computeHabitStats } from "@/lib/habitStats";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { currentMonthKey, monthRangeISO, shiftDateISO, todayISO, weekRangeISO } from "@/lib/dates";
import { formatDateLong, formatDateShort, formatEUR, formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

function isISODate(value: string | undefined): value is string {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value ?? "")) return false;
  const [year, month, day] = value!.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return parsed.getFullYear() === year && parsed.getMonth() === month - 1 && parsed.getDate() === day;
}

function formatWeekday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = todayISO();
  const { date: requestedDate } = await searchParams;
  const selectedDate = isISODate(requestedDate) ? requestedDate : today;
  const week = weekRangeISO(selectedDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => shiftDateISO(week.start, index));
  const monthKey = currentMonthKey();
  const { start: monthStart, end: monthEnd } = monthRangeISO(monthKey);

  const [
    weekTasks,
    todaysJournal,
    affirmationCheckinRows,
    emotionCheckinRows,
    trackingSettings,
    customEmotionRows,
    activeAffirmationCount,
    allRoadmaps,
    allMilestones,
    accounts,
    monthIncome,
    allProjectTasks,
    activeHabits,
    allHabitLogs,
  ] = await Promise.all([
    db
      .select()
      .from(tasks)
      .where(and(gte(tasks.date, week.start), lte(tasks.date, week.end)))
      .orderBy(tasks.date, tasks.sortOrder, tasks.id),
    db.query.journalEntries.findFirst({ where: eq(journalEntries.date, today) }),
    db.select().from(affirmationCheckins),
    db
      .select({ hour: emotionalCheckins.hour, emotion: emotionalCheckins.emotion })
      .from(emotionalCheckins)
      .where(eq(emotionalCheckins.date, today))
      .orderBy(emotionalCheckins.hour),
    db.query.emotionalTrackingSettings.findFirst({
      where: eq(emotionalTrackingSettings.profileKey, "default"),
    }),
    db
      .select({
        id: customEmotions.id,
        name: customEmotions.name,
        emoji: customEmotions.emoji,
        category: customEmotions.category,
      })
      .from(customEmotions)
      .where(eq(customEmotions.active, true))
      .orderBy(customEmotions.sortOrder, customEmotions.id),
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

  const selectedTasks = weekTasks.filter((task) => task.date === selectedDate);
  const selectedProjectTasks = allProjectTasks.filter((task) => isActiveOnDate(task, selectedDate));
  const selectedTaskCount = selectedTasks.length + selectedProjectTasks.length;
  const completedCount =
    selectedTasks.filter((task) => task.completed).length +
    selectedProjectTasks.filter((task) => task.status === "done").length;
  const totalBalance = accounts
    .filter((saving) => saving.type !== "cash")
    .reduce((sum, saving) => sum + Number(saving.balance), 0);
  const monthIncomeTotal = Number(monthIncome[0]?.total ?? 0);
  const habitRows = activeHabitsToday.map((h) => {
    const dates = allHabitLogs.filter((l) => l.habitId === h.id).map((l) => l.date);
    const stats = computeHabitStats(dates, today);
    return { habit: h, stats, doneToday: dates.includes(today) };
  });
  const habitsDoneToday = habitRows.filter((h) => h.doneToday).length;
  const habitsRemainingToday = habitRows.length - habitsDoneToday;
  const habitProgress = habitRows.length > 0
    ? Math.round((habitsDoneToday / habitRows.length) * 100)
    : 0;
  const affirmationStats = computeAffirmationStats(affirmationCheckinRows, today);
  const selectedTaskProgress = selectedTaskCount > 0
    ? Math.round((completedCount / selectedTaskCount) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="home-hero home-reveal relative overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8 lg:p-10">
        <div aria-hidden className="home-orbit home-orbit-one" />
        <div aria-hidden className="home-orbit home-orbit-two" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(26rem,0.8fr)] xl:items-end">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
              <span aria-hidden className="home-status-dot h-2 w-2 rounded-full bg-green" />
              Home base
            </div>
            <h1 className="max-w-3xl font-display text-4xl font-bold leading-[0.95] tracking-[-0.05em] sm:text-5xl lg:text-7xl">
              Welcome home,
              <span className="block text-yellow">Vibs.</span>
            </h1>
            <p className="mt-5 max-w-xl text-sm font-semibold text-white/65 sm:text-base">
              {formatDateLong(today)}. Everything important is here, ready when you are.
            </p>
            <nav aria-label="Quick actions" className="mt-7 flex flex-wrap gap-2">
              {[
                { href: "/projects", icon: "🧩", label: "Projects" },
                { href: "/manifestation", icon: "◌", label: "Manifestation" },
                { href: "/finance", icon: "💰", label: "Finance" },
                { href: "/roadmaps", icon: "🗺️", label: "Roadmaps" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="home-quick-link inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-white/25 bg-white/10 px-4 py-2 text-sm font-bold"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                  <span aria-hidden className="home-quick-arrow">↗</span>
                </Link>
              ))}
            </nav>
          </div>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 sm:gap-3">
            <div className="home-stat-card rounded-2xl bg-orange p-3 text-white sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">
                {selectedDate === today ? "Today" : formatDateShort(selectedDate)}
              </p>
              <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">{selectedTaskProgress}%</p>
              <p className="mt-1 text-xs font-semibold text-white/80">tasks complete</p>
            </div>
            <div className="home-stat-card rounded-2xl bg-green p-3 text-white sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/75">Rhythm</p>
              <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">
                {habitsDoneToday}/{habitRows.length}
              </p>
              <p className="mt-1 text-xs font-semibold text-white/80">habits today</p>
            </div>
            <div className="home-stat-card rounded-2xl bg-yellow p-3 text-ink sm:p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/60">Momentum</p>
              <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">{affirmationStats.currentStreak}</p>
              <p className="mt-1 text-xs font-semibold text-ink/65">day streak</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="week-heading" className="home-reveal home-delay-1 mt-6">
        <div className="brut-border brut-shadow home-panel overflow-hidden rounded-lg bg-surface">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-3 border-ink bg-yellow/40 px-4 py-4 sm:px-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Pick a day</p>
              <h2 id="week-heading" className="font-display text-2xl font-bold">Your week</h2>
              <p className="text-sm font-semibold text-muted">
                {formatDateShort(week.start)} &ndash; {formatDateShort(week.end)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold uppercase tracking-wide">
              <Link
                href={`/?date=${shiftDateISO(week.start, -7)}`}
                aria-label="Previous week"
                className="brut-border brut-shadow-sm brut-press home-nav-link rounded-full bg-surface px-3 py-2"
              >
                &larr;
              </Link>
              <Link
                href="/"
                className="brut-border brut-shadow-sm brut-press home-nav-link rounded-full bg-ink px-4 py-2 text-white"
              >
                Today
              </Link>
              <Link
                href={`/?date=${shiftDateISO(week.start, 7)}`}
                aria-label="Next week"
                className="brut-border brut-shadow-sm brut-press home-nav-link rounded-full bg-surface px-3 py-2"
              >
                &rarr;
              </Link>
            </div>
          </div>
          <div className="p-2 sm:p-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {weekDays.map((date) => {
                const dailyCount = weekTasks.filter((task) => task.date === date).length;
                const rangedCount = allProjectTasks.filter((task) => isActiveOnDate(task, date)).length;
                const taskCount = dailyCount + rangedCount;
                const isSelected = date === selectedDate;
                const isToday = date === today;

                return (
                  <Link
                    key={date}
                    href={date === today ? "/" : `/?date=${date}`}
                    aria-label={`${formatWeekday(date)}, ${formatDateShort(date)}: ${taskCount} ${taskCount === 1 ? "task" : "tasks"}`}
                    aria-current={isSelected ? "date" : undefined}
                    scroll={false}
                    className={`home-day brut-border min-w-0 rounded-lg px-0.5 py-2 text-center sm:rounded-xl sm:px-2 sm:py-3 ${
                      isSelected
                        ? "bg-orange text-white"
                        : isToday
                          ? "bg-yellow text-ink"
                          : "bg-surface hover:bg-yellow/60"
                    }`}
                  >
                    <span className="block truncate text-[9px] font-bold uppercase tracking-wide opacity-70 sm:text-[10px] sm:tracking-[0.16em]">
                      {formatWeekday(date)}
                    </span>
                    <span className="mt-1 block font-display text-lg font-bold sm:hidden">
                      {Number(date.slice(8, 10))}
                    </span>
                    <span className="mt-1 hidden font-display text-xl font-bold sm:block">{formatDateShort(date)}</span>
                    <span className={`mt-1 inline-flex min-w-6 justify-center rounded-full px-1 py-0.5 text-[10px] font-bold sm:mt-2 sm:px-2 ${
                      isSelected ? "bg-white/20 text-white" : "bg-background text-muted"
                    }`}>
                      {taskCount}<span className="hidden sm:inline">&nbsp;{taskCount === 1 ? "task" : "tasks"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <Card className="home-panel home-reveal home-delay-2 border-t-[8px] border-t-orange">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Your day</p>
              <h2 className="font-display text-3xl font-bold">
                {selectedDate === today ? "Today’s plan" : formatWeekday(selectedDate)}
              </h2>
              <p className="text-sm font-semibold text-muted">{formatDateLong(selectedDate)}</p>
            </div>
            <Badge color={selectedTaskCount === 0 ? "muted" : completedCount === selectedTaskCount ? "green" : "orange"}>
              {selectedTaskCount === 0 ? "Open day" : `${completedCount}/${selectedTaskCount} done`}
            </Badge>
          </div>

          {selectedTaskCount === 0 ? (
            <div className="mt-5 grid items-center gap-4 rounded-xl border-2 border-dashed border-ink/25 bg-yellow/20 p-4 sm:p-5 lg:grid-cols-[minmax(0,0.75fr)_minmax(24rem,1.25fr)]">
              <div className="flex items-start gap-3">
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-yellow text-xl">☀️</span>
                <div>
                  <h3 className="font-display text-xl font-bold">Nothing planned yet</h3>
                  <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">
                    Keep the day open, or add the one thing that would make it feel complete.
                  </p>
                </div>
              </div>
              <form action={createTask.bind(null, selectedDate)} className="flex flex-col gap-2 sm:flex-row">
                <Input name="title" aria-label="New task" placeholder="Add one meaningful thing…" required />
                <Button type="submit" variant="primary" className="shrink-0 sm:min-w-28">
                  + Add task
                </Button>
              </form>
            </div>
          ) : (
            <>
              <ProgressBar value={selectedTaskProgress} color="green" />
              <form action={createTask.bind(null, selectedDate)} className="my-5 flex flex-col gap-2 sm:flex-row">
                <Input name="title" aria-label="New task" placeholder="What would make this day feel complete?" required />
                <Button type="submit" variant="primary" className="shrink-0 sm:min-w-28">
                  + Add
                </Button>
              </form>
              <div className="space-y-2">
                {selectedTasks.map((task) => (
                  <TaskRow key={task.id} id={task.id} title={task.title} completed={task.completed} />
                ))}
              </div>
            </>
          )}

          {selectedProjectTasks.length > 0 ? (
            <div className="mt-5 border-t-2 border-dashed border-ink/20 pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">In motion from projects</p>
                <Badge color="muted">{selectedProjectTasks.length}</Badge>
              </div>
              <div className="space-y-2">
                {selectedProjectTasks.map((task) => (
                  <ProjectTaskRow
                    key={`pt-${task.id}`}
                    id={task.id}
                    projectId={task.projectId}
                    title={task.title}
                    priority={task.priority}
                    status={task.status}
                    startDate={task.startDate}
                    dueDate={task.dueDate}
                    estHours={task.estHours}
                    notes={task.notes}
                    projectName={task.projectName}
                    detailHref={`/projects/${task.projectId}/tasks/${task.branchName || task.id}`}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      </div>

      <section aria-labelledby="rhythm-heading" className="home-reveal home-delay-3 mt-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green">Small actions, repeated</p>
            <h2 id="rhythm-heading" className="font-display text-3xl font-bold">Habit rhythm</h2>
          </div>
          <Link href="/habits" className="home-text-link text-sm font-bold">Open habit tracker <span aria-hidden>&rarr;</span></Link>
        </div>

        <Card className="home-panel border-t-[8px] border-t-green">
          <div className="grid gap-5 lg:grid-cols-[minmax(13rem,0.55fr)_minmax(0,1.45fr)] lg:items-center">
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-green">Today</p>
                  <h3 className="font-display text-2xl font-bold">
                    {habitsRemainingToday === 0 && habitRows.length > 0 ? "Rhythm complete" : `${habitsRemainingToday} left`}
                  </h3>
                </div>
                <Badge color={habitsRemainingToday === 0 && habitRows.length > 0 ? "green" : "muted"}>
                  {habitsDoneToday}/{habitRows.length}
                </Badge>
              </div>
              <ProgressBar value={habitProgress} color="green" />
              <p className="mt-2 text-xs font-semibold text-muted">Only today matters. Tap a habit when it is done.</p>
            </div>

            {habitRows.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-ink/20 bg-green/10 p-4">
                <p className="font-display text-lg font-bold">Start with one small habit</p>
                <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">Something easy enough to repeat tomorrow.</p>
                <Link href="/habits" className="home-text-link mt-3 text-sm font-bold">Create a habit <span aria-hidden>&rarr;</span></Link>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {habitRows.slice(0, 3).map(({ habit, stats, doneToday }) => (
                  <HabitQuickRow
                    key={habit.id}
                    id={habit.id}
                    title={habit.title}
                    today={today}
                    doneToday={doneToday}
                    currentStreak={stats.currentStreak}
                  />
                ))}
                {habitRows.length > 3 ? (
                  <Link href="/habits" className="brut-border flex min-h-11 items-center justify-center rounded-md border-dashed bg-background px-3 py-2 text-sm font-bold text-muted hover:bg-yellow/40">
                    +{habitRows.length - 3} more
                  </Link>
                ) : null}
              </div>
            )}
          </div>
        </Card>
      </section>

      <ManifestationSection
        date={today}
        journalContent={todaysJournal?.content}
        activeAffirmationCount={activeAffirmationCount}
        affirmationCheckins={affirmationStats.checkedToday}
        affirmationStreak={affirmationStats.currentStreak}
        emotionalCheckins={emotionCheckinRows}
        trackingWindow={{
          startHour: trackingSettings?.startHour ?? 7,
          endHour: trackingSettings?.endHour ?? 22,
        }}
        customEmotions={customEmotionRows}
        defaultHour={new Date().getHours()}
      />

      <section aria-labelledby="overview-heading" className="home-reveal home-delay-5 mt-8">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">The bigger picture</p>
          <h2 id="overview-heading" className="font-display text-3xl font-bold">Around your home</h2>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="home-panel home-lift lg:col-span-2">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Long view</p>
                <h3 className="font-display text-2xl font-bold">Roadmap progress</h3>
              </div>
              <Link href="/roadmaps" className="home-text-link text-sm font-bold">
                Explore <span aria-hidden>&rarr;</span>
              </Link>
            </div>
            {allRoadmaps.length === 0 ? (
              <EmptyState>No roadmaps yet. Create one to start tracking milestones.</EmptyState>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {allRoadmaps.map((roadmap) => {
                  const roadmapMilestones = allMilestones.filter((milestone) => milestone.roadmapId === roadmap.id);
                  const done = roadmapMilestones.filter((milestone) => milestone.status === "done").length;
                  const percentage = roadmapMilestones.length
                    ? Math.round((done / roadmapMilestones.length) * 100)
                    : 0;
                  return (
                    <Link
                      key={roadmap.id}
                      href={`/roadmaps/${roadmap.id}`}
                      className="home-roadmap rounded-xl border-2 border-ink/15 bg-background/60 p-4"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <p className="font-display text-lg font-bold leading-tight">{roadmap.title}</p>
                        <span className="font-display text-xl font-bold text-orange">{percentage}%</span>
                      </div>
                      <ProgressBar value={percentage} />
                      <p className="mt-2 text-xs font-semibold text-muted">
                        {done}/{roadmapMilestones.length} milestones complete
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="brut-border brut-shadow home-panel home-lift overflow-hidden rounded-lg border-t-[8px] border-t-blue bg-surface p-4 text-ink sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue">Money room</p>
                <h3 className="font-display text-2xl font-bold">Finance</h3>
              </div>
              <span aria-hidden className="rounded-full bg-blue/10 p-2 text-3xl">💰</span>
            </div>
            <div className="mt-7">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Total savings</p>
              <p className="font-display text-3xl font-bold">{formatINR(totalBalance)}</p>
            </div>
            <div className="my-5 h-px bg-ink/15" />
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Income this month</p>
            <p className="font-display text-2xl font-bold text-blue">{formatEUR(monthIncomeTotal)}</p>
            <Link
              href="/finance"
              className="brut-border brut-shadow-sm brut-press mt-6 inline-flex items-center gap-2 rounded-full bg-blue px-4 py-2 text-sm font-bold text-white"
            >
              Open finance <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

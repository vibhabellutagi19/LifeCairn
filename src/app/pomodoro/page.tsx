import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { pomodoroSessions, pomodoroSettings, projectTasks, projects, tasks as dailyTasks } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { PomodoroTimer, type PomodoroTask } from "@/components/PomodoroTimer";
import { PomodoroHistory } from "@/components/PomodoroHistory";
import { requireUserId } from "@/lib/auth";
import { rankFocusTasks } from "@/lib/focusNext";
import { shiftDateISO, todayISO } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import { isOpenTask } from "@/lib/taskStatus";

export const dynamic = "force-dynamic";

export default async function PomodoroPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string; start?: string }>;
}) {
  const userId = await requireUserId();
  const { task: requestedTask, start } = await searchParams;
  const today = todayISO();
  const [openTasks, todaysTasks, leftoverTasks, settings, recentSessions, [allTime]] = await Promise.all([
    db
      .select({
        id: projectTasks.id,
        title: projectTasks.title,
        priority: projectTasks.priority,
        status: projectTasks.status,
        dueDate: projectTasks.dueDate,
        projectName: projects.name,
      })
      .from(projectTasks)
      .innerJoin(projects, eq(projectTasks.projectId, projects.id))
      .where(eq(projectTasks.userId, userId)),
    db
      .select({ id: dailyTasks.id, title: dailyTasks.title })
      .from(dailyTasks)
      .where(and(eq(dailyTasks.userId, userId), eq(dailyTasks.date, today), eq(dailyTasks.completed, false)))
      .orderBy(dailyTasks.sortOrder, dailyTasks.id),
    db
      .select({ id: dailyTasks.id, title: dailyTasks.title, date: dailyTasks.date })
      .from(dailyTasks)
      .where(
        and(
          eq(dailyTasks.userId, userId),
          gte(dailyTasks.date, shiftDateISO(today, -14)),
          lt(dailyTasks.date, today),
          eq(dailyTasks.completed, false)
        )
      )
      .orderBy(dailyTasks.date, dailyTasks.id),
    db.query.pomodoroSettings.findFirst({ where: eq(pomodoroSettings.userId, userId) }),
    db
      .select()
      .from(pomodoroSessions)
      .where(and(eq(pomodoroSessions.userId, userId), gte(pomodoroSessions.date, shiftDateISO(today, -89))))
      .orderBy(desc(pomodoroSessions.date), desc(pomodoroSessions.completedAt)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        minutes: sql<number>`coalesce(sum(${pomodoroSessions.minutes}), 0)::int`,
      })
      .from(pomodoroSessions)
      .where(eq(pomodoroSessions.userId, userId)),
  ]);

  const openProject = openTasks.filter((task) => isOpenTask(task.status) && task.status !== "blocked");
  const overdueProject = openProject.filter((task) => task.dueDate && task.dueDate < today);
  const tasks: PomodoroTask[] = [
    // Unfinished dashboard tasks from earlier days, and project tasks past their due date.
    ...leftoverTasks.map((task) => ({
      id: `daily:${task.id}`,
      title: task.title,
      group: "overdue" as const,
      detail: `planned ${formatDateShort(task.date)}`,
    })),
    ...overdueProject.map((task) => ({
      id: String(task.id),
      title: task.title,
      group: "overdue" as const,
      detail: `${task.projectName} · due ${formatDateShort(task.dueDate!)}`,
    })),
    // Tasks added on the dashboard for today, still open.
    ...todaysTasks.map((task) => ({ id: `daily:${task.id}`, title: task.title, group: "today" as const })),
    ...rankFocusTasks(openProject.filter((task) => !overdueProject.includes(task)))
      .slice(0, 12)
      .map((task) => ({ id: String(task.id), title: task.title, group: "project" as const, detail: task.projectName })),
  ];

  // Opened from a dashboard 🍅 link: make sure that task is selectable even if it isn't in the lists above.
  if (requestedTask && !tasks.some((task) => task.id === requestedTask)) {
    const dailyId = /^daily:(\d+)$/.exec(requestedTask)?.[1];
    if (dailyId) {
      const row = await db.query.tasks.findFirst({
        where: and(eq(dailyTasks.id, Number(dailyId)), eq(dailyTasks.userId, userId)),
      });
      if (row) tasks.unshift({ id: requestedTask, title: row.title, group: "today" });
    } else if (/^\d+$/.test(requestedTask)) {
      const row = openTasks.find((task) => task.id === Number(requestedTask));
      if (row) tasks.push({ id: requestedTask, title: row.title, group: "project", detail: row.projectName });
    }
  }

  const todaySessions = recentSessions
    .filter((session) => session.date === today)
    .map((session) => ({
      id: session.id,
      minutes: session.minutes,
      taskTitle: session.taskTitle,
      completedAt: session.completedAt.toISOString(),
    }));

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Pomodoro" subtitle="One thing at a time. Focus, then a proper break." />
      <PomodoroTimer
        tasks={tasks}
        durations={{
          focus: settings?.focusMinutes ?? 25,
          short: settings?.shortBreakMinutes ?? 5,
          long: settings?.longBreakMinutes ?? 15,
        }}
        todaySessions={todaySessions}
        initialTaskId={tasks.some((task) => task.id === requestedTask) ? requestedTask : undefined}
        autoStart={start === "1"}
      />
      <PomodoroHistory sessions={recentSessions} today={today} allTime={allTime ?? { count: 0, minutes: 0 }} />
    </div>
  );
}

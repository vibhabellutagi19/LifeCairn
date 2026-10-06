import { desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { pomodoroSessions, pomodoroSettings, projectTasks, projects } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { PomodoroTimer } from "@/components/PomodoroTimer";
import { PomodoroHistory } from "@/components/PomodoroHistory";
import { rankFocusTasks } from "@/lib/focusNext";
import { shiftDateISO, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function PomodoroPage() {
  const today = todayISO();
  const [openTasks, settings, recentSessions, [allTime]] = await Promise.all([
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
      .innerJoin(projects, eq(projectTasks.projectId, projects.id)),
    db.query.pomodoroSettings.findFirst({ where: eq(pomodoroSettings.profileKey, "default") }),
    db
      .select()
      .from(pomodoroSessions)
      .where(gte(pomodoroSessions.date, shiftDateISO(today, -89)))
      .orderBy(desc(pomodoroSessions.date), desc(pomodoroSessions.completedAt)),
    db
      .select({
        count: sql<number>`count(*)::int`,
        minutes: sql<number>`coalesce(sum(${pomodoroSessions.minutes}), 0)::int`,
      })
      .from(pomodoroSessions),
  ]);

  const tasks = rankFocusTasks(
    openTasks.filter((task) => task.status !== "done" && task.status !== "blocked")
  )
    .slice(0, 12)
    .map((task) => ({ id: task.id, title: task.title, projectName: task.projectName }));

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
      />
      <PomodoroHistory sessions={recentSessions} today={today} allTime={allTime ?? { count: 0, minutes: 0 }} />
    </div>
  );
}

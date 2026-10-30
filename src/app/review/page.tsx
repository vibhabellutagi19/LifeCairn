import Link from "next/link";
import { and, eq, gte, lte, type AnyColumn } from "drizzle-orm";
import { addMonths, format } from "date-fns";
import { db } from "@/db";
import {
  financeEntries,
  habitLogs,
  habits,
  milestones,
  pomodoroSessions,
  projectTasks,
  projects,
  roadmaps,
  tasks,
} from "@/db/schema";
import { Badge, Card } from "@/components/ui";
import { getDisabledModules, requireModule } from "@/lib/moduleSettings";
import type { ModuleKey } from "@/lib/modules";
import { formatDateShort, formatEUR } from "@/lib/format";
import { currentMonthKey, monthRangeISO, shiftDateISO, todayISO, weekRangeISO } from "@/lib/dates";
import { clsx } from "clsx";

export const dynamic = "force-dynamic";

type Range = { start: string; end: string };

function daysIn(range: Range) {
  const days: string[] = [];
  for (let d = range.start; d <= range.end; d = shiftDateISO(d, 1)) days.push(d);
  return days;
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);
const weekdayShort = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" });

/** Everything the page shows for one period, so the current and previous period can be compared. */
async function loadPeriod(range: Range, today: string, userId: string) {
  const inRange = (column: AnyColumn, owner: AnyColumn) =>
    and(eq(owner, userId), gte(column, range.start), lte(column, range.end));
  const [
    dailyTasks,
    allHabits,
    logs,
    pomodoros,
    money,
    dueMilestones,
    dueProjectTasks,
  ] = await Promise.all([
    db.select({ completed: tasks.completed }).from(tasks).where(inRange(tasks.date, tasks.userId)),
    db.select().from(habits).where(eq(habits.userId, userId)),
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs)
      .where(eq(habitLogs.userId, userId)),
    db.select().from(pomodoroSessions).where(inRange(pomodoroSessions.date, pomodoroSessions.userId)),
    db.select({ type: financeEntries.type, amount: financeEntries.amount }).from(financeEntries).where(inRange(financeEntries.date, financeEntries.userId)),
    db
      .select({ id: milestones.id, title: milestones.title, status: milestones.status, targetDate: milestones.targetDate, roadmap: roadmaps.title })
      .from(milestones)
      .leftJoin(roadmaps, eq(milestones.roadmapId, roadmaps.id))
      .where(inRange(milestones.targetDate, milestones.userId)),
    db
      .select({ status: projectTasks.status, project: projects.name })
      .from(projectTasks)
      .innerJoin(projects, eq(projectTasks.projectId, projects.id))
      .where(inRange(projectTasks.dueDate, projectTasks.userId)),
  ]);

  const days = daysIn(range);
  const pastDays = days.filter((d) => d <= today);

  // Habits: a habit counts on a day from its creation (or first check-in, if backfilled earlier)
  // until it ends, while it is active.
  const firstLog = new Map<number, string>();
  for (const log of logs) {
    const current = firstLog.get(log.habitId);
    if (!current || log.date < current) firstLog.set(log.habitId, log.date);
  }
  const logSet = new Set(logs.map((log) => `${log.habitId}:${log.date}`));
  const habitDay = new Map<string, { done: number; due: number }>();
  const perHabit = allHabits
    .filter((h) => h.active)
    .map((h) => {
      const created = format(h.createdAt, "yyyy-MM-dd");
      const from = [created, firstLog.get(h.id)].filter(Boolean).sort()[0]!;
      let done = 0;
      let due = 0;
      for (const day of pastDays) {
        if (day < from || (h.endDate && day > h.endDate)) continue;
        const hit = logSet.has(`${h.id}:${day}`);
        due++;
        if (hit) done++;
        const cell = habitDay.get(day) ?? { done: 0, due: 0 };
        habitDay.set(day, { done: cell.done + (hit ? 1 : 0), due: cell.due + 1 });
      }
      return { title: h.title, done, due };
    })
    .filter((h) => h.due > 0)
    .sort((a, b) => pct(b.done, b.due) - pct(a.done, a.due));
  const habitDone = perHabit.reduce((sum, h) => sum + h.done, 0);
  const habitDue = perHabit.reduce((sum, h) => sum + h.due, 0);

  // Focus
  const focusByDay = new Map<string, number>();
  const focusByTask = new Map<string, number>();
  for (const p of pomodoros) {
    focusByDay.set(p.date, (focusByDay.get(p.date) ?? 0) + p.minutes);
    const key = p.taskTitle || "Free focus";
    focusByTask.set(key, (focusByTask.get(key) ?? 0) + p.minutes);
  }
  const focusMinutes = pomodoros.reduce((sum, p) => sum + p.minutes, 0);
  const topFocus = [...focusByTask.entries()].sort((a, b) => b[1] - a[1])[0];

  const income = money.filter((m) => m.type === "income").reduce((sum, m) => sum + Number(m.amount), 0);
  const expense = money.filter((m) => m.type === "expense").reduce((sum, m) => sum + Number(m.amount), 0);

  return {
    days,
    pastDays,
    dailyTasks: { done: dailyTasks.filter((t) => t.completed).length, total: dailyTasks.length },
    projectTasks: {
      done: dueProjectTasks.filter((t) => t.status === "done").length,
      total: dueProjectTasks.filter((t) => t.status !== "backlog").length,
    },
    habits: { done: habitDone, due: habitDue, percent: pct(habitDone, habitDue), perHabit, byDay: habitDay },
    focus: { minutes: focusMinutes, sessions: pomodoros.length, byDay: focusByDay, top: topFocus },
    money: { income, expense, net: income - expense },
    milestones: dueMilestones,
  };
}

function Delta({ now, before, unit = "" }: { now: number; before: number; unit?: string }) {
  if (now === before) return <span className="rv-delta is-flat">= same as last</span>;
  const up = now > before;
  return (
    <span className={clsx("rv-delta", up ? "is-up" : "is-down")}>
      {up ? "▲" : "▼"} {Math.abs(now - before)}
      {unit} vs last
    </span>
  );
}

function AreaCard({
  emoji,
  title,
  href,
  accent,
  children,
}: {
  emoji: string;
  title: string;
  href: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={clsx("home-lift flex min-w-0 flex-col border-t-[8px]", accent)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="font-display text-xl font-bold">
          <span aria-hidden className="mr-1.5">{emoji}</span>
          {title}
        </p>
        <Link href={href} className="home-text-link text-xs font-bold">
          Open <span aria-hidden>&rarr;</span>
        </Link>
      </div>
      <div className="flex flex-1 flex-col">{children}</div>
    </Card>
  );
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; anchor?: string }>;
}) {
  const userId = await requireModule("review");
  const disabledModules = await getDisabledModules(userId);
  const on = (key: ModuleKey) => !disabledModules.includes(key);
  const { period: periodParam, anchor: anchorParam } = await searchParams;
  const period = periodParam === "month" ? "month" : "week";
  const today = todayISO();
  const monthKey = anchorParam && period === "month" ? anchorParam : currentMonthKey();

  const range = period === "week" ? weekRangeISO(anchorParam || today) : monthRangeISO(monthKey);
  const previous =
    period === "week"
      ? weekRangeISO(shiftDateISO(range.start, -7))
      : monthRangeISO(format(addMonths(new Date(`${monthKey}-01T00:00:00`), -1), "yyyy-MM"));
  const isFuture = range.start > today;

  const [now, before] = await Promise.all([
    loadPeriod(range, today, userId),
    loadPeriod(previous, today, userId),
  ]);

  const prevAnchor = period === "week" ? previous.start : previous.start.slice(0, 7);
  const nextAnchor =
    period === "week" ? shiftDateISO(range.end, 1) : format(addMonths(new Date(`${monthKey}-01T00:00:00`), 1), "yyyy-MM");
  const isCurrent = period === "week" ? range.start <= today && today <= range.end : monthKey === currentMonthKey();
  const label = period === "week" ? `${formatDateShort(range.start)} – ${formatDateShort(range.end)}` : format(new Date(`${monthKey}-01T00:00:00`), "MMMM yyyy");

  const headline = [
    on("pomodoro") && now.focus.minutes ? `focused ${hours(now.focus.minutes)}` : null,
    on("habits") && now.habits.due ? `kept ${now.habits.percent}% of your habits` : null,
  ].filter(Boolean);

  const focusMax = Math.max(1, ...now.days.map((d) => now.focus.byDay.get(d) ?? 0));
  const atGlanceRows: { label: string; module: ModuleKey; cell: (day: string) => { text: string; level: number; title: string } }[] = [
    {
      label: "Habits",
      module: "habits",
      cell: (day) => {
        const c = now.habits.byDay.get(day);
        return { text: c ? `${c.done}/${c.due}` : "", level: c && c.due ? c.done / c.due : 0, title: c ? `${c.done} of ${c.due} habits` : "" };
      },
    },
    {
      label: "Focus",
      module: "pomodoro",
      cell: (day) => {
        const m = now.focus.byDay.get(day) ?? 0;
        return { text: m ? `${m}` : "", level: m / focusMax, title: m ? `${m} min focused` : "" };
      },
    },
  ];
  const glanceRows = atGlanceRows.filter((row) => on(row.module));
  const rowColor: Record<string, string> = {
    Habits: "var(--green)",
    Focus: "var(--orange)",
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="rv-hero relative mb-8 overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8 lg:p-10">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="rv-switch" role="group" aria-label="Period">
              {(["week", "month"] as const).map((p) => (
                <Link key={p} href={`/review?period=${p}`} aria-current={period === p ? "page" : undefined} className={clsx("rv-switch-btn", period === p && "is-active")}>
                  {p === "week" ? "Week" : "Month"}
                </Link>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/review?period=${period}&anchor=${prevAnchor}`} aria-label={`Previous ${period}`} className="rv-nav">
                ←
              </Link>
              {!isCurrent ? (
                <Link href={`/review?period=${period}`} className="rv-nav px-4 text-xs font-bold uppercase tracking-wide">
                  This {period}
                </Link>
              ) : null}
              <Link href={`/review?period=${period}&anchor=${nextAnchor}`} aria-label={`Next ${period}`} className="rv-nav">
                →
              </Link>
            </div>
          </div>

          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-yellow">{period === "week" ? "Week" : "Month"} in review</p>
          <h1 className="mt-1 font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-6xl">{label}</h1>
          <p className="mt-4 max-w-2xl text-base font-semibold text-white/75 sm:text-lg">
            {isFuture
              ? "This one hasn't happened yet. Go live it."
              : headline.length
                ? `You ${headline.join(", ").replace(/, ([^,]*)$/, " and $1")}.`
                : "Quiet so far. Every small check-in will show up here."}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { module: "pomodoro", label: "Focus", value: hours(now.focus.minutes), delta: <Delta now={now.focus.minutes} before={before.focus.minutes} unit="m" />, color: "bg-orange text-white" },
              { module: "habits", label: "Habits kept", value: `${now.habits.percent}%`, delta: <Delta now={now.habits.percent} before={before.habits.percent} unit="%" />, color: "bg-green text-white" },
            ]
              .filter((tile) => on(tile.module as ModuleKey))
              .map((tile, i) => (
              <div key={tile.label} className={clsx("pomo-stat brut-border rounded-2xl p-4", tile.color)} style={{ animationDelay: `${i * 90}ms` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">{tile.label}</p>
                <p className="mt-1 font-display text-3xl font-bold">{tile.value}</p>
                {tile.delta}
              </div>
            ))}
          </div>
        </div>
      </section>

      {glanceRows.length > 0 ? (
      <section aria-labelledby="glance-heading" className="mb-8">
        <h2 id="glance-heading" className="mb-3 font-display text-2xl font-bold sm:text-3xl">
          <span className="home-marker is-always">At a glance</span>
        </h2>
        <Card className="overflow-hidden !p-0">
          <div className="overflow-x-auto p-4">
            <table className="rv-glance w-full border-separate" style={{ borderSpacing: "4px" }}>
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-surface" />
                  {now.days.map((day) => (
                    <th key={day} className={clsx("min-w-9 text-center text-[10px] font-bold uppercase", day === today ? "text-orange" : "text-muted")}>
                      <span className="block">{weekdayShort(day)}</span>
                      <span className="block font-display text-sm text-ink">{Number(day.slice(8, 10))}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {glanceRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row" className="sticky left-0 z-10 bg-surface pr-2 text-left text-[10px] font-bold uppercase tracking-wide text-muted">
                      {row.label}
                    </th>
                    {now.days.map((day, i) => {
                      const future = day > today;
                      const c = future ? { text: "", level: 0, title: "" } : row.cell(day);
                      return (
                        <td
                          key={day}
                          title={c.title || undefined}
                          className={clsx("rv-cell", future && "is-future", day === today && "is-today")}
                          style={{ "--c": rowColor[row.label], "--l": c.level, animationDelay: `${i * 18}ms` } as React.CSSProperties}
                        >
                          {c.text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {on("pomodoro") ? (
        <AreaCard emoji="🍅" title="Focus" href="/pomodoro" accent="border-t-orange">
          <p className="font-display text-4xl font-bold">{hours(now.focus.minutes)}</p>
          <p className="text-sm font-semibold text-muted">
            {now.focus.sessions} {now.focus.sessions === 1 ? "pomodoro" : "pomodoros"}
            {now.focus.top ? ` · most on "${now.focus.top[0]}"` : ""}
          </p>
          <div className={clsx("mt-auto flex h-20 items-end pt-4", now.days.length > 10 ? "gap-px" : "gap-1")} aria-hidden>
            {now.days.map((day, i) => {
              const m = now.focus.byDay.get(day) ?? 0;
              return (
                <span
                  key={day}
                  className={clsx("pomo-bar min-w-0 flex-1 rounded-t border-ink", now.days.length > 10 ? "border" : "border-2", m ? "bg-orange" : "bg-ink/5")}
                  style={{ height: `${m ? Math.max(12, (m / focusMax) * 100) : 6}%`, animationDelay: `${i * 30}ms` }}
                />
              );
            })}
          </div>
        </AreaCard>
        ) : null}

        {on("habits") ? (
        <AreaCard emoji="🔥" title="Habits" href="/habits" accent="border-t-green">
          <p className="font-display text-4xl font-bold">{now.habits.percent}%</p>
          <p className="text-sm font-semibold text-muted">
            {now.habits.done} of {now.habits.due} check-ins kept
          </p>
          {now.habits.perHabit.length ? (
            <ul className="mt-4 space-y-2">
              {now.habits.perHabit.slice(0, 5).map((h, i) => (
                <li key={h.title}>
                  <div className="mb-0.5 flex justify-between gap-2 text-xs font-semibold">
                    <span className="truncate">{h.title}</span>
                    <span className="shrink-0 text-muted">
                      {h.done}/{h.due}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-ink/10">
                    <div className="progress-fill h-full rounded-full bg-green" style={{ width: `${pct(h.done, h.due)}%`, animationDelay: `${150 + i * 80}ms` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm font-semibold text-muted">No habits tracked in this period.</p>
          )}
        </AreaCard>
        ) : null}


        {(on("projects") || on("roadmaps")) ? (
        <AreaCard emoji="🧩" title="Work" href={on("projects") ? "/projects" : "/roadmaps"} accent="border-t-blue">
          <div className="grid grid-cols-2 gap-3">
            {on("projects") ? (
            <div className="rounded-xl border-2 border-ink/10 bg-background p-3">
              <p className="font-display text-2xl font-bold">
                {now.projectTasks.done}/{now.projectTasks.total}
              </p>
              <p className="text-[11px] font-semibold text-muted">project tasks due, done</p>
            </div>
            ) : null}
            <div className="rounded-xl border-2 border-ink/10 bg-background p-3">
              <p className="font-display text-2xl font-bold">
                {now.dailyTasks.done}/{now.dailyTasks.total}
              </p>
              <p className="text-[11px] font-semibold text-muted">daily tasks done</p>
            </div>
          </div>
          {on("roadmaps") ? (
          <>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Milestones due</p>
          {now.milestones.length ? (
            <ul className="mt-2 space-y-1.5">
              {now.milestones.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{m.title}</span>
                    <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                      {m.roadmap ?? "General"} · {m.targetDate ? formatDateShort(m.targetDate) : ""}
                    </span>
                  </span>
                  <Badge color={m.status === "done" ? "green" : m.status === "in_progress" ? "orange" : "muted"}>{m.status.replace("_", " ")}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm font-semibold text-muted">None this {period}.</p>
          )}
          </>
          ) : null}
        </AreaCard>
        ) : null}

        {on("finance") ? (
        <AreaCard emoji="💰" title="Money" href="/finance" accent="border-t-green">
          <p className={clsx("font-display text-4xl font-bold", now.money.net < 0 && "text-pink")}>{formatEUR(now.money.net)}</p>
          <p className="text-sm font-semibold text-muted">net cash flow</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-ink/10 bg-green/10 p-3">
              <p className="font-display text-xl font-bold text-green">+{formatEUR(now.money.income)}</p>
              <p className="text-[11px] font-semibold text-muted">income</p>
            </div>
            <div className="rounded-xl border-2 border-ink/10 bg-pink/10 p-3">
              <p className="font-display text-xl font-bold text-pink">−{formatEUR(now.money.expense)}</p>
              <p className="text-[11px] font-semibold text-muted">expenses</p>
            </div>
          </div>
        </AreaCard>
        ) : null}
      </div>
    </div>
  );
}

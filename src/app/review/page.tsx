import Link from "next/link";
import { and, eq, gte, lte, type AnyColumn } from "drizzle-orm";
import { addMonths, format } from "date-fns";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  customEmotions,
  emotionalCheckins,
  financeEntries,
  habitLogs,
  habits,
  hooponoponoRounds,
  journalEntries,
  milestones,
  pomodoroSessions,
  projectTasks,
  projects,
  roadmaps,
  tasks,
} from "@/db/schema";
import { Badge, Card } from "@/components/ui";
import { customEmotionKey, EMOTIONS, type EmotionCategory } from "@/lib/emotions";
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
async function loadPeriod(range: Range, today: string) {
  const inRange = (column: AnyColumn) => and(gte(column, range.start), lte(column, range.end));
  const [
    dailyTasks,
    allHabits,
    logs,
    pomodoros,
    feelings,
    customRows,
    affirmationRows,
    journals,
    hooRounds,
    money,
    dueMilestones,
    dueProjectTasks,
    wins,
  ] = await Promise.all([
    db.select({ completed: tasks.completed }).from(tasks).where(inRange(tasks.date)),
    db.select().from(habits),
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs),
    db.select().from(pomodoroSessions).where(inRange(pomodoroSessions.date)),
    db.select({ date: emotionalCheckins.date, emotion: emotionalCheckins.emotion }).from(emotionalCheckins).where(inRange(emotionalCheckins.date)),
    db.select({ id: customEmotions.id, name: customEmotions.name, emoji: customEmotions.emoji, category: customEmotions.category }).from(customEmotions),
    db.select({ date: affirmationCheckins.date }).from(affirmationCheckins).where(inRange(affirmationCheckins.date)),
    db.select({ date: journalEntries.date, content: journalEntries.content, gratitude: journalEntries.gratitude }).from(journalEntries).where(inRange(journalEntries.date)),
    db.select({ date: hooponoponoRounds.date, repetitions: hooponoponoRounds.repetitions }).from(hooponoponoRounds).where(inRange(hooponoponoRounds.date)),
    db.select({ type: financeEntries.type, amount: financeEntries.amount }).from(financeEntries).where(inRange(financeEntries.date)),
    db
      .select({ id: milestones.id, title: milestones.title, status: milestones.status, targetDate: milestones.targetDate, roadmap: roadmaps.title })
      .from(milestones)
      .leftJoin(roadmaps, eq(milestones.roadmapId, roadmaps.id))
      .where(inRange(milestones.targetDate)),
    db
      .select({ status: projectTasks.status, project: projects.name })
      .from(projectTasks)
      .innerJoin(projects, eq(projectTasks.projectId, projects.id))
      .where(inRange(projectTasks.dueDate)),
    db.select().from(affirmationManifestations).where(inRange(affirmationManifestations.manifestedOn)),
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

  // Feelings
  const lookup = new Map<string, { emoji: string; label: string; category: EmotionCategory }>([
    ...EMOTIONS.map((e) => [e.key, { emoji: e.emoji, label: e.label, category: e.category }] as const),
    ...customRows.map((e) => [customEmotionKey(e.id), { emoji: e.emoji, label: e.name, category: e.category }] as const),
  ]);
  const feelingCount = { positive: 0, negative: 0, missing: 0 };
  const feelingTally = new Map<string, { emoji: string; label: string; count: number }>();
  const moodByDay = new Map<string, Map<string, { emoji: string; count: number }>>();
  for (const f of feelings) {
    const option = lookup.get(f.emotion);
    if (!option) continue;
    feelingCount[option.category]++;
    const t = feelingTally.get(option.label) ?? { emoji: option.emoji, label: option.label, count: 0 };
    feelingTally.set(option.label, { ...t, count: t.count + 1 });
    const day = moodByDay.get(f.date) ?? new Map();
    const c = day.get(option.label) ?? { emoji: option.emoji, count: 0 };
    day.set(option.label, { ...c, count: c.count + 1 });
    moodByDay.set(f.date, day);
  }
  const feelingTotal = feelingCount.positive + feelingCount.negative + feelingCount.missing;
  const topFeelings = [...feelingTally.values()].sort((a, b) => b.count - a.count).slice(0, 4);

  // Practice
  const slotsByDay = new Map<string, number>();
  for (const row of affirmationRows) slotsByDay.set(row.date, (slotsByDay.get(row.date) ?? 0) + 1);
  const affirmationFullDays = [...slotsByDay.values()].filter((n) => n >= 3).length;
  const journalDays = new Set(journals.filter((j) => j.content.trim() || j.gratitude?.trim()).map((j) => j.date));
  const gratitude = journals.flatMap((j) => (j.gratitude ?? "").split("\n").map((line) => line.trim()).filter(Boolean));
  const hooByDay = new Map<string, number>();
  for (const round of hooRounds) hooByDay.set(round.date, (hooByDay.get(round.date) ?? 0) + round.repetitions);
  const hooReps = hooRounds.reduce((sum, r) => sum + r.repetitions, 0);

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
    feelings: { count: feelingCount, total: feelingTotal, positivePercent: pct(feelingCount.positive, feelingTotal), top: topFeelings, byDay: moodByDay },
    practice: { affirmationFullDays, slotsByDay, journalDays, gratitude, hooReps, hooSessions: hooRounds.length, hooByDay },
    money: { income, expense, net: income - expense },
    milestones: dueMilestones,
    wins,
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

  const [now, before] = await Promise.all([loadPeriod(range, today), loadPeriod(previous, today)]);

  const prevAnchor = period === "week" ? previous.start : previous.start.slice(0, 7);
  const nextAnchor =
    period === "week" ? shiftDateISO(range.end, 1) : format(addMonths(new Date(`${monthKey}-01T00:00:00`), 1), "yyyy-MM");
  const isCurrent = period === "week" ? range.start <= today && today <= range.end : monthKey === currentMonthKey();
  const label = period === "week" ? `${formatDateShort(range.start)} – ${formatDateShort(range.end)}` : format(new Date(`${monthKey}-01T00:00:00`), "MMMM yyyy");

  const mostly = now.feelings.top[0];
  const headline = [
    now.focus.minutes ? `focused ${hours(now.focus.minutes)}` : null,
    now.habits.due ? `kept ${now.habits.percent}% of your habits` : null,
    mostly ? `felt mostly ${mostly.emoji} ${mostly.label.toLowerCase()}` : null,
  ].filter(Boolean);

  const focusMax = Math.max(1, ...now.days.map((d) => now.focus.byDay.get(d) ?? 0));
  const atGlanceRows: { label: string; cell: (day: string) => { text: string; level: number; title: string } }[] = [
    {
      label: "Mood",
      cell: (day) => {
        const top = [...(now.feelings.byDay.get(day)?.values() ?? [])].sort((a, b) => b.count - a.count)[0];
        return { text: top?.emoji ?? "", level: top ? 0.35 : 0, title: top ? `Mostly ${top.emoji}` : "No check-ins" };
      },
    },
    {
      label: "Habits",
      cell: (day) => {
        const c = now.habits.byDay.get(day);
        return { text: c ? `${c.done}/${c.due}` : "", level: c && c.due ? c.done / c.due : 0, title: c ? `${c.done} of ${c.due} habits` : "" };
      },
    },
    {
      label: "Focus",
      cell: (day) => {
        const m = now.focus.byDay.get(day) ?? 0;
        return { text: m ? `${m}` : "", level: m / focusMax, title: m ? `${m} min focused` : "" };
      },
    },
    {
      label: "Affirm",
      cell: (day) => {
        const n = now.practice.slotsByDay.get(day) ?? 0;
        return { text: n >= 3 ? "✓" : n ? `${n}/3` : "", level: n / 3, title: `${n} of 3 check-ins` };
      },
    },
    {
      label: "Journal",
      cell: (day) => ({ text: now.practice.journalDays.has(day) ? "✎" : "", level: now.practice.journalDays.has(day) ? 1 : 0, title: now.practice.journalDays.has(day) ? "Journaled" : "" }),
    },
    {
      label: "Hoʻopono",
      cell: (day) => {
        const r = now.practice.hooByDay.get(day) ?? 0;
        return { text: r ? "🌺" : "", level: r ? 1 : 0, title: r ? `${r} repetitions` : "" };
      },
    },
  ];
  const rowColor: Record<string, string> = {
    Mood: "var(--pink)",
    Habits: "var(--green)",
    Focus: "var(--orange)",
    Affirm: "var(--yellow)",
    Journal: "var(--blue)",
    "Hoʻopono": "var(--pink)",
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="rv-hero relative mb-8 overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8 lg:p-10">
        <span aria-hidden className="mood-star mood-star-1">✦</span>
        <span aria-hidden className="mood-star mood-star-3">✧</span>
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
              { label: "Focus", value: hours(now.focus.minutes), delta: <Delta now={now.focus.minutes} before={before.focus.minutes} unit="m" />, color: "bg-orange text-white" },
              { label: "Habits kept", value: `${now.habits.percent}%`, delta: <Delta now={now.habits.percent} before={before.habits.percent} unit="%" />, color: "bg-green text-white" },
              { label: "Feeling good", value: now.feelings.total ? `${now.feelings.positivePercent}%` : "–", delta: <Delta now={now.feelings.positivePercent} before={before.feelings.positivePercent} unit="%" />, color: "bg-pink text-white" },
              { label: "Full affirmation days", value: String(now.practice.affirmationFullDays), delta: <Delta now={now.practice.affirmationFullDays} before={before.practice.affirmationFullDays} />, color: "bg-yellow text-ink" },
            ].map((tile, i) => (
              <div key={tile.label} className={clsx("pomo-stat brut-border rounded-2xl p-4", tile.color)} style={{ animationDelay: `${i * 90}ms` }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">{tile.label}</p>
                <p className="mt-1 font-display text-3xl font-bold">{tile.value}</p>
                {tile.delta}
              </div>
            ))}
          </div>
        </div>
      </section>

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
                {atGlanceRows.map((row) => (
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

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
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

        <AreaCard emoji="◌" title="Feelings" href="/manifestation" accent="border-t-pink">
          <p className="font-display text-4xl font-bold">{now.feelings.total}</p>
          <p className="text-sm font-semibold text-muted">hourly check-ins</p>
          {now.feelings.total ? (
            <>
              <div className="mt-4 flex h-4 overflow-hidden rounded-full border-2 border-ink" aria-label="Positive, negative and wanted feelings">
                <span className="bg-green" style={{ width: `${pct(now.feelings.count.positive, now.feelings.total)}%` }} />
                <span className="bg-orange" style={{ width: `${pct(now.feelings.count.negative, now.feelings.total)}%` }} />
                <span className="bg-pink" style={{ width: `${pct(now.feelings.count.missing, now.feelings.total)}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {now.feelings.top.map((f) => (
                  <span key={f.label} className="rounded-full border-2 border-ink/15 bg-background px-2.5 py-1 text-xs font-bold">
                    {f.emoji} {f.label} ×{f.count}
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-4 text-sm font-semibold text-muted">No feelings logged yet.</p>
          )}
        </AreaCard>

        <AreaCard emoji="✨" title="Practice" href="/affirmations" accent="border-t-yellow">
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: `${now.practice.affirmationFullDays}/${now.pastDays.length || 0}`, label: "full affirmation days" },
              { value: String(now.practice.journalDays.size), label: "journal days" },
              { value: String(now.practice.gratitude.length), label: "gratitude notes" },
              { value: now.practice.hooReps.toLocaleString("en-IN"), label: `hoʻoponopono · ${now.practice.hooSessions}×` },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border-2 border-ink/10 bg-background p-3">
                <p className="font-display text-2xl font-bold">{stat.value}</p>
                <p className="text-[11px] font-semibold text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </AreaCard>

        <AreaCard emoji="🧩" title="Work" href="/projects" accent="border-t-blue">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border-2 border-ink/10 bg-background p-3">
              <p className="font-display text-2xl font-bold">
                {now.projectTasks.done}/{now.projectTasks.total}
              </p>
              <p className="text-[11px] font-semibold text-muted">project tasks due, done</p>
            </div>
            <div className="rounded-xl border-2 border-ink/10 bg-background p-3">
              <p className="font-display text-2xl font-bold">
                {now.dailyTasks.done}/{now.dailyTasks.total}
              </p>
              <p className="text-[11px] font-semibold text-muted">daily tasks done</p>
            </div>
          </div>
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
        </AreaCard>

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
      </div>

      <section aria-labelledby="highlights-heading" className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div>
          <h2 id="highlights-heading" className="mb-3 font-display text-2xl font-bold sm:text-3xl">
            <span className="home-marker is-always">Grateful for</span>
          </h2>
          <Card className="min-h-40">
            {now.practice.gratitude.length ? (
              <div className="flex flex-wrap gap-2">
                {now.practice.gratitude.slice(0, 16).map((item, i) => (
                  <span
                    key={`${i}-${item}`}
                    className={clsx("jar-note", ["bg-yellow", "bg-pink text-white", "bg-green text-white", "bg-blue text-white", "bg-orange text-white"][i % 5])}
                    style={{ "--tilt": ["-2deg", "1.5deg", "-1deg", "2deg"][i % 4], animationDelay: `${Math.min(i, 10) * 50}ms` } as React.CSSProperties}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-muted">
                Nothing in the gratitude jar for this {period}.{" "}
                <Link href="/manifestation" className="home-text-link font-bold">
                  Add one <span aria-hidden>&rarr;</span>
                </Link>
              </p>
            )}
          </Card>
        </div>
        <div>
          <h2 className="mb-3 font-display text-2xl font-bold sm:text-3xl">
            <span className="home-marker is-always">Wins</span>
          </h2>
          <Card className="min-h-40">
            {now.wins.length ? (
              <ul className="space-y-3">
                {now.wins.map((win) => (
                  <li key={win.id} className="win-card relative overflow-hidden rounded-xl border-[3px] border-ink p-3" style={{ "--tilt": "0deg" } as React.CSSProperties}>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-pink">🏆 {formatDateShort(win.manifestedOn)}</p>
                    <p className="mt-1 font-display font-semibold leading-snug">“{win.affirmationText}”</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-muted">
                No affirmations marked as manifested in this {period}. They&rsquo;ll be celebrated here.
              </p>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

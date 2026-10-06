import { format } from "date-fns";
import { Card } from "@/components/ui";
import { deletePomodoroSession } from "@/lib/actions/pomodoro";
import { shiftDateISO } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";

export type PomodoroHistorySession = {
  id: number;
  date: string;
  minutes: number;
  taskTitle: string | null;
  completedAt: Date;
};

function weekday(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === shiftDateISO(today, -1)) return "Yesterday";
  return `${weekday(date)}, ${formatDateShort(date)}`;
}

function hoursLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function PomodoroHistory({
  sessions,
  today,
  allTime,
}: {
  /** Recent sessions, newest first. */
  sessions: PomodoroHistorySession[];
  today: string;
  allTime: { count: number; minutes: number };
}) {
  const byDate = new Map<string, PomodoroHistorySession[]>();
  for (const session of sessions) {
    byDate.set(session.date, [...(byDate.get(session.date) ?? []), session]);
  }

  // Streak: consecutive days with at least one pomodoro, allowing today to still be empty.
  let streak = 0;
  let cursor = byDate.has(today) ? today : shiftDateISO(today, -1);
  while (byDate.has(cursor)) {
    streak++;
    cursor = shiftDateISO(cursor, -1);
  }

  const best = [...byDate.entries()].reduce<{ date: string; count: number } | null>(
    (top, [date, list]) => (!top || list.length > top.count ? { date, count: list.length } : top),
    null
  );

  const chartDays = Array.from({ length: 14 }, (_, i) => shiftDateISO(today, i - 13));
  const chartMax = Math.max(1, ...chartDays.map((d) => byDate.get(d)?.length ?? 0));

  const taskMinutes = new Map<string, number>();
  for (const session of sessions) {
    const key = session.taskTitle || "Free focus";
    taskMinutes.set(key, (taskMinutes.get(key) ?? 0) + session.minutes);
  }
  const topTasks = [...taskMinutes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topMax = topTasks[0]?.[1] ?? 1;

  const recentDays = [...byDate.keys()].slice(0, 10);

  return (
    <section aria-labelledby="pomodoro-history-heading" className="mt-8">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Every tomato counts</p>
        <h2 id="pomodoro-history-heading" className="font-display text-3xl font-bold">History</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "All-time", value: String(allTime.count), hint: "pomodoros", color: "bg-orange text-white" },
          { label: "Focused", value: hoursLabel(allTime.minutes), hint: "in total", color: "bg-green text-white" },
          { label: "Streak", value: `${streak}🔥`, hint: streak === 1 ? "day" : "days in a row", color: "bg-yellow text-ink" },
          {
            label: "Best day",
            value: best ? String(best.count) : "–",
            hint: best ? dayLabel(best.date, today) : "no sessions yet",
            color: "bg-blue text-white",
          },
        ].map((tile, i) => (
          <div
            key={tile.label}
            className={`pomo-stat brut-border brut-shadow rounded-2xl p-4 ${tile.color}`}
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">{tile.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{tile.value}</p>
            <p className="text-xs font-semibold opacity-80">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Last 14 days</p>
          <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2" role="list" aria-label="Pomodoros per day, last 14 days">
            {chartDays.map((date, i) => {
              const count = byDate.get(date)?.length ?? 0;
              const minutes = (byDate.get(date) ?? []).reduce((sum, s) => sum + s.minutes, 0);
              const isToday = date === today;
              return (
                <div key={date} role="listitem" className="pomo-bar-col group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-bold text-muted opacity-0 transition-opacity group-hover:opacity-100">
                    {count ? hoursLabel(minutes) : ""}
                  </span>
                  <div
                    className={`pomo-bar w-full rounded-t-md border-2 border-ink ${count ? (isToday ? "bg-orange" : "bg-orange/70") : "bg-ink/5"}`}
                    style={{ height: `${count ? Math.max(10, (count / chartMax) * 100) : 4}%`, animationDelay: `${i * 35}ms` }}
                    aria-label={`${dayLabel(date, today)}: ${count} ${count === 1 ? "pomodoro" : "pomodoros"}`}
                  >
                    {count ? <span className="block pt-0.5 text-center text-[10px] font-bold text-white">{count}</span> : null}
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${isToday ? "text-orange" : "text-muted"}`}>
                    {weekday(date).slice(0, 2)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Where your focus went</p>
          {topTasks.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-muted">Pick a task before you start to see it here.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topTasks.map(([title, minutes], i) => (
                <li key={title}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm font-semibold">
                    <span className="truncate">{title}</span>
                    <span className="shrink-0 font-display text-muted">{hoursLabel(minutes)}</span>
                  </div>
                  <div className="brut-border h-3 overflow-hidden rounded-full bg-surface">
                    <div
                      className="progress-fill h-full bg-pink"
                      style={{ width: `${(minutes / topMax) * 100}%`, animationDelay: `${200 + i * 80}ms` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Sessions</p>
        {recentDays.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-muted">No sessions yet. Your first one will show up here.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {recentDays.map((date) => {
              const list = byDate.get(date)!;
              return (
                <div key={date}>
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="font-display text-lg font-bold">{dayLabel(date, today)}</h3>
                    <span aria-hidden className="text-sm">{"🍅".repeat(Math.min(list.length, 12))}</span>
                    <span className="ml-auto text-xs font-bold text-muted">
                      {list.length} · {hoursLabel(list.reduce((sum, s) => sum + s.minutes, 0))}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {list.map((session) => (
                      <li key={session.id} className="pomo-session brut-border flex items-center gap-3 rounded-md bg-surface px-3 py-2 text-sm">
                        <span className="font-display font-bold tabular-nums text-muted">{format(session.completedAt, "HH:mm")}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{session.taskTitle || "Free focus"}</span>
                        <span className="rounded-full bg-orange/10 px-2 py-0.5 text-xs font-bold text-orange">{session.minutes}m</span>
                        <form action={deletePomodoroSession.bind(null, session.id)}>
                          <button
                            type="submit"
                            aria-label="Delete session"
                            className="flex h-9 w-9 items-center justify-center text-muted hover:text-pink sm:h-7 sm:w-7"
                          >
                            ✕
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </section>
  );
}

import { format } from "date-fns";
import { Card } from "@/components/ui";
import { deleteHooponoponoSession } from "@/lib/actions/hooponopono";
import { shiftDateISO } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";

export type HooponoponoSession = {
  id: number;
  date: string;
  repetitions: number;
  target: number | null;
  intention: string | null;
  note: string | null;
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

export function HooponoponoHistory({ sessions, today }: { sessions: HooponoponoSession[]; today: string }) {
  const byDate = new Map<string, HooponoponoSession[]>();
  for (const session of sessions) byDate.set(session.date, [...(byDate.get(session.date) ?? []), session]);
  const sumReps = (list: HooponoponoSession[]) => list.reduce((sum, s) => sum + s.repetitions, 0);

  let streak = 0;
  for (let day = byDate.has(today) ? today : shiftDateISO(today, -1); byDate.has(day); day = shiftDateISO(day, -1)) streak++;

  const weekStart = shiftDateISO(today, -6);
  const weekReps = sumReps(sessions.filter((s) => s.date >= weekStart));
  const totalReps = sumReps(sessions);

  const chartDays = Array.from({ length: 14 }, (_, i) => shiftDateISO(today, i - 13));
  const chartMax = Math.max(1, ...chartDays.map((d) => sumReps(byDate.get(d) ?? [])));

  const intentionReps = new Map<string, { reps: number; sessions: number }>();
  for (const session of sessions) {
    const key = session.intention?.trim();
    if (!key) continue;
    const current = intentionReps.get(key) ?? { reps: 0, sessions: 0 };
    intentionReps.set(key, { reps: current.reps + session.repetitions, sessions: current.sessions + 1 });
  }
  const topIntentions = [...intentionReps.entries()].sort((a, b) => b[1].reps - a[1].reps).slice(0, 6);
  const topMax = topIntentions[0]?.[1].reps ?? 1;

  return (
    <section aria-labelledby="hoo-history-heading" className="mt-8">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink">Every word counts</p>
        <h2 id="hoo-history-heading" className="font-display text-3xl font-bold">History</h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sessions", value: sessions.length.toLocaleString("en-IN"), hint: "all time", color: "bg-pink text-white" },
          { label: "Repetitions", value: totalReps.toLocaleString("en-IN"), hint: "times said", color: "bg-orange text-white" },
          { label: "Streak", value: `${streak}🔥`, hint: streak === 1 ? "day" : "days in a row", color: "bg-yellow text-ink" },
          { label: "This week", value: weekReps.toLocaleString("en-IN"), hint: "repetitions", color: "bg-green text-white" },
        ].map((tile, i) => (
          <div key={tile.label} className={`pomo-stat brut-border brut-shadow rounded-2xl p-4 ${tile.color}`} style={{ animationDelay: `${i * 90}ms` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-75">{tile.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{tile.value}</p>
            <p className="text-xs font-semibold opacity-80">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Repetitions, last 14 days</p>
          <div className="mt-4 flex h-44 items-end gap-1.5 sm:gap-2" role="list" aria-label="Repetitions per day, last 14 days">
            {chartDays.map((date, i) => {
              const reps = sumReps(byDate.get(date) ?? []);
              const isToday = date === today;
              return (
                <div key={date} role="listitem" className="pomo-bar-col group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] font-bold text-muted opacity-0 transition-opacity group-hover:opacity-100">
                    {reps ? `${byDate.get(date)!.length}×` : ""}
                  </span>
                  <div
                    className={`pomo-bar w-full rounded-t-md border-2 border-ink ${reps ? (isToday ? "bg-pink" : "bg-pink/60") : "bg-ink/5"}`}
                    style={{ height: `${reps ? Math.max(10, (reps / chartMax) * 100) : 4}%`, animationDelay: `${i * 35}ms` }}
                    aria-label={`${dayLabel(date, today)}: ${reps} repetitions`}
                  >
                    {reps ? <span className="block truncate pt-0.5 text-center text-[9px] font-bold text-white">{reps}</span> : null}
                  </div>
                  <span className={`text-[10px] font-bold uppercase ${isToday ? "text-pink" : "text-muted"}`}>{weekday(date).slice(0, 2)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Held in your heart</p>
          {topIntentions.length === 0 ? (
            <p className="mt-4 text-sm font-semibold text-muted">Add who or what a session is for, and it will gather here.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {topIntentions.map(([name, stat], i) => (
                <li key={name}>
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm font-semibold">
                    <span className="truncate">🌺 {name}</span>
                    <span className="shrink-0 font-display text-muted">
                      {stat.reps.toLocaleString("en-IN")} · {stat.sessions}×
                    </span>
                  </div>
                  <div className="brut-border h-3 overflow-hidden rounded-full bg-surface">
                    <div className="progress-fill h-full bg-pink" style={{ width: `${(stat.reps / topMax) * 100}%`, animationDelay: `${200 + i * 80}ms` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Sessions</p>
        {sessions.length === 0 ? (
          <p className="mt-4 text-sm font-semibold text-muted">No sessions yet. Your first one will show up here.</p>
        ) : (
          <div className="mt-3 space-y-5">
            {[...byDate.entries()].map(([date, list]) => (
              <div key={date}>
                <div className="mb-2 flex items-center gap-3">
                  <h3 className="font-display text-lg font-bold">{dayLabel(date, today)}</h3>
                  <span aria-hidden className="text-sm">{"🌺".repeat(Math.min(list.length, 10))}</span>
                  <span className="ml-auto text-xs font-bold text-muted">
                    {list.length} {list.length === 1 ? "session" : "sessions"} · {sumReps(list).toLocaleString("en-IN")} said
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {list.map((session) => (
                    <li key={session.id} className="pomo-session brut-border rounded-md bg-surface px-3 py-2 text-sm">
                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold tabular-nums text-muted">{format(session.completedAt, "HH:mm")}</span>
                        <span className="min-w-0 flex-1 truncate font-semibold">{session.intention || "Open-hearted cleaning"}</span>
                        <span className="rounded-full bg-pink/10 px-2 py-0.5 text-xs font-bold text-pink">
                          {session.repetitions}
                          {session.target ? (session.repetitions >= session.target ? ` / ${session.target} ✓` : ` / ${session.target}`) : " · open"}
                        </span>
                        <form action={deleteHooponoponoSession.bind(null, session.id)}>
                          <button type="submit" aria-label="Delete session" className="flex h-9 w-9 items-center justify-center text-muted hover:text-pink sm:h-7 sm:w-7">
                            ✕
                          </button>
                        </form>
                      </div>
                      {session.note ? (
                        <p className="mt-1.5 whitespace-pre-line border-t border-ink/10 pt-1.5 text-sm font-medium leading-relaxed text-ink/75">{session.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}

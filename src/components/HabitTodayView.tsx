"use client";

import { useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { GridHabit } from "@/components/HabitCalendarGrid";
import { deleteHabit, toggleHabitActive, toggleHabitLog, updateHabit } from "@/lib/actions/habits";
import { burstConfetti } from "@/lib/confetti";
import { shiftDateISO } from "@/lib/dates";

type Toggle = { habitId: number; date: string; checked: boolean };

function weekdayLetter(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" });
}

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  if (date === shiftDateISO(today, -1)) return "Yesterday";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

/** Phone-first view: pick a day from the week strip, tap a big card to check it in. */
export function HabitTodayView({
  habits,
  today,
  roadmaps,
}: {
  habits: GridHabit[];
  today: string;
  roadmaps: { id: number; title: string }[];
}) {
  const [selected, setSelected] = useState(today);
  const [checkedDates, applyToggle] = useOptimistic(
    Object.fromEntries(habits.map((h) => [h.id, h.checkedDates])) as Record<number, string[]>,
    (state, { habitId, date, checked }: Toggle) => ({
      ...state,
      [habitId]: checked
        ? [...new Set([...(state[habitId] ?? []), date])]
        : (state[habitId] ?? []).filter((d) => d !== date),
    })
  );
  const [, startTransition] = useTransition();

  const week = Array.from({ length: 7 }, (_, i) => shiftDateISO(today, i - 6));
  const activeOn = (date: string) => habits.filter((h) => !h.endDate || h.endDate >= date);
  const isChecked = (habitId: number, date: string) => (checkedDates[habitId] ?? []).includes(date);

  const visible = activeOn(selected);
  const doneCount = visible.filter((h) => isChecked(h.id, selected)).length;
  const total = visible.length;
  const left = total - doneCount;
  const percent = total ? Math.round((doneCount / total) * 100) : 0;
  const allDone = total > 0 && left === 0;
  const bestStreak = Math.max(0, ...habits.map((h) => h.currentStreak));

  function toggle(habit: GridHabit, source: Element) {
    const next = !isChecked(habit.id, selected);
    if (next) {
      vibrate(12);
      burstConfetti(source, 10, ["✦", "✨", "🔥"]);
    }
    startTransition(async () => {
      applyToggle({ habitId: habit.id, date: selected, checked: next });
      await toggleHabitLog(habit.id, selected, next);
    });
  }

  return (
    <div className="space-y-4">
      <div className="hab-week -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Pick a day">
        {week.map((date) => {
          const day = activeOn(date);
          const done = day.filter((h) => isChecked(h.id, date)).length;
          const isSel = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              aria-pressed={isSel}
              aria-label={`${dayLabel(date, today)}: ${done} of ${day.length} done`}
              className={clsx("hab-day", isSel && "is-selected", date === today && "is-today")}
            >
              <span className="text-[10px] font-bold uppercase opacity-70">{weekdayLetter(date)}</span>
              <span className="font-display text-lg font-bold leading-none">{Number(date.slice(8, 10))}</span>
              <span className="hab-day-bar" aria-hidden>
                <span style={{ width: `${day.length ? (done / day.length) * 100 : 0}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <section className={clsx("hab-hero relative overflow-hidden rounded-3xl p-4 text-white", allDone && "is-complete")} aria-live="polite">
        <div className="relative z-10 flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx={36} cy={36} r={RING_R} fill="none" strokeWidth={8} stroke="rgb(255 255 255 / 0.15)" />
              <circle
                cx={36}
                cy={36}
                r={RING_R}
                fill="none"
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C * (1 - percent / 100)}
                className="hab-ring"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center font-display text-xl font-bold">{percent}%</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">{dayLabel(selected, today)}</p>
            <p className="font-display text-2xl font-bold leading-tight">
              {total === 0 ? "No habits yet" : allDone ? "All done 🎉" : `${left} left`}
            </p>
            <p className="text-xs font-semibold text-white/65">
              {total === 0
                ? "Tap + to add your first one."
                : allDone
                  ? "Rhythm complete. Rest well."
                  : selected === today
                    ? "Tap a card when it is done."
                    : "Backfilling a past day."}
            </p>
          </div>
          {bestStreak > 0 ? (
            <div className="shrink-0 rounded-2xl border-2 border-white/20 bg-white/10 px-3 py-2 text-center">
              <p className="font-display text-xl font-bold leading-none">{bestStreak}🔥</p>
              <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-white/60">best streak</p>
            </div>
          ) : null}
        </div>
      </section>

      <ul className="space-y-3">
        {visible.map((habit, index) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            index={index}
            selected={selected}
            today={today}
            checked={isChecked(habit.id, selected)}
            history={week.map((date) => ({ date, done: isChecked(habit.id, date) }))}
            onToggle={toggle}
            roadmaps={roadmaps}
          />
        ))}
      </ul>
    </div>
  );
}

function HabitCard({
  habit,
  index,
  selected,
  today,
  checked,
  history,
  onToggle,
  roadmaps,
}: {
  habit: GridHabit;
  index: number;
  selected: string;
  today: string;
  checked: boolean;
  history: { date: string; done: boolean }[];
  onToggle: (habit: GridHabit, source: Element) => void;
  roadmaps: { id: number; title: string }[];
}) {
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState(habit.title);
  const [roadmapId, setRoadmapId] = useState(habit.roadmapId ? String(habit.roadmapId) : "");
  const [endDate, setEndDate] = useState(habit.endDate ?? "");
  const [isPending, startTransition] = useTransition();

  // Streak shown is the server's, nudged by today's optimistic tap so it feels instant.
  const serverToday = habit.checkedDates.includes(today);
  const nowToday = history[history.length - 1]?.done ?? false;
  const streak = Math.max(0, habit.currentStreak + (nowToday && !serverToday ? 1 : 0) - (!nowToday && serverToday ? 1 : 0));

  return (
    <li className={clsx("hab-card", checked && "is-done")} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={(event) => onToggle(habit, event.currentTarget)}
          aria-pressed={checked}
          aria-label={`${habit.title}: ${checked ? "done, tap to undo" : "tap to check in"}`}
          className="hab-hit flex min-w-0 flex-1 items-center gap-3 p-3 text-left"
        >
          <span className={clsx("hab-check", checked && "is-on")} aria-hidden>
            <svg viewBox="0 0 24 24" className="h-6 w-6">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" className="hab-tick" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className={clsx("block text-base font-bold leading-snug", checked && "text-ink/55 line-through decoration-2")}>{habit.title}</span>
            <span className="mt-1.5 flex items-center gap-2">
              <span className="flex gap-1" aria-hidden>
                {history.map((h) => (
                  <span key={h.date} className={clsx("hab-dot", h.done && "is-done", h.date === selected && "is-selected")} />
                ))}
              </span>
              {streak > 0 ? <span className="text-xs font-bold text-orange">🔥 {streak}</span> : null}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMenu((open) => !open);
            setConfirmDelete(false);
          }}
          aria-expanded={menu}
          aria-label={`More options for ${habit.title}`}
          className="flex w-12 shrink-0 items-center justify-center text-xl font-bold text-muted"
        >
          ⋯
        </button>
      </div>

      {menu ? (
        <div className="hab-menu border-t-2 border-ink/10 p-3">
          {editing ? (
            <form
              className="space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  await updateHabit(habit.id, { title, roadmapId: roadmapId ? Number(roadmapId) : null, endDate: endDate || null });
                  setEditing(false);
                  setMenu(false);
                });
              }}
            >
              <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Habit name" required className="hab-input" />
              <select value={roadmapId} onChange={(e) => setRoadmapId(e.target.value)} aria-label="Roadmap" className="hab-input">
                <option value="">No roadmap</option>
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-muted">
                Ends (optional)
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="hab-input mt-1 normal-case" />
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={isPending} className="hab-btn bg-green text-white">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className="hab-btn bg-surface">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setEditing(true)} className="hab-btn bg-surface">
                ✎ Edit
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => toggleHabitActive(habit.id, false))}
                className="hab-btn bg-surface"
              >
                ⏸ Pause
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true);
                  startTransition(() => deleteHabit(habit.id));
                }}
                className={clsx("hab-btn", confirmDelete ? "bg-pink text-white" : "bg-surface text-pink")}
              >
                {confirmDelete ? "Sure?" : "✕ Delete"}
              </button>
            </div>
          )}
          {habit.endDate ? <p className="mt-2 text-[11px] font-semibold text-muted">Ends {habit.endDate}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

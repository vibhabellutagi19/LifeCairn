"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Input, Select } from "@/components/ui";
import { goalProgress } from "@/lib/habitGoals";
import { habitAccent, habitIcon } from "@/lib/habitLook";
import type { HabitRewardData } from "@/lib/habitRewards";
import {
  deleteHabit,
  toggleHabitActive,
  toggleHabitLog,
  updateHabit,
} from "@/lib/actions/habits";

export type GridHabit = {
  id: number;
  title: string;
  roadmapId: number | null;
  endDate: string | null;
  active: boolean;
  currentStreak: number;
  longestStreak: number;
  score: number;
  checkedDates: string[];
  targetDays: number | null;
  rewards: HabitRewardData[];
};

function isWeekend(dateISO: string) {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function dayNumber(dateISO: string) {
  return Number(dateISO.slice(8, 10));
}

function weekdayLetter(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" });
}

export function HabitCalendarGrid({
  habits,
  monthDays,
  today,
  elapsedDaysInMonth,
  roadmaps,
}: {
  habits: GridHabit[];
  monthDays: string[];
  today: string;
  elapsedDaysInMonth: number;
  roadmaps: { id: number; title: string }[];
}) {
  if (habits.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-muted sm:hidden">Swipe sideways to see the full month.</p>
      <div className="hm-grid overflow-x-auto" role="region" aria-label="Habit calendar" tabIndex={0}>
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th className="hm-sticky min-w-[160px] p-2 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-muted sm:min-w-[230px]">
                Habit
              </th>
              {monthDays.map((d) => (
                <th
                  key={d}
                  className={clsx("hm-head", d === today && "is-today", isWeekend(d) && "is-weekend")}
                >
                  <span className="block text-[9px] font-bold uppercase opacity-60">{weekdayLetter(d)}</span>
                  {dayNumber(d)}
                </th>
              ))}
              <th className="p-2 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-muted">Goal</th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => (
              <HabitGridRow
                key={h.id}
                habit={h}
                monthDays={monthDays}
                today={today}
                elapsedDaysInMonth={elapsedDaysInMonth}
                roadmaps={roadmaps}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HabitGridRow({
  habit,
  monthDays,
  today,
  elapsedDaysInMonth,
  roadmaps,
}: {
  habit: GridHabit;
  monthDays: string[];
  today: string;
  elapsedDaysInMonth: number;
  roadmaps: { id: number; title: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(habit.title);
  const [roadmapId, setRoadmapId] = useState(habit.roadmapId ? String(habit.roadmapId) : "");
  const [endDate, setEndDate] = useState(habit.endDate ?? "");
  const [targetDays, setTargetDays] = useState(habit.targetDays ? String(habit.targetDays) : "");

  const checked = new Set(habit.checkedDates);
  const monthCount = habit.checkedDates.filter((d) => monthDays.includes(d)).length;
  const goal = goalProgress(habit.checkedDates, monthDays[0]?.slice(0, 7) ?? "", habit.targetDays);
  const accent = habitAccent(habit.id);
  const meter = goal.target ? Math.min(100, goal.percent) : elapsedDaysInMonth ? Math.round((monthCount / elapsedDaysInMonth) * 100) : 0;

  if (editing) {
    return (
      <tr className={clsx(!habit.active && "opacity-50")}>
        <td className="hm-sticky hm-row-cell min-w-[160px] p-2 sm:min-w-[230px]" colSpan={1}>
          <div className="space-y-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-base sm:text-xs" />
            <Select value={roadmapId} onChange={(e) => setRoadmapId(e.target.value)} className="text-base sm:text-xs">
              <option value="">No roadmap</option>
              {roadmaps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
            <Input
              type="number"
              min={1}
              max={31}
              value={targetDays}
              onChange={(e) => setTargetDays(e.target.value)}
              placeholder="Goal: days / month"
              aria-label="Monthly goal in days"
              className="text-base sm:text-xs"
            />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="text-base sm:text-xs" />
            <div className="flex gap-1">
              <Button
                type="button"
                size="sm"
                variant="green"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await updateHabit(habit.id, {
                      title,
                      roadmapId: roadmapId ? Number(roadmapId) : null,
                      endDate: endDate || null,
                      targetDays: targetDays ? Number(targetDays) : null,
                    });
                    setEditing(false);
                  })
                }
              >
                Save
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </td>
        <td colSpan={monthDays.length + 1} className="hm-row-cell" />
      </tr>
    );
  }

  return (
    <tr className={clsx("hm-row", !habit.active && "opacity-50")} style={{ "--accent": accent } as React.CSSProperties}>
      <td className="hm-sticky hm-row-cell min-w-[160px] p-2 sm:min-w-[230px]">
        <div className="flex items-center gap-2">
          <span aria-hidden className="hm-icon">
            {habitIcon(habit.title)}
          </span>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="line-clamp-2 max-w-[104px] text-left text-sm font-bold leading-tight hover:underline sm:max-w-none"
              title="Click to edit"
            >
              {habit.title}
            </button>
            <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] font-bold text-ink/60">
              <span className={habit.currentStreak > 0 ? "text-orange" : ""}>🔥 {habit.currentStreak}</span>
              <span title="Best streak">🏅 {habit.longestStreak}</span>
              {habit.endDate ? <span>ends {habit.endDate.slice(5)}</span> : null}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={habit.active ? "Pause habit" : "Resume habit"}
              disabled={isPending}
              className="flex h-11 w-9 items-center justify-center text-muted hover:text-orange sm:h-8 sm:w-7"
              onClick={() =>
                startTransition(() => {
                  toggleHabitActive(habit.id, !habit.active);
                })
              }
            >
              {habit.active ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              aria-label="Delete habit"
              disabled={isPending}
              className="flex h-11 w-9 items-center justify-center text-muted hover:text-pink sm:h-8 sm:w-7"
              onClick={() =>
                startTransition(() => {
                  if (confirm(`Delete "${habit.title}" and all its history?`)) {
                    deleteHabit(habit.id);
                  }
                })
              }
            >
              ✕
            </button>
          </div>
        </div>
      </td>
      {monthDays.map((d) => {
        const isChecked = checked.has(d);
        const future = d > today;
        // Join consecutive days into one pill so streaks read at a glance.
        const prev = isChecked && checked.has(monthDays[monthDays.indexOf(d) - 1] ?? "");
        const next = isChecked && checked.has(monthDays[monthDays.indexOf(d) + 1] ?? "");
        return (
          <td key={d} className={clsx("hm-row-cell hm-cell", d === today && "is-today")}>
            <button
              type="button"
              disabled={isPending || future}
              aria-label={`${habit.title} on ${d}${isChecked ? ", done" : ""}`}
              aria-pressed={isChecked}
              onClick={() =>
                startTransition(() => {
                  toggleHabitLog(habit.id, d, !isChecked);
                })
              }
              className={clsx("hm-dot", isChecked && "is-on", prev && "join-prev", next && "join-next", future && "is-future")}
            >
              {isChecked ? "✓" : ""}
            </button>
          </td>
        );
      })}
      <td className="hm-row-cell min-w-[88px] px-2 text-center text-xs font-bold">
        <span className={clsx("block whitespace-nowrap", goal.reached && "text-green")} title={goal.target ? `Goal: ${goal.target} days this month` : "No monthly goal"}>
          {goal.reached ? "🏆 " : ""}
          {monthCount}/{goal.target ?? elapsedDaysInMonth}
        </span>
        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-ink/10">
          <span className={clsx("hab-goal-bar block h-full", goal.reached && "is-reached")} style={{ width: `${meter}%`, background: goal.reached ? undefined : accent }} />
        </span>
        <span className="mt-0.5 block text-[10px] text-muted">{goal.target ? `${goal.percent}%` : "no goal"}</span>
      </td>
    </tr>
  );
}

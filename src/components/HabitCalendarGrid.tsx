"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Badge, Button, Input, Select } from "@/components/ui";
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
  score: number;
  checkedDates: string[];
};

function isWeekend(dateISO: string) {
  const day = new Date(`${dateISO}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function dayNumber(dateISO: string) {
  return Number(dateISO.slice(8, 10));
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
    <div className="brut-border overflow-x-auto rounded-lg bg-surface" role="region" aria-label="Habit calendar" tabIndex={0}>
      <table className="border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[150px] border-b-2 border-ink bg-surface p-2 text-left text-xs font-bold uppercase tracking-wide text-muted sm:min-w-[220px]">
              Habit
            </th>
            {monthDays.map((d) => (
              <th
                key={d}
                className={clsx(
                  "w-8 border-b-2 border-l border-ink/20 p-1 text-center text-[11px] font-bold",
                  d === today && "bg-yellow",
                  isWeekend(d) && d !== today && "bg-background"
                )}
              >
                {dayNumber(d)}
              </th>
            ))}
            <th className="border-b-2 border-l-2 border-ink p-2 text-center text-xs font-bold uppercase tracking-wide text-muted">
              Month
            </th>
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

  const checked = new Set(habit.checkedDates);
  const monthCount = habit.checkedDates.filter((d) => monthDays.includes(d)).length;

  if (editing) {
    return (
      <tr className={clsx(!habit.active && "opacity-50")}>
        <td className="sticky left-0 z-10 min-w-[150px] border-b border-ink/20 bg-surface p-2 sm:min-w-[220px]" colSpan={1}>
          <div className="space-y-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-xs" />
            <div className="flex gap-1">
              <Select
                value={roadmapId}
                onChange={(e) => setRoadmapId(e.target.value)}
                className="text-xs"
              >
                <option value="">No roadmap</option>
                {roadmaps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            </div>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs"
            />
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
        <td colSpan={monthDays.length + 1} className="border-b border-ink/20 bg-surface" />
      </tr>
    );
  }

  return (
    <tr className={clsx(!habit.active && "opacity-50")}>
      <td className="sticky left-0 z-10 min-w-[150px] border-b border-ink/20 bg-surface p-2 sm:min-w-[220px]">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
              className="min-h-11 max-w-[92px] truncate text-left text-sm font-bold hover:underline sm:min-h-0 sm:max-w-none"
            title="Click to edit"
          >
            {habit.title}
          </button>
            <div className="flex shrink-0 items-center">
            <button
              type="button"
              aria-label={habit.active ? "Pause habit" : "Resume habit"}
              disabled={isPending}
              className="flex h-10 w-8 items-center justify-center text-muted hover:text-orange sm:h-8"
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
              className="flex h-10 w-8 items-center justify-center text-muted hover:text-pink sm:h-8"
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
        <div className="mt-1 flex items-center gap-1.5">
          <Badge color="orange">🔥 {habit.currentStreak}</Badge>
          <Badge color="green">⭐ {habit.score}</Badge>
          {habit.endDate ? <Badge color="muted">ends {habit.endDate.slice(5)}</Badge> : null}
        </div>
      </td>
      {monthDays.map((d) => {
        const isChecked = checked.has(d);
        const future = d > today;
        return (
          <td
            key={d}
            className={clsx(
              "border-b border-l border-ink/20 p-0.5 text-center",
              d === today && "bg-yellow/30",
              isWeekend(d) && d !== today && "bg-background"
            )}
          >
            <button
              type="button"
              disabled={isPending || future}
              aria-label={`${habit.title} on ${d}`}
              onClick={() =>
                startTransition(() => {
                  toggleHabitLog(habit.id, d, !isChecked);
                })
              }
              className={clsx(
                "brut-border mx-auto flex h-6 w-6 items-center justify-center rounded text-[11px]",
                isChecked ? "bg-green text-white" : future ? "cursor-not-allowed bg-background/50" : "bg-surface"
              )}
            >
              {isChecked ? "✓" : ""}
            </button>
          </td>
        );
      })}
      <td className="border-b border-l-2 border-ink p-2 text-center text-xs font-bold">
        {monthCount}/{elapsedDaysInMonth}
      </td>
    </tr>
  );
}

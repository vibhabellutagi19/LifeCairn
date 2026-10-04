"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { deleteHabit, toggleHabitActive, toggleHabitLog } from "@/lib/actions/habits";
import { Badge } from "@/components/ui";
import type { HabitStats } from "@/lib/habitStats";

export function HabitRow({
  id,
  title,
  active,
  roadmapTitle,
  today,
  doneToday,
  stats,
}: {
  id: number;
  title: string;
  active: boolean;
  roadmapTitle?: string | null;
  today: string;
  doneToday: boolean;
  stats: HabitStats;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={clsx("brut-border rounded-md bg-surface p-3", !active && "opacity-50")}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label={doneToday ? "Mark not done today" : "Mark done today"}
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              toggleHabitLog(id, today, !doneToday);
            })
          }
          className={clsx(
            "brut-border flex h-11 w-11 shrink-0 items-center justify-center rounded sm:h-7 sm:w-7",
            doneToday ? "bg-green text-white" : "bg-surface"
          )}
        >
          {doneToday ? "✓" : ""}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold">{title}</p>
            {roadmapTitle ? <Badge color="yellow">{roadmapTitle}</Badge> : null}
          </div>
          <div className="mt-1 flex items-center gap-1">
            {stats.last7.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={clsx(
                  "h-2.5 w-2.5 rounded-full border border-ink/40",
                  d.done ? "bg-orange" : "bg-transparent"
                )}
              />
            ))}
          </div>
        </div>

        <div className="ml-14 flex w-[calc(100%-3.5rem)] shrink-0 items-center justify-end gap-2 sm:ml-0 sm:w-auto">
          <Badge color="orange">🔥 {stats.currentStreak}</Badge>
          <Badge color="green">⭐ {stats.score}</Badge>
          <button
            type="button"
            aria-label={active ? "Pause habit" : "Resume habit"}
            disabled={isPending}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-orange sm:h-9 sm:w-9"
            onClick={() =>
              startTransition(() => {
                toggleHabitActive(id, !active);
              })
            }
          >
            {active ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            aria-label="Delete habit"
            disabled={isPending}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-pink sm:h-9 sm:w-9"
            onClick={() =>
              startTransition(() => {
                deleteHabit(id);
              })
            }
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

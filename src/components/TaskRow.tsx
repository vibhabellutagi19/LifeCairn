"use client";

import { useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { deleteTask, moveTaskToDate, toggleTask } from "@/lib/actions/tasks";
import { burstConfetti } from "@/lib/confetti";

export function TaskRow({
  id,
  title,
  completed,
  tag,
  focusHref,
  overdue = false,
  moveToDate,
}: {
  id: number;
  title: string;
  completed: boolean;
  tag?: string;
  /** When set, shows a 🍅 button that opens the Pomodoro focused on this task. */
  focusHref?: string;
  /** Styles the tag as an overdue warning. */
  overdue?: boolean;
  /** When set, shows a "→ Today" button that moves the task to this date. */
  moveToDate?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="brut-border flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface px-3 py-2.5">
      <button
        type="button"
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
        onClick={(event) => {
          if (!completed) burstConfetti(event.currentTarget);
          startTransition(() => {
            toggleTask(id, !completed);
          });
        }}
        className={clsx(
          "check-pop brut-border flex h-11 w-11 shrink-0 items-center justify-center rounded sm:h-7 sm:w-7",
          completed ? "bg-green text-white" : "bg-surface"
        )}
      >
        {completed ? "✓" : ""}
      </button>
      <div className="min-w-[8rem] flex-1">
        <p
          className={clsx(
            "truncate text-sm font-semibold",
            completed && "text-muted line-through"
          )}
        >
          {title}
        </p>
        {tag ? (
          <span className={clsx("block text-[11px] font-bold uppercase tracking-wide", overdue ? "text-pink" : "text-muted")}>
            {overdue ? "⚠ " : ""}
            {tag}
          </span>
        ) : null}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
      {moveToDate && !completed ? (
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            startTransition(() => {
              moveTaskToDate(id, moveToDate);
            })
          }
          title="Move to today"
          className="move-today"
        >
          → Today
        </button>
      ) : null}
      {focusHref && !completed ? (
        <Link href={focusHref} aria-label={`Focus on "${title}" with a pomodoro`} title="Start a pomodoro on this" className="focus-tomato">
          🍅
        </Link>
      ) : null}
      <button
        type="button"
        aria-label="Delete task"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            deleteTask(id);
          })
        }
        className="flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-pink sm:h-auto sm:w-auto"
      >
        ✕
      </button>
      </div>
    </div>
  );
}

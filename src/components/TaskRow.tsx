"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { deleteTask, toggleTask } from "@/lib/actions/tasks";

export function TaskRow({
  id,
  title,
  completed,
  tag,
}: {
  id: number;
  title: string;
  completed: boolean;
  tag?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="brut-border flex items-center gap-3 rounded-md bg-surface px-3 py-2.5">
      <button
        type="button"
        aria-label={completed ? "Mark incomplete" : "Mark complete"}
        onClick={() =>
          startTransition(() => {
            toggleTask(id, !completed);
          })
        }
        className={clsx(
          "brut-border flex h-10 w-10 shrink-0 items-center justify-center rounded sm:h-7 sm:w-7",
          completed ? "bg-green text-white" : "bg-surface"
        )}
      >
        {completed ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            "truncate text-sm font-semibold",
            completed && "text-muted line-through"
          )}
        >
          {title}
        </p>
        {tag ? (
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
            {tag}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Delete task"
        disabled={isPending}
        onClick={() =>
          startTransition(() => {
            deleteTask(id);
          })
        }
        className="flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-pink sm:h-auto sm:w-auto"
      >
        ✕
      </button>
    </div>
  );
}

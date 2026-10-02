"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { toggleHabitLog } from "@/lib/actions/habits";
import { Badge } from "@/components/ui";

export function HabitQuickRow({
  id,
  title,
  today,
  doneToday,
  currentStreak,
}: {
  id: number;
  title: string;
  today: string;
  doneToday: boolean;
  currentStreak: number;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="brut-border flex items-center gap-3 rounded-md bg-surface px-3 py-2">
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
          "brut-border flex h-6 w-6 shrink-0 items-center justify-center rounded",
          doneToday ? "bg-green text-white" : "bg-surface"
        )}
      >
        {doneToday ? "✓" : ""}
      </button>
      <p className={clsx("flex-1 truncate text-sm font-semibold", doneToday && "text-muted")}>
        {title}
      </p>
      <Badge color="orange">🔥 {currentStreak}</Badge>
    </div>
  );
}

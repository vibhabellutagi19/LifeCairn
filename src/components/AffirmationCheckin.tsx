"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { setAffirmationCheckin, type AffirmationSlot } from "@/lib/actions/affirmations";

const SLOTS: { key: AffirmationSlot; label: string; short: string }[] = [
  { key: "morning", label: "Morning", short: "AM" },
  { key: "afternoon", label: "Afternoon", short: "Noon" },
  { key: "evening", label: "Evening", short: "PM" },
];

export function AffirmationCheckin({
  date,
  checked,
  compact = false,
}: {
  date: string;
  checked: Record<AffirmationSlot, boolean>;
  compact?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={clsx("flex gap-2", compact ? "flex-nowrap" : "flex-wrap")}>
      {SLOTS.map((s) => {
        const done = checked[s.key];
        return (
          <button
            key={s.key}
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                setAffirmationCheckin(date, s.key, !done);
              })
            }
            className={clsx(
              "brut-border brut-shadow-sm brut-press min-h-11 flex-1 rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wide",
              done ? "bg-green text-white" : "bg-surface hover:bg-yellow"
            )}
          >
            {done ? "✓ " : ""}
            {compact ? s.short : s.label}
          </button>
        );
      })}
    </div>
  );
}

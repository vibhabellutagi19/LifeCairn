"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { setAffirmationCheckin, type AffirmationSlot } from "@/lib/actions/affirmations";
import { burstConfetti } from "@/lib/confetti";

const SLOTS: { key: AffirmationSlot; label: string; short: string; icon: string }[] = [
  { key: "morning", label: "Morning", short: "AM", icon: "🌅" },
  { key: "afternoon", label: "Afternoon", short: "Noon", icon: "☀️" },
  { key: "evening", label: "Evening", short: "PM", icon: "🌙" },
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
            onClick={(event) => {
              if (!done) burstConfetti(event.currentTarget, 12, [s.icon, "✨", "✦"]);
              startTransition(() => {
                setAffirmationCheckin(date, s.key, !done);
              });
            }}
            className={clsx(
              "brut-border brut-shadow-sm brut-press inline-flex min-h-11 flex-1 items-center justify-center whitespace-nowrap rounded-md px-2 py-2 text-xs font-bold uppercase tracking-wide",
              done ? "bg-green text-white" : "bg-surface hover:bg-yellow"
            )}
          >
            <span aria-hidden className="mr-1">{done ? "✓" : s.icon}</span>
            {compact ? s.short : s.label}
          </button>
        );
      })}
    </div>
  );
}

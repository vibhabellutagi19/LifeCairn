"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { Select } from "@/components/ui";
import { setFinanceShare } from "@/lib/actions/circleFinance";
import { setHabitShare, toggleHabitReaction } from "@/lib/actions/circleHabits";

export function ReactionBar({
  circleId,
  habitId,
  reactions,
  canReact,
}: {
  circleId: number;
  habitId: number;
  reactions: { emoji: string; count: number; mine: boolean }[];
  canReact: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  // On your own habit you only see the cheers you've received.
  const visible = canReact ? reactions : reactions.filter((r) => r.count > 0);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((r) => (
        <button
          key={r.emoji}
          type="button"
          disabled={!canReact || isPending}
          aria-pressed={r.mine}
          aria-label={`Cheer ${r.emoji}`}
          onClick={() => startTransition(() => toggleHabitReaction(circleId, habitId, r.emoji))}
          className={clsx(
            "brut-border inline-flex min-h-11 items-center gap-1 rounded-full px-3 py-0.5 text-sm font-bold sm:min-h-0",
            r.mine ? "bg-yellow" : "bg-surface",
            canReact && "brut-press hover:bg-yellow/60"
          )}
        >
          <span aria-hidden>{r.emoji}</span>
          {r.count > 0 ? <span className="text-xs">{r.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ShareSelect({
  circleId,
  habitId,
  title,
  visibility,
}: {
  circleId: number;
  habitId: number;
  title: string;
  visibility: "progress" | "full" | null;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="min-w-0 truncate font-bold">{title}</span>
      <Select
        aria-label={`Sharing for ${title}`}
        value={visibility ?? ""}
        disabled={isPending}
        className="w-44"
        onChange={(e) =>
          startTransition(() => setHabitShare(circleId, habitId, e.target.value || null))
        }
      >
        <option value="">Not shared</option>
        <option value="progress">Progress only</option>
        <option value="full">Full detail</option>
      </Select>
    </div>
  );
}

export function FinanceShareSelect({
  circleId,
  level,
}: {
  circleId: number;
  level: "summary" | "accounts" | null;
}) {
  const [isPending, startTransition] = useTransition();
  return (
    <Select
      aria-label="How much of your finance this circle sees"
      value={level ?? ""}
      disabled={isPending}
      onChange={(e) => startTransition(() => setFinanceShare(circleId, e.target.value || null))}
    >
      <option value="">Not shared</option>
      <option value="summary">Totals only</option>
      <option value="accounts">Totals + account balances</option>
    </Select>
  );
}

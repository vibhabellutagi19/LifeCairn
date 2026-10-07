"use client";

import { useOptimistic, useState, useTransition } from "react";
import { clsx } from "clsx";
import type { GridHabit } from "@/components/HabitCalendarGrid";
import { addHabitReward, deleteHabitReward, setHabitRewardClaimed } from "@/lib/actions/habits";
import { burstConfetti } from "@/lib/confetti";
import { goalProgress } from "@/lib/habitGoals";

type Status = "unlocked" | "claimed" | "locked" | "no-goal";

/**
 * Every reward across habits for one month: unlocked ones can be claimed, locked ones show
 * how far their habit is from its monthly goal. Rewards are added and removed here too.
 */
export function RewardShelf({ habits, monthKey }: { habits: GridHabit[]; monthKey: string }) {
  const [claimed, setClaimed] = useOptimistic(
    new Set(habits.flatMap((h) => h.rewards.filter((r) => r.claimedMonths.includes(monthKey)).map((r) => r.id))),
    (state, change: { id: number; claimed: boolean }) => {
      const next = new Set(state);
      if (change.claimed) next.add(change.id);
      else next.delete(change.id);
      return next;
    }
  );
  const [habitId, setHabitId] = useState(String(habits.find((h) => h.targetDays)?.id ?? habits[0]?.id ?? ""));
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [isPending, startTransition] = useTransition();

  const monthName = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
  const rows = habits.flatMap((habit) => {
    const goal = goalProgress(habit.checkedDates, monthKey, habit.targetDays);
    return habit.rewards.map((reward) => {
      const status: Status = !goal.target ? "no-goal" : claimed.has(reward.id) ? "claimed" : goal.reached ? "unlocked" : "locked";
      return { reward, habit, goal, status };
    });
  });
  const order: Record<Status, number> = { unlocked: 0, locked: 1, claimed: 2, "no-goal": 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || b.goal.percent - a.goal.percent);
  const unlockedCount = rows.filter((row) => row.status === "unlocked").length;

  function claim(id: number, value: boolean, source?: Element) {
    if (value && source) burstConfetti(source, 40, ["🎁", "🎉", "✨", "💛", "🏆"]);
    startTransition(async () => {
      setClaimed({ id, claimed: value });
      await setHabitRewardClaimed(id, monthKey, value);
    });
  }

  return (
    <section aria-labelledby="rewards-heading" className="mt-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Earn it, then enjoy it</p>
          <h2 id="rewards-heading" className="font-display text-2xl font-bold sm:text-3xl">
            <span className="home-marker is-always">Rewards · {monthName}</span>
          </h2>
        </div>
        {unlockedCount > 0 ? (
          <span className="rw-ready rounded-full border-2 border-ink bg-yellow px-3 py-1 text-xs font-bold">
            🎁 {unlockedCount} ready to claim
          </span>
        ) : null}
      </div>

      <div className="brut-border brut-shadow rounded-2xl bg-surface p-4 sm:p-5">
        {rows.length === 0 ? (
          <p className="mb-4 text-sm font-semibold text-muted">
            Give a habit a monthly goal, then add something you&rsquo;d love as its reward. Hit the goal and it unlocks.
          </p>
        ) : (
          <ul className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map(({ reward, habit, goal, status }, i) => (
              <li key={reward.id} className={clsx("rw-card", `is-${status}`)} style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="rw-icon">
                    {status === "claimed" ? "✅" : status === "unlocked" ? "🎁" : status === "locked" ? "🔒" : "🎀"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-bold leading-snug">{reward.title}</p>
                    <p className="truncate text-xs font-semibold text-ink/60">for {habit.title}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startTransition(() => deleteHabitReward(reward.id))}
                    disabled={isPending}
                    aria-label={`Remove reward "${reward.title}"`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center text-muted hover:text-pink"
                  >
                    ✕
                  </button>
                </div>

                {goal.target ? (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[11px] font-bold">
                      <span>
                        {goal.done}/{goal.target} days
                      </span>
                      <span>{Math.min(goal.percent, 999)}%</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full border-2 border-ink bg-surface">
                      <div className="rw-bar h-full" style={{ width: `${Math.min(100, goal.percent)}%` }} />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3">
                  {status === "unlocked" ? (
                    <button type="button" onClick={(e) => claim(reward.id, true, e.currentTarget)} className="rw-claim">
                      Claim it 🎉
                    </button>
                  ) : status === "claimed" ? (
                    <p className="flex items-center justify-between text-sm font-bold text-green">
                      Enjoyed this month
                      <button type="button" onClick={() => claim(reward.id, false)} className="text-xs font-bold text-muted underline decoration-2 underline-offset-4">
                        undo
                      </button>
                    </p>
                  ) : status === "locked" ? (
                    <p className="text-sm font-bold text-ink/65">
                      {goal.left} more {goal.left === 1 ? "day" : "days"} to unlock
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-muted">Set a monthly goal for this habit to unlock it.</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {habits.length === 0 ? null : adding ? (
          <form
            className="rw-add grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              const value = title.trim();
              if (!value || !habitId) return;
              setTitle("");
              startTransition(async () => {
                await addHabitReward(Number(habitId), value);
                setAdding(false);
              });
            }}
          >
            <select value={habitId} onChange={(e) => setHabitId(e.target.value)} aria-label="Habit" className="hab-input">
              {habits.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.title}
                  {h.targetDays ? ` · ${h.targetDays} days` : " · no goal yet"}
                </option>
              ))}
            </select>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. New running shoes, a spa day…"
              aria-label="Reward"
              className="hab-input"
            />
            <div className="flex gap-2">
              <button type="submit" disabled={isPending || !title.trim()} className="hab-btn bg-orange text-white">
                Add
              </button>
              <button type="button" onClick={() => setAdding(false)} className="hab-btn bg-surface">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="rw-new">
            + Add a reward
          </button>
        )}
      </div>
    </section>
  );
}

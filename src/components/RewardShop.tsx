"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import type { GridHabit } from "@/components/HabitCalendarGrid";
import { addHabitReward, deleteHabitReward, setHabitRewardClaimed, setHabitTarget } from "@/lib/actions/habits";
import { burstConfetti } from "@/lib/confetti";
import { habitAccent, habitIcon } from "@/lib/habitLook";
import {
  REWARD_EMOJIS,
  REWARD_STATUS_ORDER,
  rewardRule,
  rewardState,
  type HabitRewardData,
  type RewardKind,
  type RewardState,
} from "@/lib/habitRewards";

export type TrophyEntry = {
  id: number;
  rewardId: number;
  period: string;
  title: string;
  emoji: string | null;
  habitTitle: string;
  label: string;
  claimedOn: string;
};

type Row = { reward: HabitRewardData; habit: GridHabit; state: RewardState };
type ClaimChange = { rewardId: number; period: string; claimed: boolean };

const STREAK_PRESETS = [3, 7, 14, 21, 30];

/** The Reward Shop: design rewards, open the ones you've earned, and look back at what you've enjoyed. */
export function RewardShop({
  habits,
  monthKey,
  today,
  trophies,
}: {
  habits: GridHabit[];
  monthKey: string;
  today: string;
  trophies: TrophyEntry[];
}) {
  // Claims are applied optimistically so a gift opens instantly.
  const [claimed, applyClaim] = useOptimistic(
    new Set(habits.flatMap((h) => h.rewards.flatMap((r) => r.claimedPeriods.map((p) => `${r.id}|${p}`)))),
    (state, change: ClaimChange) => {
      const next = new Set(state);
      const key = `${change.rewardId}|${change.period}`;
      if (change.claimed) next.add(key);
      else next.delete(key);
      return next;
    }
  );
  const [opening, setOpening] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const rows: Row[] = habits.flatMap((habit) =>
    habit.rewards.map((reward) => {
      const withClaims = {
        ...reward,
        claimedPeriods: [...claimed].filter((key) => key.startsWith(`${reward.id}|`)).map((key) => key.split("|")[1]),
      };
      return { reward: withClaims, habit, state: rewardState(withClaims, habit, monthKey, today) };
    })
  );
  rows.sort(
    (a, b) => REWARD_STATUS_ORDER[a.state.status] - REWARD_STATUS_ORDER[b.state.status] || b.state.percent - a.state.percent
  );
  const ready = rows.filter((row) => row.state.status === "unlocked");
  const others = rows.filter((row) => row.state.status !== "unlocked");
  const inProgress = rows.filter((row) => row.state.status === "locked").length;

  function setClaim(change: ClaimChange) {
    startTransition(async () => {
      applyClaim(change);
      await setHabitRewardClaimed(change.rewardId, change.period, change.claimed);
    });
  }

  function open(row: Row, source: Element) {
    if (!row.state.period || opening) return;
    const period = row.state.period;
    setOpening(row.reward.id);
    burstConfetti(source, 56, [row.reward.emoji || "🎁", "🎉", "✨", "💛", "🏆"]);
    // Let the lid fly off before the gift moves to "enjoyed".
    window.setTimeout(() => {
      setOpening(null);
      setClaim({ rewardId: row.reward.id, period, claimed: true });
    }, 900);
  }

  return (
    <div className="pb-16">
      <section className="rs-hero relative mb-6 overflow-hidden rounded-3xl p-5 text-white sm:p-7">
        <span aria-hidden className="rs-hero-gift">🎁</span>
        <span aria-hidden className="rs-spark rs-spark-1">✦</span>
        <span aria-hidden className="rs-spark rs-spark-2">✧</span>
        <span aria-hidden className="rs-spark rs-spark-3">✦</span>
        <div className="relative z-10">
          <Link href="/habits" className="text-xs font-bold uppercase tracking-[0.18em] text-white/60 hover:text-white">
            ← Habit tracker
          </Link>
          <h1 className="mt-2 font-display text-4xl font-bold leading-none sm:text-5xl">
            Reward <span className="text-yellow">Shop</span>
          </h1>
          <p className="mt-2 max-w-md text-sm font-semibold text-white/75">
            You set the price, in days of showing up. Hit the target or keep the streak, then come back and open your gift.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className={clsx("rs-chip", ready.length > 0 && "is-hot")}>🎁 {ready.length} ready</span>
            <span className="rs-chip">⏳ {inProgress} in progress</span>
            <span className="rs-chip">🏆 {trophies.length} enjoyed</span>
          </div>
        </div>
      </section>

      {ready.length > 0 ? (
        <section aria-labelledby="ready-heading" className="mb-8">
          <h2 id="ready-heading" className="mb-3 font-display text-2xl font-bold">
            <span className="home-marker is-always">Ready to open</span>
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ready.map((row, i) => (
              <li
                key={row.reward.id}
                className={clsx("rs-ready-card", opening === row.reward.id && "is-opening")}
                style={{ "--accent": habitAccent(row.habit.id), animationDelay: `${i * 70}ms` } as React.CSSProperties}
              >
                <button
                  type="button"
                  onClick={(e) => open(row, e.currentTarget)}
                  className="flex w-full flex-col items-center gap-3 p-5 text-center"
                  aria-label={`Open your reward: ${row.reward.title}`}
                >
                  <span className="rs-gift" aria-hidden>
                    <span className="rs-gift-treat">{row.reward.emoji || "🎁"}</span>
                    <span className="rs-gift-lid" />
                    <span className="rs-gift-box" />
                  </span>
                  <span>
                    <span className="block font-display text-xl font-bold leading-snug">{row.reward.title}</span>
                    <span className="mt-1 block text-xs font-bold text-ink/60">
                      {habitIcon(row.habit.title)} {row.habit.title} · {rewardRule(row.reward, row.habit.targetDays, monthKey)} ✓
                    </span>
                  </span>
                  <span className="rw-claim pointer-events-none">{opening === row.reward.id ? "Enjoy! 🎉" : "Tap to open 🎁"}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <RewardBuilder habits={habits} monthKey={monthKey} />

      <section aria-labelledby="rewards-heading" className="mt-8">
        <h2 id="rewards-heading" className="mb-3 font-display text-2xl font-bold">
          <span className="home-marker is-always">Working towards</span>
        </h2>
        {others.length === 0 ? (
          <p className="rs-empty">
            {rows.length === 0 ? "No rewards yet. Design your first one above ✨" : "Everything is unlocked. Go open your gifts!"}
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((row, i) => (
              <RewardCard
                key={row.reward.id}
                row={row}
                index={i}
                monthKey={monthKey}
                onUndo={(period) => setClaim({ rewardId: row.reward.id, period, claimed: false })}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="trophy-heading" className="mt-10">
        <h2 id="trophy-heading" className="mb-3 font-display text-2xl font-bold">
          <span className="home-marker is-always">🏆 Trophy cabinet</span>
        </h2>
        {trophies.length === 0 ? (
          <p className="rs-empty">Rewards you open land here, so you can see how far you&rsquo;ve come.</p>
        ) : (
          <ol className="rs-cabinet">
            {trophies.map((trophy) => (
              <li key={trophy.id} className="rs-trophy">
                <span aria-hidden className="rs-trophy-emoji">
                  {trophy.emoji || "🎁"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{trophy.title}</span>
                  <span className="block truncate text-xs font-semibold text-ink/60">
                    {trophy.habitTitle} · {trophy.label}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[11px] font-bold text-muted">
                  {trophy.claimedOn}
                  <button
                    type="button"
                    onClick={() => setClaim({ rewardId: trophy.rewardId, period: trophy.period, claimed: false })}
                    className="block w-full text-right underline decoration-2 underline-offset-2 hover:text-pink"
                  >
                    undo
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function RewardCard({
  row,
  index,
  monthKey,
  onUndo,
}: {
  row: Row;
  index: number;
  monthKey: string;
  onUndo: (period: string) => void;
}) {
  const { reward, habit, state } = row;
  const [confirm, setConfirm] = useState(false);
  const [target, setTarget] = useState("");
  const [isPending, startTransition] = useTransition();
  const isStreak = reward.kind === "streak";

  return (
    <li
      className={clsx("rw-card", `is-${state.status}`)}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms`, "--accent": habitAccent(habit.id) } as React.CSSProperties}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="rw-icon">
          {state.status === "claimed" ? "✅" : reward.emoji || "🎁"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-bold leading-snug">{reward.title}</p>
          <p className="truncate text-xs font-semibold text-ink/60">
            {habitIcon(habit.title)} {habit.title}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirm) return setConfirm(true);
            startTransition(() => deleteHabitReward(reward.id));
          }}
          onBlur={() => setConfirm(false)}
          disabled={isPending}
          aria-label={confirm ? `Confirm removing "${reward.title}"` : `Remove reward "${reward.title}"`}
          className={clsx("flex h-9 shrink-0 items-center justify-center rounded-full px-2 text-xs font-bold", confirm ? "bg-pink text-white" : "text-muted hover:text-pink")}
        >
          {confirm ? "Remove?" : "✕"}
        </button>
      </div>

      <p className="mt-3 inline-flex items-center gap-1 rounded-full border-2 border-ink/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">
        {isStreak ? "🔥" : "🎯"} {rewardRule(reward, habit.targetDays, monthKey)}
      </p>

      {state.status === "no-goal" ? (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!Number(target)) return;
            startTransition(() => setHabitTarget(habit.id, Number(target)));
          }}
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="days / month"
            aria-label={`Monthly goal for ${habit.title}`}
            className="hab-input min-h-10 flex-1 py-1 text-sm"
          />
          <button type="submit" disabled={isPending || !Number(target)} className="hab-btn flex-none bg-orange px-3 text-white">
            Set goal
          </button>
        </form>
      ) : (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] font-bold">
            <span>
              {isStreak ? `🔥 ${state.done}/${state.target} days in a row` : `${state.done}/${state.target} days this month`}
            </span>
            <span>{Math.min(state.percent, 100)}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-surface">
            <div className="rw-bar h-full" style={{ width: `${Math.min(100, state.percent)}%` }} />
          </div>
          <p className="mt-2 text-sm font-bold text-ink/70">
            {state.status === "claimed" ? (
              <span className="flex items-center justify-between gap-2 text-green">
                <span>{isStreak ? "Enjoyed! A fresh streak earns it again." : "Enjoyed! It comes back next month."}</span>
                {state.period ? (
                  <button type="button" onClick={() => onUndo(state.period!)} className="text-xs text-muted underline decoration-2 underline-offset-4">
                    undo
                  </button>
                ) : null}
              </span>
            ) : isStreak ? (
              state.done === 0 ? (
                "Check in today to start the streak."
              ) : (
                `${state.left} more ${state.left === 1 ? "day" : "days"} in a row to unlock`
              )
            ) : (
              `${state.left} more ${state.left === 1 ? "day" : "days"} to unlock`
            )}
          </p>
        </div>
      )}
    </li>
  );
}

function RewardBuilder({ habits, monthKey }: { habits: GridHabit[]; monthKey: string }) {
  const [habitId, setHabitId] = useState<number | null>(habits[0]?.id ?? null);
  const habit = habits.find((h) => h.id === habitId) ?? null;
  const [kind, setKind] = useState<RewardKind>("monthly_goal");
  const [streakDays, setStreakDays] = useState(7);
  const [targetDraft, setTargetDraft] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(REWARD_EMOJIS[0]);
  const [justAdded, setJustAdded] = useState(false);
  const [isPending, startTransition] = useTransition();

  // The habit's saved goal, unless the person has typed a different one.
  const target = targetDraft ?? (habit?.targetDays ? String(habit.targetDays) : "");
  const targetNumber = Math.min(31, Math.max(0, Math.round(Number(target) || 0)));
  const monthName = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
  const canSave = Boolean(habit && title.trim() && (kind === "streak" ? streakDays >= 2 : targetNumber >= 1));

  if (habits.length === 0) {
    return (
      <p className="rs-empty">
        Rewards hang off habits. <Link href="/habits" className="underline decoration-2">Add a habit first</Link>, then come back to set a prize.
      </p>
    );
  }

  return (
    <section aria-labelledby="builder-heading" className="rs-builder rounded-3xl p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Design a reward</p>
          <h2 id="builder-heading" className="font-display text-2xl font-bold sm:text-3xl">
            What will you treat yourself to?
          </h2>
        </div>
      </div>

      <form
        className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"
        onSubmit={(event) => {
          event.preventDefault();
          if (!canSave || !habit) return;
          const value = title.trim();
          startTransition(async () => {
            if (kind === "monthly_goal" && targetNumber !== habit.targetDays) await setHabitTarget(habit.id, targetNumber);
            await addHabitReward(habit.id, { title: value, emoji, kind, streakDays });
            setTitle("");
            setTargetDraft(null);
            setJustAdded(true);
            window.setTimeout(() => setJustAdded(false), 2200);
          });
        }}
      >
        <div className="space-y-5">
          <fieldset>
            <legend className="rs-step">
              <span>1</span> For which habit?
            </legend>
            <div className="flex flex-wrap gap-2">
              {habits.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => {
                    setHabitId(h.id);
                    setTargetDraft(null);
                  }}
                  aria-pressed={h.id === habitId}
                  className={clsx("rs-habit-chip", h.id === habitId && "is-on")}
                  style={{ "--accent": habitAccent(h.id) } as React.CSSProperties}
                >
                  <span aria-hidden>{habitIcon(h.title)}</span> {h.title}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="rs-step">
              <span>2</span> How do you earn it?
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setKind("monthly_goal")}
                aria-pressed={kind === "monthly_goal"}
                className={clsx("rs-kind", kind === "monthly_goal" && "is-on")}
              >
                <span className="text-2xl">🎯</span>
                <span className="block font-bold">Hit a monthly target</span>
                <span className="block text-xs font-semibold opacity-70">Do it on X days this month. Resets every month.</span>
              </button>
              <button
                type="button"
                onClick={() => setKind("streak")}
                aria-pressed={kind === "streak"}
                className={clsx("rs-kind", kind === "streak" && "is-on")}
              >
                <span className="text-2xl">🔥</span>
                <span className="block font-bold">Keep a streak</span>
                <span className="block text-xs font-semibold opacity-70">X days in a row, no breaks. Earn it again on every new streak.</span>
              </button>
            </div>

            <div className="rs-kind-detail mt-3" key={kind}>
              {kind === "monthly_goal" ? (
                <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
                  Do it on
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={31}
                    value={target}
                    onChange={(e) => setTargetDraft(e.target.value)}
                    placeholder="20"
                    className="hab-input min-h-10 py-1 text-center"
                    style={{ width: "5rem" }}
                  />
                  days of the month
                  {habit?.targetDays && targetNumber && targetNumber !== habit.targetDays ? (
                    <span className="w-full text-xs font-semibold text-orange">
                      This changes {habit.title}&rsquo;s goal from {habit.targetDays} to {targetNumber} days.
                    </span>
                  ) : null}
                </label>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {STREAK_PRESETS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setStreakDays(days)}
                      aria-pressed={streakDays === days}
                      className={clsx("rs-preset", streakDays === days && "is-on")}
                    >
                      {days} days
                    </button>
                  ))}
                  <label className="flex items-center gap-1 text-xs font-bold text-muted">
                    or
                    <input
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={365}
                      value={streakDays}
                      onChange={(e) => setStreakDays(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                      aria-label="Streak length in days"
                      className="hab-input min-h-10 py-1 text-center"
                    style={{ width: "5rem" }}
                    />
                  </label>
                </div>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="rs-step">
              <span>3</span> What&rsquo;s the treat?
            </legend>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. New running shoes, a spa day, that cheesecake…"
              aria-label="Reward"
              className="hab-input"
            />
            <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Pick an emoji">
              {REWARD_EMOJIS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setEmoji(option)}
                  aria-pressed={emoji === option}
                  aria-label={`Emoji ${option}`}
                  className={clsx("rs-emoji", emoji === option && "is-on")}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-col gap-3">
          <p className="rs-step">
            <span>✓</span> Preview
          </p>
          <div className="rs-preview" style={{ "--accent": habit ? habitAccent(habit.id) : undefined } as React.CSSProperties}>
            <span className="rs-preview-emoji" key={emoji}>
              {emoji}
            </span>
            <p className="font-display text-2xl font-bold leading-tight">{title.trim() || "Your treat"}</p>
            <p className="mt-2 text-sm font-semibold text-ink/70">
              Unlocks when you{" "}
              {kind === "streak" ? (
                <>
                  do <b>{habit?.title ?? "this habit"}</b> <b>{streakDays || "?"} days in a row</b>
                </>
              ) : (
                <>
                  do <b>{habit?.title ?? "this habit"}</b> on <b>{targetNumber || "?"} days</b> in {monthName}
                </>
              )}
              .
            </p>
          </div>
          <button type="submit" disabled={!canSave || isPending} className={clsx("rs-submit", justAdded && "is-added")}>
            {isPending ? "Adding…" : justAdded ? "Added to the shop ✓" : "Add to the shop ✨"}
          </button>
        </div>
      </form>
    </section>
  );
}

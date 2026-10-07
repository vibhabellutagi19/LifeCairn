import { shiftDateISO } from "@/lib/dates";
import { goalProgress } from "@/lib/habitGoals";

export type RewardKind = "monthly_goal" | "streak";

export type HabitRewardData = {
  id: number;
  title: string;
  emoji: string | null;
  kind: RewardKind;
  streakDays: number | null;
  /** Local date the reward was added; older streaks don't unlock it. */
  createdDate: string;
  /** Claim keys: "yyyy-MM" for monthly goals, "streak:yyyy-MM-dd" for streaks. */
  claimedPeriods: string[];
};

export type RewardStatus = "unlocked" | "claimed" | "locked" | "no-goal";

export type RewardState = {
  status: RewardStatus;
  done: number;
  target: number | null;
  percent: number;
  left: number;
  /** The claim key this reward would be claimed (or un-claimed) under right now. */
  period: string | null;
};

export const REWARD_EMOJIS = ["🎁", "🍰", "🎬", "👟", "💆‍♀️", "📚", "🍕", "☕", "🛍️", "✈️", "🎮", "🌸", "🍦", "🎧", "🧁", "💅"];

export type StreakRun = { start: string; end: string; length: number };

/** Every run of consecutive check-in days, oldest first. */
export function streakRuns(dates: string[]): StreakRun[] {
  const runs: StreakRun[] = [];
  for (const date of [...new Set(dates)].sort()) {
    const last = runs.at(-1);
    if (last && shiftDateISO(last.end, 1) === date) {
      last.end = date;
      last.length += 1;
    } else {
      runs.push({ start: date, end: date, length: 1 });
    }
  }
  return runs;
}

export function streakPeriod(run: StreakRun) {
  return `streak:${run.start}`;
}

/**
 * Where a reward stands, derived from the habit's check-ins and the reward's claims.
 *
 * Monthly goal: unlocks in any month the habit hits its target; claimable once per month.
 * Streak: unlocks when a run of check-ins reaches `streakDays` (runs that ended before the
 * reward existed don't count); claimable once per run, so a new streak earns it again.
 */
export function rewardState(
  reward: HabitRewardData,
  habit: { checkedDates: string[]; targetDays: number | null },
  monthKey: string,
  today: string
): RewardState {
  const claimed = new Set(reward.claimedPeriods);

  if (reward.kind === "monthly_goal") {
    const goal = goalProgress(habit.checkedDates, monthKey, habit.targetDays);
    const base = { done: goal.done, target: goal.target, percent: goal.percent, left: goal.left, period: monthKey };
    if (!goal.target) return { ...base, status: "no-goal", period: null };
    if (claimed.has(monthKey)) return { ...base, status: "claimed" };
    return { ...base, status: goal.reached ? "unlocked" : "locked" };
  }

  const target = Math.max(1, reward.streakDays ?? 7);
  const runs = streakRuns(habit.checkedDates);
  // Same grace as the streak counter: today isn't over, so a run ending yesterday is still alive.
  const current = runs.findLast((run) => run.end === today || run.end === shiftDateISO(today, -1));
  const earned = runs.findLast((run) => run.length >= target && run.end >= reward.createdDate);
  const full = { done: target, target, percent: 100, left: 0 };

  if (earned && !claimed.has(streakPeriod(earned))) {
    return { ...full, status: "unlocked", period: streakPeriod(earned) };
  }
  if (earned && current && earned.start === current.start) {
    return { ...full, done: current.length, status: "claimed", period: streakPeriod(earned) };
  }
  const done = current?.length ?? 0;
  return {
    status: "locked",
    done,
    target,
    percent: Math.min(100, Math.round((done / target) * 100)),
    left: Math.max(0, target - done),
    period: null,
  };
}

/** Short "what earns it" line, e.g. "20 days in October" or "7-day streak". */
export function rewardRule(reward: Pick<HabitRewardData, "kind" | "streakDays">, targetDays: number | null, monthKey: string) {
  if (reward.kind === "streak") return `${reward.streakDays ?? 7}-day streak`;
  const month = new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long" });
  return targetDays ? `${targetDays} days in ${month}` : "Monthly goal (not set)";
}

/** Human label for a claim key. */
export function periodLabel(period: string) {
  if (period.startsWith("streak:")) {
    const start = period.slice(7);
    return `streak from ${new Date(`${start}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  }
  return new Date(`${period}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export const REWARD_STATUS_ORDER: Record<RewardStatus, number> = { unlocked: 0, locked: 1, claimed: 2, "no-goal": 3 };

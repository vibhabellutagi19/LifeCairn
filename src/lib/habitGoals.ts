import { getDaysInMonth } from "date-fns";

export type GoalProgress = {
  done: number;
  /** Days needed this month (capped to the month's length), or null if the habit has no goal. */
  target: number | null;
  percent: number;
  left: number;
  reached: boolean;
};

/** Monthly goal progress for one habit, derived from its check-in dates. */
export function goalProgress(checkedDates: string[], monthKey: string, targetDays: number | null): GoalProgress {
  const done = checkedDates.filter((date) => date.startsWith(monthKey)).length;
  const target = targetDays ? Math.min(targetDays, getDaysInMonth(new Date(`${monthKey}-01T00:00:00`))) : null;
  if (!target) return { done, target: null, percent: 0, left: 0, reached: false };
  return {
    done,
    target,
    percent: Math.round((done / target) * 100),
    left: Math.max(0, target - done),
    reached: done >= target,
  };
}

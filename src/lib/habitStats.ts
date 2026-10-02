import { shiftDateISO } from "@/lib/dates";

export type HabitStats = {
  score: number;
  currentStreak: number;
  longestStreak: number;
  last7: { date: string; done: boolean }[];
};

/**
 * Derives score/streak/history from a habit's completed dates — nothing is
 * stored, so these are always consistent with the log.
 *
 * Streak has a grace period: if today isn't logged yet, yesterday's streak
 * still counts (the day isn't over), so checking in tomorrow doesn't feel
 * like starting over just because you haven't gotten to today yet.
 */
export function computeHabitStats(dates: string[], today: string): HabitStats {
  const done = new Set(dates);
  const score = done.size;

  let currentStreak = 0;
  let cursor = done.has(today) ? today : shiftDateISO(today, -1);
  while (done.has(cursor)) {
    currentStreak += 1;
    cursor = shiftDateISO(cursor, -1);
  }

  const sorted = [...done].sort();
  let longestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sorted) {
    run = prev && shiftDateISO(prev, 1) === d ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    prev = d;
  }

  const last7: { date: string; done: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = shiftDateISO(today, -i);
    last7.push({ date: d, done: done.has(d) });
  }

  return { score, currentStreak, longestStreak, last7 };
}

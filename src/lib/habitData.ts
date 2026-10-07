import { db } from "@/db";
import { habitLogs, habitRewardClaims, habitRewards, habits } from "@/db/schema";
import type { GridHabit } from "@/components/HabitCalendarGrid";
import { toISO } from "@/lib/dates";
import { computeHabitStats } from "@/lib/habitStats";

/** Every habit with its check-ins, streak and rewards, plus the raw claim rows (for history). */
export async function loadHabits(today: string) {
  const [allHabits, allLogs, rewards, claims] = await Promise.all([
    db.select().from(habits).orderBy(habits.sortOrder, habits.id),
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs),
    db.select().from(habitRewards).orderBy(habitRewards.id),
    db.select().from(habitRewardClaims),
  ]);

  const gridHabits = allHabits.map((h): GridHabit => {
    const dates = allLogs.filter((l) => l.habitId === h.id).map((l) => l.date);
    const stats = computeHabitStats(dates, today);
    return {
      id: h.id,
      title: h.title,
      roadmapId: h.roadmapId,
      endDate: h.endDate,
      active: h.active,
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      score: stats.score,
      checkedDates: dates,
      targetDays: h.targetDays,
      rewards: rewards
        .filter((reward) => reward.habitId === h.id)
        .map((reward) => ({
          id: reward.id,
          title: reward.title,
          emoji: reward.emoji,
          kind: reward.kind,
          streakDays: reward.streakDays,
          createdDate: toISO(reward.createdAt),
          claimedPeriods: claims.filter((claim) => claim.rewardId === reward.id).map((claim) => claim.period),
        })),
    };
  });

  return { habits: gridHabits, claims };
}

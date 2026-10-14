import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, habitLogs, habitReactions, habitShares, habits } from "@/db/schema";
import { currentMonthKey, monthRangeISO, todayISO } from "@/lib/dates";
import { computeHabitStats } from "@/lib/habitStats";

export const REACTION_EMOJIS = ["👏", "🔥", "💪", "❤️"] as const;
export type HabitVisibility = "progress" | "full";

export function isVisibility(value: unknown): value is HabitVisibility {
  return value === "progress" || value === "full";
}

export type SharedHabit = {
  id: number;
  title: string;
  visibility: HabitVisibility;
  doneToday: boolean;
  currentStreak: number;
  /** "full" visibility only. */
  last7?: { date: string; done: boolean }[];
  month?: { done: number; target: number | null };
  reactions: { emoji: string; count: number; mine: boolean }[];
};

export type MemberHabits = { ownerId: string; habits: SharedHabit[] };

/**
 * Habits shared into a circle, grouped by owner. The caller must already have
 * checked that the viewer is a member and the circle shares habits. Only
 * people still in the circle are included, and each habit only exposes what
 * its visibility allows.
 */
export async function getCircleHabits(circleId: number, viewerId: string): Promise<MemberHabits[]> {
  const today = todayISO();
  const rows = await db
    .select({ habit: habits, visibility: habitShares.visibility, ownerId: habitShares.ownerId })
    .from(habitShares)
    .innerJoin(habits, eq(habitShares.habitId, habits.id))
    .innerJoin(
      circleMembers,
      and(eq(circleMembers.circleId, habitShares.circleId), eq(circleMembers.userId, habitShares.ownerId))
    )
    .where(and(eq(habitShares.circleId, circleId), eq(habits.active, true)))
    .orderBy(habits.sortOrder, habits.id);

  const shared = rows.filter((r) => !r.habit.endDate || r.habit.endDate >= today);
  if (shared.length === 0) return [];
  const ids = shared.map((r) => r.habit.id);

  const [logs, reactions] = await Promise.all([
    db.select({ habitId: habitLogs.habitId, date: habitLogs.date }).from(habitLogs).where(inArray(habitLogs.habitId, ids)),
    db
      .select()
      .from(habitReactions)
      .where(and(eq(habitReactions.circleId, circleId), eq(habitReactions.date, today), inArray(habitReactions.habitId, ids))),
  ]);
  const month = monthRangeISO(currentMonthKey());

  const byOwner = new Map<string, SharedHabit[]>();
  for (const { habit, visibility, ownerId } of shared) {
    const dates = logs.filter((l) => l.habitId === habit.id).map((l) => l.date);
    const stats = computeHabitStats(dates, today);
    const full = visibility === "full";
    const mine = reactions.filter((r) => r.habitId === habit.id);
    const item: SharedHabit = {
      id: habit.id,
      title: habit.title,
      visibility: full ? "full" : "progress",
      doneToday: dates.includes(today),
      currentStreak: stats.currentStreak,
      reactions: REACTION_EMOJIS.map((emoji) => ({
        emoji,
        count: mine.filter((r) => r.emoji === emoji).length,
        mine: mine.some((r) => r.emoji === emoji && r.fromUserId === viewerId),
      })),
      ...(full
        ? {
            last7: stats.last7,
            month: {
              done: dates.filter((d) => d >= month.start && d <= month.end).length,
              target: habit.targetDays,
            },
          }
        : {}),
    };
    byOwner.set(ownerId, [...(byOwner.get(ownerId) ?? []), item]);
  }

  // The viewer's own habits first, then everyone else.
  return [...byOwner.entries()]
    .map(([ownerId, list]) => ({ ownerId, habits: list }))
    .sort((a, b) => Number(b.ownerId === viewerId) - Number(a.ownerId === viewerId));
}

/** The viewer's own active habits and how each is shared into this circle. */
export async function getMyHabitSharing(circleId: number, userId: string) {
  const today = todayISO();
  const [mine, shares] = await Promise.all([
    db
      .select({ id: habits.id, title: habits.title, endDate: habits.endDate })
      .from(habits)
      .where(and(eq(habits.userId, userId), eq(habits.active, true)))
      .orderBy(habits.sortOrder, habits.id),
    db.select().from(habitShares).where(and(eq(habitShares.circleId, circleId), eq(habitShares.ownerId, userId))),
  ]);
  return mine
    .filter((h) => !h.endDate || h.endDate >= today)
    .map((h) => {
      const share = shares.find((s) => s.habitId === h.id);
      return { id: h.id, title: h.title, visibility: share && isVisibility(share.visibility) ? share.visibility : null };
    });
}

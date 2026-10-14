"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, habitReactions, habitShares, habits } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { circleSharesModule, getMyRole } from "@/lib/circleAccess";
import { REACTION_EMOJIS, isVisibility } from "@/lib/circleHabits";
import { todayISO } from "@/lib/dates";

// Share one of your own habits into a circle you belong to, or stop sharing it (null).
export async function setHabitShare(circleId: number, habitId: number, visibility: string | null) {
  const userId = await requireUserId();
  if (!(await getMyRole(circleId, userId))) return;
  if (!(await circleSharesModule(circleId, "habits"))) return;
  const habit = await db.query.habits.findFirst({
    where: and(eq(habits.id, habitId), eq(habits.userId, userId)),
  });
  if (!habit) return;

  if (!isVisibility(visibility)) {
    await db
      .delete(habitShares)
      .where(and(eq(habitShares.habitId, habitId), eq(habitShares.circleId, circleId)));
    // A habit that is no longer shared can't keep its cheers.
    await db
      .delete(habitReactions)
      .where(and(eq(habitReactions.habitId, habitId), eq(habitReactions.circleId, circleId)));
  } else {
    await db
      .insert(habitShares)
      .values({ habitId, circleId, ownerId: userId, visibility })
      .onConflictDoUpdate({ target: [habitShares.habitId, habitShares.circleId], set: { visibility } });
  }
  revalidatePath(`/circles/${circleId}`);
}

// Cheer on a circle-mate's shared habit for today; tap again to take it back.
export async function toggleHabitReaction(circleId: number, habitId: number, emoji: string) {
  const userId = await requireUserId();
  if (!REACTION_EMOJIS.some((e) => e === emoji)) return;
  if (!(await getMyRole(circleId, userId))) return;
  if (!(await circleSharesModule(circleId, "habits"))) return;

  const share = await db.query.habitShares.findFirst({
    where: and(eq(habitShares.habitId, habitId), eq(habitShares.circleId, circleId)),
  });
  if (!share || share.ownerId === userId) return; // only cheer on other people's habits
  const owner = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, share.ownerId)),
  });
  if (!owner) return;

  const where = and(
    eq(habitReactions.habitId, habitId),
    eq(habitReactions.circleId, circleId),
    eq(habitReactions.fromUserId, userId),
    eq(habitReactions.date, todayISO()),
    eq(habitReactions.emoji, emoji)
  );
  const existing = await db.query.habitReactions.findFirst({ where });
  if (existing) await db.delete(habitReactions).where(where);
  else await db.insert(habitReactions).values({ habitId, circleId, fromUserId: userId, date: todayISO(), emoji });
  revalidatePath(`/circles/${circleId}`);
}

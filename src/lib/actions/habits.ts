"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habitRewardClaims, habitRewards, habits, roadmaps } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { ownsRow } from "@/lib/ownership";

function revalidateAll() {
  revalidatePath("/habits");
  revalidatePath("/habits/rewards");
  revalidatePath("/");
}

export async function createHabit(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const roadmapIdRaw = String(formData.get("roadmapId") || "");
  const roadmapId = roadmapIdRaw ? Number(roadmapIdRaw) : null;
  const endDate = String(formData.get("endDate") || "") || null;
  const targetDays = parseTargetDays(formData.get("targetDays"));
  if (!(await ownsRow(roadmaps, roadmapId, userId))) return;

  await db.insert(habits).values({ userId, title, roadmapId, endDate, targetDays });
  revalidateAll();
}

/** 1–31 days a month, or null for "no monthly goal". */
function parseTargetDays(value: unknown) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 31) : null;
}

export async function updateHabit(
  id: number,
  data: { title: string; roadmapId: number | null; endDate: string | null; targetDays?: number | null }
) {
  const userId = await requireUserId();
  const title = data.title.trim();
  if (!title) return;
  if (!(await ownsRow(roadmaps, data.roadmapId, userId))) return;

  await db
    .update(habits)
    .set({
      title,
      roadmapId: data.roadmapId,
      endDate: data.endDate || null,
      ...(data.targetDays !== undefined ? { targetDays: parseTargetDays(data.targetDays) } : {}),
    })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  revalidateAll();
}

export async function deleteHabit(id: number) {
  const userId = await requireUserId();
  await db.delete(habits).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  revalidateAll();
}

export async function toggleHabitActive(id: number, active: boolean) {
  const userId = await requireUserId();
  await db.update(habits).set({ active }).where(and(eq(habits.id, id), eq(habits.userId, userId)));
  revalidateAll();
}

export async function toggleHabitLog(habitId: number, date: string, checked: boolean) {
  const userId = await requireUserId();
  if (checked) {
    if (!(await ownsRow(habits, habitId, userId))) return;
    await db
      .insert(habitLogs)
      .values({ userId, habitId, date })
      .onConflictDoNothing({ target: [habitLogs.habitId, habitLogs.date] });
  } else {
    await db
      .delete(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
  }
  revalidateAll();
}

/** Sets (or clears, with null) a habit's monthly goal in days. */
export async function setHabitTarget(id: number, targetDays: number | null) {
  const userId = await requireUserId();
  await db
    .update(habits)
    .set({ targetDays: parseTargetDays(targetDays) })
    .where(and(eq(habits.id, id), eq(habits.userId, userId)));
  revalidateAll();
}

export async function addHabitReward(
  habitId: number,
  data: { title: string; emoji?: string | null; kind: "monthly_goal" | "streak"; streakDays?: number | null }
) {
  const userId = await requireUserId();
  const title = data.title.trim().slice(0, 200);
  if (!title) return;
  if (!(await ownsRow(habits, habitId, userId))) return;
  const kind = data.kind === "streak" ? "streak" : "monthly_goal";
  const streakDays = kind === "streak" ? Math.min(365, Math.max(2, Math.round(Number(data.streakDays) || 7))) : null;
  const emoji = data.emoji?.trim().slice(0, 16) || null;
  await db.insert(habitRewards).values({ userId, habitId, title, emoji, kind, streakDays });
  revalidateAll();
}

export async function deleteHabitReward(id: number) {
  const userId = await requireUserId();
  await db.delete(habitRewards).where(and(eq(habitRewards.id, id), eq(habitRewards.userId, userId)));
  revalidateAll();
}

/** Marks a reward as taken (or not) for a period: "yyyy-MM", or "streak:yyyy-MM-dd". */
export async function setHabitRewardClaimed(rewardId: number, period: string, claimed: boolean) {
  const userId = await requireUserId();
  if (!/^(\d{4}-\d{2}|streak:\d{4}-\d{2}-\d{2})$/.test(period)) return;
  if (claimed) {
    if (!(await ownsRow(habitRewards, rewardId, userId))) return;
    await db
      .insert(habitRewardClaims)
      .values({ userId, rewardId, period })
      .onConflictDoNothing({ target: [habitRewardClaims.rewardId, habitRewardClaims.period] });
  } else {
    await db
      .delete(habitRewardClaims)
      .where(
        and(
          eq(habitRewardClaims.userId, userId),
          eq(habitRewardClaims.rewardId, rewardId),
          eq(habitRewardClaims.period, period)
        )
      );
  }
  revalidateAll();
}

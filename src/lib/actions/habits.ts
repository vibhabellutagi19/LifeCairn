"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habitRewardClaims, habitRewards, habits } from "@/db/schema";

function revalidateAll() {
  revalidatePath("/habits");
  revalidatePath("/");
}

export async function createHabit(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const roadmapIdRaw = String(formData.get("roadmapId") || "");
  const roadmapId = roadmapIdRaw ? Number(roadmapIdRaw) : null;
  const endDate = String(formData.get("endDate") || "") || null;
  const targetDays = parseTargetDays(formData.get("targetDays"));

  await db.insert(habits).values({ title, roadmapId, endDate, targetDays });
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
  const title = data.title.trim();
  if (!title) return;

  await db
    .update(habits)
    .set({
      title,
      roadmapId: data.roadmapId,
      endDate: data.endDate || null,
      ...(data.targetDays !== undefined ? { targetDays: parseTargetDays(data.targetDays) } : {}),
    })
    .where(eq(habits.id, id));
  revalidateAll();
}

export async function deleteHabit(id: number) {
  await db.delete(habits).where(eq(habits.id, id));
  revalidateAll();
}

export async function toggleHabitActive(id: number, active: boolean) {
  await db.update(habits).set({ active }).where(eq(habits.id, id));
  revalidateAll();
}

export async function toggleHabitLog(habitId: number, date: string, checked: boolean) {
  if (checked) {
    await db
      .insert(habitLogs)
      .values({ habitId, date })
      .onConflictDoNothing({ target: [habitLogs.habitId, habitLogs.date] });
  } else {
    await db
      .delete(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)));
  }
  revalidateAll();
}

export async function addHabitReward(habitId: number, title: string) {
  const clean = title.trim().slice(0, 200);
  if (!clean) return;
  await db.insert(habitRewards).values({ habitId, title: clean });
  revalidateAll();
}

export async function deleteHabitReward(id: number) {
  await db.delete(habitRewards).where(eq(habitRewards.id, id));
  revalidateAll();
}

/** Marks a reward as taken (or not) for a month, "yyyy-MM". */
export async function setHabitRewardClaimed(rewardId: number, month: string, claimed: boolean) {
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  if (claimed) {
    await db
      .insert(habitRewardClaims)
      .values({ rewardId, month })
      .onConflictDoNothing({ target: [habitRewardClaims.rewardId, habitRewardClaims.month] });
  } else {
    await db
      .delete(habitRewardClaims)
      .where(and(eq(habitRewardClaims.rewardId, rewardId), eq(habitRewardClaims.month, month)));
  }
  revalidateAll();
}

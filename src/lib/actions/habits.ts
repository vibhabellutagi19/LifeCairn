"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { habitLogs, habits } from "@/db/schema";

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

  await db.insert(habits).values({ title, roadmapId, endDate });
  revalidateAll();
}

export async function updateHabit(
  id: number,
  data: { title: string; roadmapId: number | null; endDate: string | null }
) {
  const title = data.title.trim();
  if (!title) return;

  await db
    .update(habits)
    .set({ title, roadmapId: data.roadmapId, endDate: data.endDate || null })
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

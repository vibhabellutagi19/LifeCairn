"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { roadmaps, tasks } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { ownsRow } from "@/lib/ownership";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/review");
}

export async function createTask(date: string, formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const roadmapIdRaw = String(formData.get("roadmapId") || "");
  const roadmapId = roadmapIdRaw ? Number(roadmapIdRaw) : null;
  if (!(await ownsRow(roadmaps, roadmapId, userId))) return;

  await db.insert(tasks).values({ userId, title, date, roadmapId });
  revalidateAll();
}

export async function toggleTask(id: number, completed: boolean) {
  const userId = await requireUserId();
  await db.update(tasks).set({ completed }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  revalidateAll();
}

export async function deleteTask(id: number) {
  const userId = await requireUserId();
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  revalidateAll();
}

/** Carries an unfinished task over to another day (e.g. an overdue one into today). */
export async function moveTaskToDate(id: number, date: string) {
  const userId = await requireUserId();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  await db.update(tasks).set({ date }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  revalidateAll();
  revalidatePath("/pomodoro");
}

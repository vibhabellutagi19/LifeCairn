"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tasks } from "@/db/schema";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/review");
}

export async function createTask(date: string, formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const roadmapIdRaw = String(formData.get("roadmapId") || "");
  const roadmapId = roadmapIdRaw ? Number(roadmapIdRaw) : null;

  await db.insert(tasks).values({ title, date, roadmapId });
  revalidateAll();
}

export async function toggleTask(id: number, completed: boolean) {
  await db.update(tasks).set({ completed }).where(eq(tasks.id, id));
  revalidateAll();
}

export async function deleteTask(id: number) {
  await db.delete(tasks).where(eq(tasks.id, id));
  revalidateAll();
}

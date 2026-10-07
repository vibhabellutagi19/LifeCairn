"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, roadmaps } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { ownsRow } from "@/lib/ownership";

export async function createRoadmap(formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const category = String(formData.get("category") || "General").trim();
  const description = String(formData.get("description") || "").trim();
  const startDate = String(formData.get("startDate") || "") || null;
  const endDate = String(formData.get("endDate") || "") || null;
  const color = String(formData.get("color") || "orange");

  await db.insert(roadmaps).values({
    userId,
    title,
    category,
    description: description || null,
    startDate,
    endDate,
    color,
  });

  revalidatePath("/roadmaps");
  revalidatePath("/");
}

export async function deleteRoadmap(id: number) {
  const userId = await requireUserId();
  await db.delete(roadmaps).where(and(eq(roadmaps.id, id), eq(roadmaps.userId, userId)));
  revalidatePath("/roadmaps");
  revalidatePath("/");
}

export async function createMilestone(roadmapId: number, formData: FormData) {
  const userId = await requireUserId();
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  if (!(await ownsRow(roadmaps, roadmapId, userId))) return;
  const notes = String(formData.get("notes") || "").trim();
  const targetDate = String(formData.get("targetDate") || "") || null;

  await db.insert(milestones).values({
    userId,
    roadmapId,
    title,
    notes: notes || null,
    targetDate,
  });

  revalidatePath(`/roadmaps/${roadmapId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function cycleMilestoneStatus(
  id: number,
  roadmapId: number,
  current: "not_started" | "in_progress" | "done"
) {
  const userId = await requireUserId();
  const next =
    current === "not_started"
      ? "in_progress"
      : current === "in_progress"
        ? "done"
        : "not_started";

  await db
    .update(milestones)
    .set({ status: next })
    .where(and(eq(milestones.id, id), eq(milestones.userId, userId)));
  revalidatePath(`/roadmaps/${roadmapId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function deleteMilestone(id: number, roadmapId: number) {
  const userId = await requireUserId();
  await db.delete(milestones).where(and(eq(milestones.id, id), eq(milestones.userId, userId)));
  revalidatePath(`/roadmaps/${roadmapId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

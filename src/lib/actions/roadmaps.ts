"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, roadmaps } from "@/db/schema";

export async function createRoadmap(formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const category = String(formData.get("category") || "General").trim();
  const description = String(formData.get("description") || "").trim();
  const startDate = String(formData.get("startDate") || "") || null;
  const endDate = String(formData.get("endDate") || "") || null;
  const color = String(formData.get("color") || "orange");

  await db.insert(roadmaps).values({
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
  await db.delete(roadmaps).where(eq(roadmaps.id, id));
  revalidatePath("/roadmaps");
  revalidatePath("/");
}

export async function createMilestone(roadmapId: number, formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const notes = String(formData.get("notes") || "").trim();
  const targetDate = String(formData.get("targetDate") || "") || null;

  await db.insert(milestones).values({
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
  const next =
    current === "not_started"
      ? "in_progress"
      : current === "in_progress"
        ? "done"
        : "not_started";

  await db.update(milestones).set({ status: next }).where(eq(milestones.id, id));
  revalidatePath(`/roadmaps/${roadmapId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function deleteMilestone(id: number, roadmapId: number) {
  await db.delete(milestones).where(eq(milestones.id, id));
  revalidatePath(`/roadmaps/${roadmapId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

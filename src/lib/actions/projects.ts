"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases } from "@/db/schema";
import type { ProjectTaskStatus } from "@/lib/taskStatus";

function revalidateAll(projectId?: number) {
  revalidatePath("/projects");
  revalidatePath("/");
  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/tasks`, "layout");
    revalidatePath(`/projects/${projectId}/releases`, "layout");
  }
}

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const client = String(formData.get("client") || "").trim();
  const status = String(formData.get("status") || "Active");
  const roadmapIdRaw = String(formData.get("roadmapId") || "");
  const roadmapId = roadmapIdRaw ? Number(roadmapIdRaw) : null;
  const startDate = String(formData.get("startDate") || "") || null;
  const deadline = String(formData.get("deadline") || "") || null;
  const rateValue = String(formData.get("rateValue") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  await db.insert(projects).values({
    name,
    client: client || null,
    status,
    roadmapId,
    startDate,
    deadline,
    rateValue: rateValue || null,
    notes: notes || null,
  });

  revalidateAll();
}

export async function deleteProject(id: number) {
  await db.delete(projects).where(eq(projects.id, id));
  revalidateAll();
}

export async function createRelease(projectId: number, formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const startDate = String(formData.get("startDate") || "") || null;
  const targetDate = String(formData.get("targetDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim();
  const releaseNoteUrl = String(formData.get("releaseNoteUrl") || "").trim();

  await db.insert(releases).values({
    projectId,
    name,
    startDate,
    targetDate,
    notes: notes || null,
    releaseNoteUrl: releaseNoteUrl || null,
  });

  revalidateAll(projectId);
}

export async function updateRelease(
  id: number,
  projectId: number,
  data: {
    name: string;
    startDate: string | null;
    targetDate: string | null;
    notes: string | null;
    releaseNoteUrl: string | null;
  }
) {
  const name = data.name.trim();
  if (!name) return;

  await db
    .update(releases)
    .set({
      name,
      startDate: data.startDate || null,
      targetDate: data.targetDate || null,
      notes: data.notes?.trim() || null,
      releaseNoteUrl: data.releaseNoteUrl?.trim() || null,
    })
    .where(and(eq(releases.id, id), eq(releases.projectId, projectId)));
  revalidateAll(projectId);
}

export async function cycleReleaseStatus(
  id: number,
  projectId: number,
  current: "planned" | "in_progress" | "released"
) {
  const next =
    current === "planned"
      ? "in_progress"
      : current === "in_progress"
        ? "released"
        : "planned";

  await db.update(releases).set({ status: next }).where(eq(releases.id, id));
  revalidateAll(projectId);
}

export async function deleteRelease(id: number, projectId: number) {
  await db.delete(releases).where(eq(releases.id, id));
  revalidateAll(projectId);
}

export async function createProjectTask(projectId: number, formData: FormData) {
  const title = String(formData.get("title") || "").trim();
  if (!title) return;
  const branchName = String(formData.get("branchName") || "").trim();
  const priority = String(formData.get("priority") || "medium") as
    | "low"
    | "medium"
    | "high";
  const releaseIdRaw = String(formData.get("releaseId") || "");
  const releaseId = releaseIdRaw ? Number(releaseIdRaw) : null;
  const startDate = String(formData.get("startDate") || "") || null;
  const dueDate = String(formData.get("dueDate") || "") || null;
  const estHoursRaw = String(formData.get("estHours") || "").trim();
  const toBacklog = formData.get("backlog") === "on";
  const notes = String(formData.get("notes") || "").trim();

  await db.insert(projectTasks).values({
    projectId,
    releaseId,
    title,
    branchName: branchName || null,
    priority,
    startDate,
    dueDate,
    estHours: estHoursRaw || null,
    notes: notes || null,
    ...(toBacklog ? { status: "backlog" as const } : {}),
  });

  revalidateAll(projectId);
}

export async function updateProjectTaskDetails(
  id: number,
  projectId: number,
  data: { title: string; branchName: string | null; notes: string | null; estHours: string | null }
) {
  const title = data.title.trim();
  if (!title) return;

  await db
    .update(projectTasks)
    .set({
      title,
      branchName: data.branchName?.trim() || null,
      notes: data.notes?.trim() || null,
      estHours: data.estHours?.trim() || null,
    })
    .where(eq(projectTasks.id, id));
  revalidateAll(projectId);
}

export async function setProjectTaskStatus(
  id: number,
  projectId: number,
  status: ProjectTaskStatus
) {
  await db
    .update(projectTasks)
    .set({ status })
    .where(and(eq(projectTasks.id, id), eq(projectTasks.projectId, projectId)));
  revalidateAll(projectId);
}

export async function setProjectTaskPriority(
  id: number,
  projectId: number,
  priority: "low" | "medium" | "high"
) {
  await db.update(projectTasks).set({ priority }).where(eq(projectTasks.id, id));
  revalidateAll(projectId);
}

export async function setProjectTaskRelease(
  id: number,
  projectId: number,
  releaseId: number | null
) {
  await db.update(projectTasks).set({ releaseId }).where(eq(projectTasks.id, id));
  revalidateAll(projectId);
}

export async function deleteProjectTask(id: number, projectId: number) {
  await db.delete(projectTasks).where(eq(projectTasks.id, id));
  revalidateAll(projectId);
}

// Sets a task's start/due window directly — it then surfaces on every day
// in that range (e.g. 25th-30th) in the Dashboard's Today's Tasks card,
// automatically, with no further action needed each day.
export async function setProjectTaskDates(
  id: number,
  projectId: number,
  startDate: string | null,
  dueDate: string | null
) {
  await db
    .update(projectTasks)
    .set({ startDate, dueDate })
    .where(eq(projectTasks.id, id));
  revalidateAll(projectId);
}

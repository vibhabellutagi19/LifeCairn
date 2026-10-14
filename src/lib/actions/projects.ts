"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases, roadmaps } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { ownsRow } from "@/lib/ownership";
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
  const userId = await requireUserId();
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
  if (!(await ownsRow(roadmaps, roadmapId, userId))) return;

  await db.insert(projects).values({
    userId,
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

export async function updateProject(id: number, formData: FormData) {
  const userId = await requireUserId();
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
  if (!(await ownsRow(roadmaps, roadmapId, userId))) return;

  await db
    .update(projects)
    .set({
      name,
      client: client || null,
      status,
      roadmapId,
      startDate,
      deadline,
      rateValue: rateValue || null,
      notes: notes || null,
    })
    .where(and(eq(projects.id, id), eq(projects.userId, userId)));

  revalidateAll(id);
}

export async function deleteProject(id: number) {
  const userId = await requireUserId();
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
  revalidateAll();
}

export async function createRelease(projectId: number, formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const startDate = String(formData.get("startDate") || "") || null;
  const targetDate = String(formData.get("targetDate") || "") || null;
  const notes = String(formData.get("notes") || "").trim();
  const releaseNoteUrl = String(formData.get("releaseNoteUrl") || "").trim();
  if (!(await ownsRow(projects, projectId, userId))) return;

  await db.insert(releases).values({
    userId,
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
  const userId = await requireUserId();
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
    .where(
      and(eq(releases.id, id), eq(releases.projectId, projectId), eq(releases.userId, userId))
    );
  revalidateAll(projectId);
}

export async function cycleReleaseStatus(
  id: number,
  projectId: number,
  current: "planned" | "in_progress" | "released"
) {
  const userId = await requireUserId();
  const next =
    current === "planned"
      ? "in_progress"
      : current === "in_progress"
        ? "released"
        : "planned";

  await db
    .update(releases)
    .set({ status: next })
    .where(and(eq(releases.id, id), eq(releases.userId, userId)));
  revalidateAll(projectId);
}

export async function deleteRelease(id: number, projectId: number) {
  const userId = await requireUserId();
  await db.delete(releases).where(and(eq(releases.id, id), eq(releases.userId, userId)));
  revalidateAll(projectId);
}

export async function createProjectTask(projectId: number, formData: FormData) {
  const userId = await requireUserId();
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
  if (!(await ownsRow(projects, projectId, userId))) return;
  if (!(await ownsRow(releases, releaseId, userId))) return;

  await db.insert(projectTasks).values({
    userId,
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
  const userId = await requireUserId();
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
    .where(and(eq(projectTasks.id, id), eq(projectTasks.userId, userId)));
  revalidateAll(projectId);
}

export async function setProjectTaskStatus(
  id: number,
  projectId: number,
  status: ProjectTaskStatus
) {
  const userId = await requireUserId();
  await db
    .update(projectTasks)
    .set({ status })
    .where(
      and(
        eq(projectTasks.id, id),
        eq(projectTasks.projectId, projectId),
        eq(projectTasks.userId, userId)
      )
    );
  revalidateAll(projectId);
}

export async function setProjectTaskPriority(
  id: number,
  projectId: number,
  priority: "low" | "medium" | "high"
) {
  const userId = await requireUserId();
  await db
    .update(projectTasks)
    .set({ priority })
    .where(and(eq(projectTasks.id, id), eq(projectTasks.userId, userId)));
  revalidateAll(projectId);
}

export async function setProjectTaskRelease(
  id: number,
  projectId: number,
  releaseId: number | null
) {
  const userId = await requireUserId();
  if (!(await ownsRow(releases, releaseId, userId))) return;
  await db
    .update(projectTasks)
    .set({ releaseId })
    .where(and(eq(projectTasks.id, id), eq(projectTasks.userId, userId)));
  revalidateAll(projectId);
}

// Moves a task to another project. Releases belong to a project, so the
// task's release link is cleared.
export async function moveProjectTask(id: number, fromProjectId: number, toProjectId: number) {
  const userId = await requireUserId();
  if (fromProjectId === toProjectId) return;
  if (!(await ownsRow(projects, toProjectId, userId))) return;

  await db
    .update(projectTasks)
    .set({ projectId: toProjectId, releaseId: null })
    .where(
      and(
        eq(projectTasks.id, id),
        eq(projectTasks.projectId, fromProjectId),
        eq(projectTasks.userId, userId)
      )
    );
  revalidateAll(fromProjectId);
  revalidateAll(toProjectId);
}

export async function deleteProjectTask(id: number, projectId: number) {
  const userId = await requireUserId();
  await db.delete(projectTasks).where(and(eq(projectTasks.id, id), eq(projectTasks.userId, userId)));
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
  const userId = await requireUserId();
  await db
    .update(projectTasks)
    .set({ startDate, dueDate })
    .where(and(eq(projectTasks.id, id), eq(projectTasks.userId, userId)));
  revalidateAll(projectId);
}

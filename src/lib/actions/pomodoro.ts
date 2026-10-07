"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pomodoroSessions, pomodoroSettings, projectTasks } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { ownsRow } from "@/lib/ownership";

function isISODate(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

function clampMinutes(value: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(1, Math.round(value))) : null;
}

export async function logPomodoroSession(
  date: string,
  minutes: number,
  taskId: number | null,
  taskTitle: string | null
) {
  const userId = await requireUserId();
  const safeMinutes = clampMinutes(minutes, 240);
  if (!isISODate(date) || safeMinutes === null) return;
  const safeTaskId = taskId && Number.isInteger(taskId) ? taskId : null;
  if (!(await ownsRow(projectTasks, safeTaskId, userId))) return;

  await db.insert(pomodoroSessions).values({
    userId,
    date,
    minutes: safeMinutes,
    taskId: safeTaskId,
    taskTitle: taskTitle?.trim().slice(0, 300) || null,
  });
  revalidatePath("/pomodoro");
}

export async function deletePomodoroSession(id: number) {
  const userId = await requireUserId();
  await db
    .delete(pomodoroSessions)
    .where(and(eq(pomodoroSessions.id, id), eq(pomodoroSessions.userId, userId)));
  revalidatePath("/pomodoro");
}

export async function savePomodoroSettings(focus: number, shortBreak: number, longBreak: number) {
  const userId = await requireUserId();
  const focusMinutes = clampMinutes(focus, 180);
  const shortBreakMinutes = clampMinutes(shortBreak, 60);
  const longBreakMinutes = clampMinutes(longBreak, 90);
  if (focusMinutes === null || shortBreakMinutes === null || longBreakMinutes === null) return null;

  const values = { focusMinutes, shortBreakMinutes, longBreakMinutes, updatedAt: new Date() };
  await db
    .insert(pomodoroSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: pomodoroSettings.userId, set: values });
  revalidatePath("/pomodoro");
  return { focusMinutes, shortBreakMinutes, longBreakMinutes };
}

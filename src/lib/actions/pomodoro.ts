"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pomodoroSessions, pomodoroSettings } from "@/db/schema";

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
  const safeMinutes = clampMinutes(minutes, 240);
  if (!isISODate(date) || safeMinutes === null) return;

  await db.insert(pomodoroSessions).values({
    date,
    minutes: safeMinutes,
    taskId: taskId && Number.isInteger(taskId) ? taskId : null,
    taskTitle: taskTitle?.trim().slice(0, 300) || null,
  });
  revalidatePath("/pomodoro");
}

export async function deletePomodoroSession(id: number) {
  await db.delete(pomodoroSessions).where(eq(pomodoroSessions.id, id));
  revalidatePath("/pomodoro");
}

export async function savePomodoroSettings(focus: number, shortBreak: number, longBreak: number) {
  const focusMinutes = clampMinutes(focus, 180);
  const shortBreakMinutes = clampMinutes(shortBreak, 60);
  const longBreakMinutes = clampMinutes(longBreak, 90);
  if (focusMinutes === null || shortBreakMinutes === null || longBreakMinutes === null) return null;

  const values = { focusMinutes, shortBreakMinutes, longBreakMinutes, updatedAt: new Date() };
  await db
    .insert(pomodoroSettings)
    .values({ profileKey: "default", ...values })
    .onConflictDoUpdate({ target: pomodoroSettings.profileKey, set: values });
  revalidatePath("/pomodoro");
  return { focusMinutes, shortBreakMinutes, longBreakMinutes };
}

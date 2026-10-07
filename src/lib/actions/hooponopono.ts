"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { hooponoponoRounds } from "@/db/schema";
import { requireUserId } from "@/lib/auth";

function revalidate() {
  revalidatePath("/hooponopono");
  revalidatePath("/manifestation");
}

/** Saves a finished session and returns its id (so a reflection can be added after). */
export async function logHooponoponoSession(
  date: string,
  repetitions: number,
  target: number | null,
  intention: string
) {
  const userId = await requireUserId();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(repetitions) || repetitions < 1) return null;
  const [row] = await db
    .insert(hooponoponoRounds)
    .values({
      userId,
      date,
      repetitions: Math.min(repetitions, 100_000),
      target: target && Number.isInteger(target) && target > 0 ? target : null,
      intention: intention.trim().slice(0, 200) || null,
    })
    .returning({ id: hooponoponoRounds.id });
  revalidate();
  return row?.id ?? null;
}

export async function updateHooponoponoNote(id: number, note: string) {
  const userId = await requireUserId();
  await db
    .update(hooponoponoRounds)
    .set({ note: note.trim().slice(0, 2000) || null })
    .where(and(eq(hooponoponoRounds.id, id), eq(hooponoponoRounds.userId, userId)));
  revalidate();
}

export async function deleteHooponoponoSession(id: number) {
  const userId = await requireUserId();
  await db
    .delete(hooponoponoRounds)
    .where(and(eq(hooponoponoRounds.id, id), eq(hooponoponoRounds.userId, userId)));
  revalidate();
}

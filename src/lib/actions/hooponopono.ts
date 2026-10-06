"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { hooponoponoRounds } from "@/db/schema";

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(repetitions) || repetitions < 1) return null;
  const [row] = await db
    .insert(hooponoponoRounds)
    .values({
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
  await db
    .update(hooponoponoRounds)
    .set({ note: note.trim().slice(0, 2000) || null })
    .where(eq(hooponoponoRounds.id, id));
  revalidate();
}

export async function deleteHooponoponoSession(id: number) {
  await db.delete(hooponoponoRounds).where(eq(hooponoponoRounds.id, id));
  revalidate();
}

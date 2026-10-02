"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";

export async function saveJournalEntry(date: string, formData: FormData) {
  const content = String(formData.get("content") || "");
  const gratitude = String(formData.get("gratitude") || "");
  const mood = String(formData.get("mood") || "") || null;

  const existing = await db.query.journalEntries.findFirst({
    where: eq(journalEntries.date, date),
  });

  if (existing) {
    await db
      .update(journalEntries)
      .set({ content, gratitude: gratitude || null, mood, updatedAt: new Date() })
      .where(eq(journalEntries.date, date));
  } else {
    await db.insert(journalEntries).values({
      date,
      content,
      gratitude: gratitude || null,
      mood,
    });
  }

  revalidatePath("/journal");
  revalidatePath(`/journal/${date}`);
  revalidatePath("/");
  revalidatePath("/review");
}

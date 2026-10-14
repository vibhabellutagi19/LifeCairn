"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { journalEntries } from "@/db/schema";
import { openManifestation } from "@/lib/manifestationApp";

async function requireUserId(): Promise<string> {
  openManifestation("/journal");
}

function entryFor(userId: string, date: string) {
  return and(eq(journalEntries.userId, userId), eq(journalEntries.date, date));
}

export async function saveJournalEntry(date: string, formData: FormData) {
  const userId = await requireUserId();
  const content = String(formData.get("content") || "");
  const gratitude = String(formData.get("gratitude") || "");
  const mood = String(formData.get("mood") || "") || null;

  const existing = await db.query.journalEntries.findFirst({
    where: entryFor(userId, date),
  });

  if (existing) {
    await db
      .update(journalEntries)
      .set({ content, gratitude: gratitude || null, mood, updatedAt: new Date() })
      .where(entryFor(userId, date));
  } else {
    await db.insert(journalEntries).values({
      userId,
      date,
      content,
      gratitude: gratitude || null,
      mood,
    });
  }

  revalidateJournal(date);
}

function revalidateJournal(date: string) {
  revalidatePath("/journal");
  revalidatePath(`/journal/${date}`);
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/manifestation");
}

/** Gratitude is stored one item per line on the day's journal entry. */
export async function addGratitude(date: string, text: string) {
  const userId = await requireUserId();
  const item = text.trim().replace(/\s*\n\s*/g, " ").slice(0, 200);
  if (!item || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;

  const existing = await db.query.journalEntries.findFirst({ where: entryFor(userId, date) });
  if (existing) {
    const gratitude = existing.gratitude ? `${existing.gratitude}\n${item}` : item;
    await db.update(journalEntries).set({ gratitude, updatedAt: new Date() }).where(entryFor(userId, date));
  } else {
    await db.insert(journalEntries).values({ userId, date, gratitude: item });
  }
  revalidateJournal(date);
}

export async function removeGratitude(date: string, index: number) {
  const userId = await requireUserId();
  const existing = await db.query.journalEntries.findFirst({ where: entryFor(userId, date) });
  if (!existing?.gratitude) return;
  const items = existing.gratitude.split("\n").filter((line) => line.trim());
  if (index < 0 || index >= items.length) return;
  items.splice(index, 1);
  await db
    .update(journalEntries)
    .set({ gratitude: items.length ? items.join("\n") : null, updatedAt: new Date() })
    .where(entryFor(userId, date));
  revalidateJournal(date);
}

"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customEmotions, emotionalCheckins, emotionalTrackingSettings } from "@/db/schema";
import {
  customEmotionId,
  customEmotionKey,
  isBuiltInEmotionKey,
  type EmotionCategory,
} from "@/lib/emotions";
import { requireUserId } from "@/lib/auth";

function isISODate(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value);
}

function revalidateManifestation() {
  revalidatePath("/");
  revalidatePath("/manifestation");
}

export async function setEmotionalCheckin(
  date: string,
  hour: number,
  emotion: string
) {
  const userId = await requireUserId();
  if (!isISODate(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) {
    return;
  }

  if (!isBuiltInEmotionKey(emotion)) {
    const customId = customEmotionId(emotion);
    if (!customId) return;
    const custom = await db.query.customEmotions.findFirst({
      where: and(
        eq(customEmotions.id, customId),
        eq(customEmotions.userId, userId),
        eq(customEmotions.active, true)
      ),
    });
    if (!custom) return;
  }

  await db
    .insert(emotionalCheckins)
    .values({ userId, date, hour, emotion })
    .onConflictDoUpdate({
      target: [emotionalCheckins.userId, emotionalCheckins.date, emotionalCheckins.hour],
      set: { emotion, updatedAt: new Date() },
    });

  revalidateManifestation();
}

export async function saveEmotionalTrackingWindow(startHour: number, endHour: number) {
  const userId = await requireUserId();
  if (
    !Number.isInteger(startHour) ||
    !Number.isInteger(endHour) ||
    startHour < 0 ||
    endHour > 23 ||
    startHour >= endHour
  ) {
    return false;
  }

  await db
    .insert(emotionalTrackingSettings)
    .values({ userId, startHour, endHour })
    .onConflictDoUpdate({
      target: emotionalTrackingSettings.userId,
      set: { startHour, endHour, updatedAt: new Date() },
    });

  revalidateManifestation();
  return true;
}

export async function createCustomEmotion(
  nameInput: string,
  emojiInput: string,
  category: EmotionCategory
) {
  const userId = await requireUserId();
  const name = nameInput.trim().slice(0, 60);
  const emoji = emojiInput.trim().slice(0, 20) || "◌";
  if (!name || !["positive", "negative", "missing"].includes(category)) return null;

  const existing = await db.query.customEmotions.findFirst({
    where: and(eq(customEmotions.userId, userId), eq(customEmotions.name, name)),
  });
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      emoji: existing.emoji,
      category: existing.category,
      key: customEmotionKey(existing.id),
    };
  }

  const [created] = await db
    .insert(customEmotions)
    .values({ userId, name, emoji, category })
    .returning();

  revalidateManifestation();
  return {
    id: created.id,
    name: created.name,
    emoji: created.emoji,
    category: created.category,
    key: customEmotionKey(created.id),
  };
}

export async function clearEmotionalCheckin(date: string, hour: number) {
  const userId = await requireUserId();
  if (!isISODate(date) || !Number.isInteger(hour) || hour < 0 || hour > 23) return;

  await db
    .delete(emotionalCheckins)
    .where(
      and(
        eq(emotionalCheckins.userId, userId),
        eq(emotionalCheckins.date, date),
        eq(emotionalCheckins.hour, hour)
      )
    );

  revalidateManifestation();
}

"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramLinkCodes, telegramLinks } from "@/db/schema";
import { requireUserId } from "@/lib/auth";

const CODE_TTL_MINUTES = 15;

/** A fresh one-time code (replacing any older one) and the bot deep link that sends it. */
export async function createTelegramLinkCode(): Promise<{ code: string; url: string | null; expiresAt: string }> {
  const userId = await requireUserId();
  const code = randomBytes(12).toString("base64url");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  await db.transaction(async (tx) => {
    await tx.delete(telegramLinkCodes).where(eq(telegramLinkCodes.userId, userId));
    await tx.insert(telegramLinkCodes).values({ code, userId, expiresAt });
  });
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  return {
    code,
    url: bot ? `https://t.me/${bot.replace(/^@/, "")}?start=${code}` : null,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function unlinkTelegram() {
  const userId = await requireUserId();
  await db.delete(telegramLinks).where(eq(telegramLinks.userId, userId));
  revalidatePath("/profile");
}

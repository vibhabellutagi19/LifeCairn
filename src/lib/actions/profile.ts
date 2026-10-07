"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { requireUserId } from "@/lib/auth";

export type NicknameState = { ok: boolean; message: string } | null;

export async function saveNickname(_prev: NicknameState, formData: FormData): Promise<NicknameState> {
  const userId = await requireUserId();
  const nickname = String(formData.get("nickname") || "").trim().replace(/\s+/g, " ").slice(0, 30);
  if (!nickname) return { ok: false, message: "Type a nickname first." };

  await db
    .insert(profiles)
    .values({ userId, nickname })
    .onConflictDoUpdate({ target: profiles.userId, set: { nickname, updatedAt: new Date() } });

  revalidatePath("/");
  revalidatePath("/profile");
  return { ok: true, message: `Saved! Nice to meet you, ${nickname} 😺` };
}

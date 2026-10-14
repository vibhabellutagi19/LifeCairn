"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { getDisabledModules } from "@/lib/moduleSettings";
import { isModuleKey } from "@/lib/modules";

export async function setModuleEnabled(key: string, enabled: boolean) {
  const userId = await requireUserId();
  if (!isModuleKey(key)) return;

  const disabled = new Set(await getDisabledModules(userId));
  if (enabled) disabled.delete(key);
  else disabled.add(key);
  const disabledModules = [...disabled];

  await db
    .insert(userSettings)
    .values({ userId, disabledModules })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { disabledModules, updatedAt: new Date() },
    });

  // The sidebar lives in the root layout, so refresh every page.
  revalidatePath("/", "layout");
}

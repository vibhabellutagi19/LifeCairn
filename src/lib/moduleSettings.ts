import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { isModuleKey, type ModuleKey } from "@/lib/modules";

/** Modules the user switched off. New modules are on by default. */
export const getDisabledModules = cache(async (userId: string): Promise<ModuleKey[]> => {
  const row = await db.query.userSettings.findFirst({ where: eq(userSettings.userId, userId) });
  return [...(row?.disabledModules ?? []).filter(isModuleKey), "manifestation", "journal"];
});

/** Like requireUserId(), but sends the user to Profile if this module is switched off. */
export async function requireModule(key: ModuleKey): Promise<string> {
  const userId = await requireUserId();
  const disabled = await getDisabledModules(userId);
  if (disabled.includes(key)) redirect(`/profile?off=${key}`);
  return userId;
}

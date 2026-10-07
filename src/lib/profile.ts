import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";

/** The user's chosen nickname, or null if they haven't set one yet. */
export async function getNickname(userId: string): Promise<string | null> {
  const row = await db.query.profiles.findFirst({ where: eq(profiles.userId, userId) });
  return row?.nickname ?? null;
}

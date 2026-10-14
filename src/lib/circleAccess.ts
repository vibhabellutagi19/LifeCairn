import { cache } from "react";
import { and, eq, inArray } from "drizzle-orm";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { circleInvites, circleMembers, circleModules, circles, profiles } from "@/db/schema";
import { isCircleRole, type CircleRole } from "@/lib/circleTypes";
import type { ModuleKey } from "@/lib/modules";

export async function getMyRole(circleId: number, userId: string): Promise<CircleRole | null> {
  const row = await db.query.circleMembers.findFirst({
    where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)),
  });
  return row && isCircleRole(row.role) ? row.role : null;
}

/** Verified email addresses of the signed-in user, lowercased. */
export const getMyEmails = cache(async (): Promise<string[]> => {
  const user = await currentUser();
  if (!user) return [];
  return user.emailAddresses
    .filter((e) => e.verification?.status === "verified")
    .map((e) => e.emailAddress.toLowerCase());
});

export type PendingInvite = {
  id: number;
  circleId: number;
  circleName: string;
  role: CircleRole;
};

/** Invitations addressed to the signed-in user's email(s). */
export async function getPendingInvites(): Promise<PendingInvite[]> {
  const emails = await getMyEmails();
  if (emails.length === 0) return [];
  const rows = await db
    .select({
      id: circleInvites.id,
      circleId: circleInvites.circleId,
      circleName: circles.name,
      role: circleInvites.role,
    })
    .from(circleInvites)
    .innerJoin(circles, eq(circleInvites.circleId, circles.id))
    .where(inArray(circleInvites.email, emails))
    .orderBy(circleInvites.createdAt);
  return rows.map((r) => ({ ...r, role: isCircleRole(r.role) ? r.role : "member" }));
}

export type Person = { name: string; email: string | null };

/** Display names for circle members: their nickname if set, else their Clerk name or email. */
export async function getPeople(userIds: string[]): Promise<Map<string, Person>> {
  const people = new Map<string, Person>();
  if (userIds.length === 0) return people;

  const [nicknames, client] = await Promise.all([
    db.select({ userId: profiles.userId, nickname: profiles.nickname }).from(profiles).where(inArray(profiles.userId, userIds)),
    clerkClient(),
  ]);
  const nicknameOf = new Map(nicknames.map((n) => [n.userId, n.nickname]));
  const { data: users } = await client.users.getUserList({ userId: userIds, limit: userIds.length });

  for (const user of users) {
    const email = user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
    const full = [user.firstName, user.lastName].filter(Boolean).join(" ");
    people.set(user.id, {
      name: nicknameOf.get(user.id) || full || user.username || email?.split("@")[0] || "Someone",
      email,
    });
  }
  for (const id of userIds) if (!people.has(id)) people.set(id, { name: nicknameOf.get(id) ?? "Someone", email: null });
  return people;
}

export async function circleSharesModule(circleId: number, module: ModuleKey): Promise<boolean> {
  const row = await db.query.circleModules.findFirst({
    where: and(eq(circleModules.circleId, circleId), eq(circleModules.module, module)),
  });
  return Boolean(row);
}

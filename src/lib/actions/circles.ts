"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import {
  circleInvites,
  circleMembers,
  circleModules,
  circles,
  financeShares,
  habitReactions,
  habitShares,
} from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { getMyEmails, getMyRole } from "@/lib/circleAccess";
import { SHAREABLE_MODULES } from "@/lib/circleTypes";

export type CircleFormState = { ok: boolean; message: string } | null;

function revalidateCircles(circleId?: number) {
  revalidatePath("/circles");
  revalidatePath("/");
  if (circleId) revalidatePath(`/circles/${circleId}`);
}

// Leaving or being removed withdraws what that person shared into the circle
// (their habits and logs themselves are untouched), so rejoining needs fresh consent.
async function withdrawFromCircle(circleId: number, userId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(habitShares).where(and(eq(habitShares.circleId, circleId), eq(habitShares.ownerId, userId)));
    await tx.delete(financeShares).where(and(eq(financeShares.circleId, circleId), eq(financeShares.ownerId, userId)));
    await tx
      .delete(habitReactions)
      .where(and(eq(habitReactions.circleId, circleId), eq(habitReactions.fromUserId, userId)));
    await tx
      .delete(circleMembers)
      .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, userId)));
  });
}

function parseModules(formData: FormData): string[] {
  return formData.getAll("modules").map(String).filter((m) => SHAREABLE_MODULES.some((s) => s === m));
}

export async function createCircle(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  if (!name) return;
  const modules = parseModules(formData);

  const circleId = await db.transaction(async (tx) => {
    const [circle] = await tx.insert(circles).values({ name, createdBy: userId }).returning({ id: circles.id });
    await tx.insert(circleMembers).values({ circleId: circle.id, userId, role: "head" });
    if (modules.length) {
      await tx.insert(circleModules).values(modules.map((module) => ({ circleId: circle.id, module })));
    }
    return circle.id;
  });

  revalidateCircles();
  redirect(`/circles/${circleId}`);
}

// Head and co-head can rename the circle and change what it shares.
export async function updateCircle(circleId: number, formData: FormData) {
  const userId = await requireUserId();
  const role = await getMyRole(circleId, userId);
  if (role !== "head" && role !== "co_head") return;
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  if (!name) return;
  const modules = parseModules(formData);

  await db.transaction(async (tx) => {
    await tx.update(circles).set({ name }).where(eq(circles.id, circleId));
    await tx.delete(circleModules).where(eq(circleModules.circleId, circleId));
    if (modules.length) {
      await tx.insert(circleModules).values(modules.map((module) => ({ circleId, module })));
    }
  });
  revalidateCircles(circleId);
}

export async function deleteCircle(circleId: number) {
  const userId = await requireUserId();
  if ((await getMyRole(circleId, userId)) !== "head") return;
  await db.delete(circles).where(eq(circles.id, circleId));
  revalidateCircles();
}

export async function leaveCircle(circleId: number) {
  const userId = await requireUserId();
  const role = await getMyRole(circleId, userId);
  if (!role || role === "head") return; // the head deletes the circle instead
  await withdrawFromCircle(circleId, userId);
  revalidateCircles(circleId);
}

// The head can remove anyone; a co-head can remove regular members.
export async function removeMember(circleId: number, targetUserId: string) {
  const userId = await requireUserId();
  if (targetUserId === userId) return;
  const [myRole, targetRole] = await Promise.all([
    getMyRole(circleId, userId),
    getMyRole(circleId, targetUserId),
  ]);
  if (!myRole || !targetRole || targetRole === "head") return;
  if (myRole === "member" || (myRole === "co_head" && targetRole !== "member")) return;

  await withdrawFromCircle(circleId, targetUserId);
  revalidateCircles(circleId);
}

// Only the head sets roles. There is one co-head slot.
export async function setMemberRole(circleId: number, targetUserId: string, role: "co_head" | "member") {
  const userId = await requireUserId();
  if ((await getMyRole(circleId, userId)) !== "head") return;
  if ((await getMyRole(circleId, targetUserId)) === null || targetUserId === userId) return;

  if (role === "co_head") {
    const existing = await db.query.circleMembers.findFirst({
      where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.role, "co_head")),
    });
    if (existing && existing.userId !== targetUserId) return;
  }
  await db
    .update(circleMembers)
    .set({ role })
    .where(and(eq(circleMembers.circleId, circleId), eq(circleMembers.userId, targetUserId)));
  revalidateCircles(circleId);
}

async function originUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "";
}

export async function inviteToCircle(
  circleId: number,
  _prev: CircleFormState,
  formData: FormData
): Promise<CircleFormState> {
  const userId = await requireUserId();
  const myRole = await getMyRole(circleId, userId);
  if (myRole !== "head" && myRole !== "co_head") return { ok: false, message: "Only the head or co-head can invite people." };

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if ((await getMyEmails()).includes(email)) return { ok: false, message: "That's your own email." };

  // The co-head slot is the head's to give, and there's only one.
  let role: "co_head" | "member" = formData.get("role") === "co_head" ? "co_head" : "member";
  if (role === "co_head") {
    if (myRole !== "head") return { ok: false, message: "Only the head can invite a co-head." };
    const [taken, pending] = await Promise.all([
      db.query.circleMembers.findFirst({
        where: and(eq(circleMembers.circleId, circleId), eq(circleMembers.role, "co_head")),
      }),
      db.query.circleInvites.findFirst({
        where: and(eq(circleInvites.circleId, circleId), eq(circleInvites.role, "co_head")),
      }),
    ]);
    if (taken || pending) role = "member";
  }

  const client = await clerkClient();
  const { data: existingUsers } = await client.users.getUserList({ emailAddress: [email] });
  const existing = existingUsers[0];

  if (existing) {
    if (await getMyRole(circleId, existing.id)) return { ok: false, message: "They're already in this circle." };
  } else {
    // New to LifeCairn: Clerk emails them a sign-up link (sign-ups are invite-only).
    try {
      await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${await originUrl()}/circles`,
        ignoreExisting: true,
      });
    } catch {
      return { ok: false, message: "Couldn't send the sign-up invitation. Try again in a moment." };
    }
  }

  await db
    .insert(circleInvites)
    .values({ circleId, email, role, invitedBy: userId })
    .onConflictDoUpdate({ target: [circleInvites.circleId, circleInvites.email], set: { role, invitedBy: userId } });

  revalidateCircles(circleId);
  return {
    ok: true,
    message: existing
      ? `Invited ${email}. They'll see it under Circles the next time they open LifeCairn.`
      : `Sign-up invitation sent to ${email}. They'll join once they accept.`,
  };
}

export async function revokeInvite(inviteId: number) {
  const userId = await requireUserId();
  const invite = await db.query.circleInvites.findFirst({ where: eq(circleInvites.id, inviteId) });
  if (!invite) return;
  const role = await getMyRole(invite.circleId, userId);
  if (role !== "head" && role !== "co_head") return;
  await db.delete(circleInvites).where(eq(circleInvites.id, inviteId));
  revalidateCircles(invite.circleId);
}

async function myInvite(inviteId: number) {
  const emails = await getMyEmails();
  if (emails.length === 0) return undefined;
  return db.query.circleInvites.findFirst({
    where: and(eq(circleInvites.id, inviteId), inArray(circleInvites.email, emails)),
  });
}

export async function acceptInvite(inviteId: number) {
  const userId = await requireUserId();
  const invite = await myInvite(inviteId);
  if (!invite) return;

  await db.transaction(async (tx) => {
    // If the co-head slot was filled in the meantime, join as a member.
    let role = invite.role;
    if (role === "co_head") {
      const taken = await tx.query.circleMembers.findFirst({
        where: and(eq(circleMembers.circleId, invite.circleId), eq(circleMembers.role, "co_head")),
      });
      if (taken) role = "member";
    }
    await tx
      .insert(circleMembers)
      .values({ circleId: invite.circleId, userId, role })
      .onConflictDoNothing();
    await tx.delete(circleInvites).where(eq(circleInvites.id, inviteId));
  });

  revalidateCircles(invite.circleId);
  redirect(`/circles/${invite.circleId}`);
}

export async function declineInvite(inviteId: number) {
  await requireUserId();
  const invite = await myInvite(inviteId);
  if (!invite) return;
  await db.delete(circleInvites).where(eq(circleInvites.id, inviteId));
  revalidateCircles();
}

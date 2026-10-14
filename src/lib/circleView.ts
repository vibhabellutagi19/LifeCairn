import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, circleModules, circles } from "@/db/schema";
import { requireUserId } from "@/lib/auth";
import { getPeople } from "@/lib/circleAccess";
import { isCircleRole, type CircleRole } from "@/lib/circleTypes";

const ROLE_ORDER: Record<CircleRole, number> = { head: 0, co_head: 1, member: 2 };

/**
 * What both circle pages (overview and settings) need: the signed-in user's
 * membership, the circle, its members (head first) and the modules it shares.
 * Non-members get the same 404 as a circle that doesn't exist.
 */
export async function loadCircleView(idParam: string) {
  const userId = await requireUserId();
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [circle, memberRows, sharedRows] = await Promise.all([
    db.query.circles.findFirst({ where: eq(circles.id, id) }),
    db.select().from(circleMembers).where(eq(circleMembers.circleId, id)).orderBy(asc(circleMembers.joinedAt)),
    db.select().from(circleModules).where(eq(circleModules.circleId, id)),
  ]);
  const me = memberRows.find((m) => m.userId === userId);
  if (!circle || !me || !isCircleRole(me.role)) notFound();

  const people = await getPeople(memberRows.map((m) => m.userId));
  const members = memberRows
    .flatMap((m) => (isCircleRole(m.role) ? [{ ...m, role: m.role }] : []))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return {
    userId,
    id,
    circle,
    members,
    people,
    shared: new Set(sharedRows.map((r) => r.module)),
    myRole: me.role,
    canManage: me.role === "head" || me.role === "co_head",
  };
}

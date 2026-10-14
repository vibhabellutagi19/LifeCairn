import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { circleMembers, circleModules, circles } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { InviteResponseButtons } from "@/components/CircleControls";
import { requireUserId } from "@/lib/auth";
import { getPendingInvites } from "@/lib/circleAccess";
import { ROLE_LABEL, SHAREABLE_MODULES, isCircleRole } from "@/lib/circleTypes";
import { MODULES } from "@/lib/modules";
import { createCircle } from "@/lib/actions/circles";

export const dynamic = "force-dynamic";

export default async function CirclesPage() {
  const userId = await requireUserId();

  const [mine, invites] = await Promise.all([
    db
      .select({ id: circles.id, name: circles.name, role: circleMembers.role })
      .from(circleMembers)
      .innerJoin(circles, eq(circleMembers.circleId, circles.id))
      .where(eq(circleMembers.userId, userId))
      .orderBy(circles.name),
    getPendingInvites(),
  ]);
  const ids = mine.map((c) => c.id);
  const [members, modules] = ids.length
    ? await Promise.all([
        db.select({ circleId: circleMembers.circleId }).from(circleMembers).where(inArray(circleMembers.circleId, ids)),
        db.select().from(circleModules).where(inArray(circleModules.circleId, ids)),
      ])
    : [[], []];

  const shareable = MODULES.filter((m) => SHAREABLE_MODULES.includes(m.key));

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Circles"
        subtitle="Small groups that share parts of LifeCairn, like habits with family or finance with a partner."
      />

      {invites.length > 0 ? (
        <Card className="mb-6 border-t-[8px] border-t-orange">
          <h2 className="mb-3 font-display text-xl font-bold">Invitations</h2>
          <ul className="space-y-3">
            {invites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  Join <span className="font-bold">{invite.circleName}</span> as {ROLE_LABEL[invite.role].toLowerCase()}
                </p>
                <InviteResponseButtons inviteId={invite.id} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {mine.length === 0 ? (
            <EmptyState>You&rsquo;re not in a circle yet. Create one to get started.</EmptyState>
          ) : (
            mine.map((circle) => {
              const shared = modules.filter((m) => m.circleId === circle.id);
              const count = members.filter((m) => m.circleId === circle.id).length;
              return (
                <Link key={circle.id} href={`/circles/${circle.id}`} className="block">
                  <Card className="brut-press hover:bg-background">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display text-xl font-bold">{circle.name}</p>
                      <Badge color={circle.role === "member" ? "muted" : "orange"}>
                        {ROLE_LABEL[isCircleRole(circle.role) ? circle.role : "member"]}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-muted">
                      {count} {count === 1 ? "person" : "people"}
                      {shared.length
                        ? ` · shares ${shared
                            .map((s) => MODULES.find((m) => m.key === s.module)?.label ?? s.module)
                            .join(", ")}`
                        : " · shares nothing yet"}
                    </p>
                  </Card>
                </Link>
              );
            })
          )}
        </div>

        <Card>
          <h2 className="mb-4 font-display text-xl font-bold">New circle</h2>
          <form action={createCircle} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Name</label>
              <Input name="name" placeholder="e.g. Family, Us" required maxLength={100} />
            </div>
            <fieldset>
              <legend className="mb-1 text-xs font-bold uppercase tracking-wide">Shares</legend>
              {shareable.map((m) => (
                <label key={m.key} className="flex min-h-11 items-center gap-2 text-sm font-bold sm:min-h-0 sm:py-1">
                  <input type="checkbox" name="modules" value={m.key} defaultChecked={m.key === "habits"} />
                  <span aria-hidden>{m.emoji}</span> {m.label}
                </label>
              ))}
              <p className="mt-1 text-xs font-semibold text-muted">You can change this later.</p>
            </fieldset>
            <Button type="submit" variant="primary" className="w-full">
              Create circle
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

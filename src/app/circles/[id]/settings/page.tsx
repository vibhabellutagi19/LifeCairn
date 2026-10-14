import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { circleInvites } from "@/db/schema";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { CircleTabs } from "@/components/CircleTabs";
import { FinanceShareSelect, ShareSelect } from "@/components/CircleHabits";
import { InviteForm, LeaveOrDeleteButton, MemberActions, RevokeInviteButton } from "@/components/CircleControls";
import { getMyFinanceLevel } from "@/lib/circleFinance";
import { getMyHabitSharing } from "@/lib/circleHabits";
import { loadCircleView } from "@/lib/circleView";
import { ROLE_LABEL, SHAREABLE_MODULES } from "@/lib/circleTypes";
import { MODULES } from "@/lib/modules";
import { updateCircle } from "@/lib/actions/circles";

export const dynamic = "force-dynamic";

export default async function CircleSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const { userId, id, circle, members, people, shared, myRole, canManage } = await loadCircleView(idParam);

  const [invites, myHabits, myFinanceLevel] = await Promise.all([
    canManage
      ? db.select().from(circleInvites).where(eq(circleInvites.circleId, id)).orderBy(circleInvites.createdAt)
      : Promise.resolve([]),
    shared.has("habits") ? getMyHabitSharing(id, userId) : Promise.resolve([]),
    shared.has("finance") ? getMyFinanceLevel(id, userId) : Promise.resolve(null),
  ]);
  const coHeadTaken = members.some((m) => m.role === "co_head") || invites.some((i) => i.role === "co_head");
  const shareable = MODULES.filter((m) => SHAREABLE_MODULES.includes(m.key));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/circles" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All circles
      </Link>
      <PageHeader
        title={circle.name}
        subtitle={`Settings · you are the ${ROLE_LABEL[myRole].toLowerCase()}`}
        action={<LeaveOrDeleteButton circleId={id} role={myRole} />}
      />
      <CircleTabs circleId={id} active="settings" />

      <div className="space-y-6">
        {shared.has("habits") || shared.has("finance") ? (
          <Card className="border-t-[8px] border-t-orange">
            <h2 className="mb-1 font-display text-xl font-bold">What you share</h2>
            <p className="mb-4 text-sm font-semibold text-muted">
              Nothing is shared until you choose, and only you can change your own choices.
            </p>

            {shared.has("habits") ? (
              <div className="mb-5">
                <h3 className="mb-1 font-bold">🔥 Habits</h3>
                <p className="mb-3 text-sm font-semibold text-muted">
                  &ldquo;Progress only&rdquo; shows today and your streak; &ldquo;Full detail&rdquo; adds the last 7
                  days and your monthly goal. Rewards are never shared.
                </p>
                {myHabits.length === 0 ? (
                  <p className="text-sm font-semibold text-muted">You have no active habits yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {myHabits.map((h) => (
                      <li key={h.id}>
                        <ShareSelect circleId={id} habitId={h.id} title={h.title} visibility={h.visibility} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {shared.has("finance") ? (
              <div className={shared.has("habits") ? "border-t-2 border-ink/10 pt-4" : ""}>
                <h3 className="mb-1 font-bold">💰 Finance</h3>
                <p className="mb-3 text-sm font-semibold text-muted">
                  Choose how much of your finance this circle sees. Individual entries and notes are never shared.
                </p>
                <FinanceShareSelect circleId={id} level={myFinanceLevel} />
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-3 font-display text-xl font-bold">People</h2>
          <ul className="space-y-3">
            {members.map((m) => {
              const person = people.get(m.userId);
              return (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold">
                      {person?.name ?? "Someone"}
                      {m.userId === userId ? <span className="text-muted"> (you)</span> : null}
                    </p>
                    {person?.email ? <p className="truncate text-xs font-semibold text-muted">{person.email}</p> : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color={m.role === "member" ? "muted" : "orange"}>{ROLE_LABEL[m.role]}</Badge>
                    <MemberActions
                      circleId={id}
                      targetUserId={m.userId}
                      targetRole={m.role}
                      myRole={myRole}
                      coHeadTaken={coHeadTaken}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        {canManage ? (
          <Card>
            <h2 className="mb-3 font-display text-xl font-bold">Invite someone</h2>
            <InviteForm circleId={id} canInviteCoHead={myRole === "head" && !coHeadTaken} />
            {invites.length > 0 ? (
              <div className="mt-4 border-t-2 border-ink/10 pt-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Waiting to accept</p>
                <ul className="space-y-2">
                  {invites.map((invite) => (
                    <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate font-semibold">
                        {invite.email}
                        {invite.role === "co_head" ? <span className="text-muted"> · co-head</span> : null}
                      </span>
                      <RevokeInviteButton inviteId={invite.id} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <h2 className="mb-1 font-display text-xl font-bold">Circle</h2>
          <p className="mb-3 text-sm font-semibold text-muted">
            Everything not listed here, including your journal and affirmations, stays private to you.
          </p>
          {canManage ? (
            <form action={updateCircle.bind(null, id)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Circle name</label>
                <Input name="name" defaultValue={circle.name} required maxLength={100} />
              </div>
              <fieldset>
                <legend className="mb-1 text-xs font-bold uppercase tracking-wide">What this circle shares</legend>
                {shareable.map((m) => (
                  <label key={m.key} className="flex min-h-11 items-center gap-2 text-sm font-bold sm:min-h-0 sm:py-1">
                    <input type="checkbox" name="modules" value={m.key} defaultChecked={shared.has(m.key)} />
                    <span aria-hidden>{m.emoji}</span> {m.label}
                  </label>
                ))}
              </fieldset>
              <Button type="submit" variant="green">
                Save
              </Button>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {shared.size === 0 ? (
                <p className="text-sm font-semibold text-muted">Nothing yet.</p>
              ) : (
                shareable
                  .filter((m) => shared.has(m.key))
                  .map((m) => (
                    <Badge key={m.key} color="green">
                      {m.emoji} {m.label}
                    </Badge>
                  ))
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { circleInvites, circleMembers, circleModules, circles } from "@/db/schema";
import { clsx } from "clsx";
import { Badge, Button, Card, Input, PageHeader } from "@/components/ui";
import { FinanceShareSelect, ReactionBar, ShareSelect } from "@/components/CircleHabits";
import {
  InviteForm,
  LeaveOrDeleteButton,
  MemberActions,
  RevokeInviteButton,
} from "@/components/CircleControls";
import { requireUserId } from "@/lib/auth";
import { getPeople } from "@/lib/circleAccess";
import { getCircleFinance, getMyFinanceLevel } from "@/lib/circleFinance";
import { getCircleHabits, getMyHabitSharing } from "@/lib/circleHabits";
import { ROLE_LABEL, SHAREABLE_MODULES, isCircleRole, type CircleRole } from "@/lib/circleTypes";
import { MODULES } from "@/lib/modules";
import { updateCircle } from "@/lib/actions/circles";
import { formatEUR, formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_ORDER: Record<CircleRole, number> = { head: 0, co_head: 1, member: 2 };

export default async function CircleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const [circle, memberRows] = await Promise.all([
    db.query.circles.findFirst({ where: eq(circles.id, id) }),
    db.select().from(circleMembers).where(eq(circleMembers.circleId, id)).orderBy(asc(circleMembers.joinedAt)),
  ]);
  // Non-members get the same 404 as a circle that doesn't exist.
  const me = memberRows.find((m) => m.userId === userId);
  if (!circle || !me || !isCircleRole(me.role)) notFound();
  const myRole = me.role;
  const canManage = myRole === "head" || myRole === "co_head";

  const [sharedRows, invites, people] = await Promise.all([
    db.select().from(circleModules).where(eq(circleModules.circleId, id)),
    canManage
      ? db.select().from(circleInvites).where(eq(circleInvites.circleId, id)).orderBy(circleInvites.createdAt)
      : Promise.resolve([]),
    getPeople(memberRows.map((m) => m.userId)),
  ]);
  const shared = new Set(sharedRows.map((r) => r.module));
  const [habitBoard, myHabits] = shared.has("habits")
    ? await Promise.all([getCircleHabits(id, userId), getMyHabitSharing(id, userId)])
    : [[], []];
  const members = memberRows
    .flatMap((m) => (isCircleRole(m.role) ? [{ ...m, role: m.role }] : []))
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const [financeBoard, myFinanceLevel] = shared.has("finance")
    ? await Promise.all([getCircleFinance(id, userId), getMyFinanceLevel(id, userId)])
    : [[], null];
  const coHeadTaken = members.some((m) => m.role === "co_head") || invites.some((i) => i.role === "co_head");
  const shareable = MODULES.filter((m) => SHAREABLE_MODULES.includes(m.key));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/circles" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All circles
      </Link>
      <PageHeader
        title={circle.name}
        subtitle={`You are the ${ROLE_LABEL[myRole].toLowerCase()} of this circle.`}
        action={<LeaveOrDeleteButton circleId={id} role={myRole} />}
      />

      <div className="space-y-6">
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

        {shared.has("habits") ? (
          <Card className="border-t-[8px] border-t-green">
            <h2 className="mb-3 font-display text-xl font-bold">🔥 Habits</h2>
            {habitBoard.length === 0 ? (
              <p className="text-sm font-semibold text-muted">
                Nobody has shared a habit yet. Choose yours below.
              </p>
            ) : (
              <div className="space-y-5">
                {habitBoard.map((group) => (
                  <section key={group.ownerId}>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                      {group.ownerId === userId ? "You" : (people.get(group.ownerId)?.name ?? "Someone")}
                    </p>
                    <ul className="space-y-3">
                      {group.habits.map((h) => (
                        <li key={h.id} className="brut-border space-y-2 rounded-md bg-surface p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className={clsx("font-bold", h.doneToday && "text-green")}>
                              <span aria-hidden className="mr-1.5">{h.doneToday ? "✓" : "○"}</span>
                              {h.title}
                            </p>
                            <Badge color={h.doneToday ? "green" : "muted"}>
                              {h.currentStreak > 0 ? `🔥 ${h.currentStreak} day${h.currentStreak === 1 ? "" : "s"}` : h.doneToday ? "Done today" : "Not yet"}
                            </Badge>
                          </div>
                          {h.last7 ? (
                            <div className="flex flex-wrap items-center gap-3">
                              <div className="flex gap-1" role="img" aria-label="Last 7 days">
                                {h.last7.map((d) => (
                                  <span
                                    key={d.date}
                                    title={d.date}
                                    className={clsx("brut-border h-4 w-4 rounded-sm", d.done ? "bg-green" : "bg-background")}
                                  />
                                ))}
                              </div>
                              {h.month ? (
                                <span className="text-xs font-semibold text-muted">
                                  This month: {h.month.done}
                                  {h.month.target ? `/${h.month.target}` : ""} days
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          <ReactionBar
                            circleId={id}
                            habitId={h.id}
                            reactions={h.reactions}
                            canReact={group.ownerId !== userId}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>
        ) : null}

        {shared.has("habits") ? (
          <Card>
            <h2 className="mb-1 font-display text-xl font-bold">Your habits in this circle</h2>
            <p className="mb-3 text-sm font-semibold text-muted">
              Nothing is shared until you choose. &ldquo;Progress only&rdquo; shows today and your streak; &ldquo;Full
              detail&rdquo; adds the last 7 days and your monthly goal. Rewards are never shared.
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
          </Card>
        ) : null}

        {shared.has("finance") ? (
          <Card className="border-t-[8px] border-t-blue">
            <h2 className="mb-1 font-display text-xl font-bold">💰 Finance</h2>
            <p className="mb-3 text-sm font-semibold text-muted">
              Everyone keeps their own accounts. You each choose how much to show here, and only you can change yours.
              Individual entries and notes are never shared.
            </p>
            {financeBoard.length === 0 ? (
              <p className="text-sm font-semibold text-muted">Nobody has shared their finance yet.</p>
            ) : (
              <div className="space-y-4">
                {financeBoard.map((f) => (
                  <section key={f.ownerId} className="brut-border rounded-md bg-surface p-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
                      {f.ownerId === userId ? "You" : (people.get(f.ownerId)?.name ?? "Someone")}
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Savings</p>
                        <p className="font-display text-xl font-bold">{formatINR(f.totalSavings)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Income this month</p>
                        <p className="font-display text-xl font-bold text-green">{formatEUR(f.monthIncome)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Spent this month</p>
                        <p className="font-display text-xl font-bold text-pink">{formatEUR(f.monthExpense)}</p>
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Net</p>
                        <p className={clsx("font-display text-xl font-bold", f.monthIncome - f.monthExpense < 0 && "text-pink")}>
                          {formatEUR(f.monthIncome - f.monthExpense)}
                        </p>
                      </div>
                    </div>
                    {f.accounts ? (
                      f.accounts.length > 0 ? (
                        <ul className="mt-3 space-y-1 border-t-2 border-ink/10 pt-3 text-sm">
                          {f.accounts.map((a, i) => (
                            <li key={`${a.name}-${i}`} className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-semibold">{a.name}</span>
                              <span className="shrink-0 font-bold">{formatINR(a.balance)}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm font-semibold text-muted">No accounts yet.</p>
                      )
                    ) : null}
                  </section>
                ))}
              </div>
            )}
            <div className="mt-4 border-t-2 border-ink/10 pt-3">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Your sharing in this circle</label>
              <FinanceShareSelect circleId={id} level={myFinanceLevel} />
            </div>
          </Card>
        ) : null}

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
          <h2 className="mb-1 font-display text-xl font-bold">What this circle shares</h2>
          <p className="mb-3 text-sm font-semibold text-muted">
            Everything else, including your journal and affirmations, stays private to you.
          </p>
          {canManage ? (
            <form action={updateCircle.bind(null, id)} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Circle name</label>
                <Input name="name" defaultValue={circle.name} required maxLength={100} />
              </div>
              <fieldset>
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

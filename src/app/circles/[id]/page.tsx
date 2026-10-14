import Link from "next/link";
import { clsx } from "clsx";
import { Badge, Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui";
import { CircleTabs } from "@/components/CircleTabs";
import { ReactionBar } from "@/components/CircleHabits";
import { getCircleFinance } from "@/lib/circleFinance";
import { getCircleHabits } from "@/lib/circleHabits";
import { loadCircleView } from "@/lib/circleView";
import { ROLE_LABEL } from "@/lib/circleTypes";
import { formatEUR, formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function CircleOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idParam } = await params;
  const { userId, id, circle, members, people, shared, myRole } = await loadCircleView(idParam);

  const [habitBoard, financeBoard] = await Promise.all([
    shared.has("habits") ? getCircleHabits(id, userId) : [],
    shared.has("finance") ? getCircleFinance(id, userId) : [],
  ]);
  const nameOf = (ownerId: string) => (ownerId === userId ? "You" : (people.get(ownerId)?.name ?? "Someone"));

  const allHabits = habitBoard.flatMap((g) => g.habits);
  const doneToday = allHabits.filter((h) => h.doneToday).length;
  let best: { streak: number; title: string; ownerId: string } | null = null;
  for (const group of habitBoard) {
    for (const h of group.habits) {
      if (h.currentStreak > (best?.streak ?? 0)) best = { streak: h.currentStreak, title: h.title, ownerId: group.ownerId };
    }
  }
  const habitOwners = new Set(habitBoard.map((g) => g.ownerId));
  const quietHabits = members.filter((m) => !habitOwners.has(m.userId));
  const iShareHabits = habitOwners.has(userId);
  const iShareFinance = financeBoard.some((f) => f.ownerId === userId);

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/circles" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All circles
      </Link>
      <PageHeader
        title={circle.name}
        subtitle={`${members.length} ${members.length === 1 ? "person" : "people"} · you are the ${ROLE_LABEL[myRole].toLowerCase()}`}
      />
      <CircleTabs circleId={id} active="overview" />

      {shared.size === 0 ? (
        <EmptyState>
          This circle isn&apos;t sharing anything yet.{" "}
          <Link href={`/circles/${id}/settings`} className="underline underline-offset-4">
            Open settings
          </Link>{" "}
          to choose what to share.
        </EmptyState>
      ) : null}

      <div className="space-y-6">
        {shared.has("habits") ? (
          <section aria-labelledby="habits-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="habits-heading" className="font-display text-2xl font-bold">
                🔥 Habits today
              </h2>
              {!iShareHabits ? (
                <Link href={`/circles/${id}/settings`} className="text-sm font-bold underline underline-offset-4">
                  Share your habits
                </Link>
              ) : null}
            </div>

            {allHabits.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Card className="!p-3 sm:!p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Done today</p>
                  <p className="font-display text-3xl font-bold">
                    {doneToday}
                    <span className="text-lg text-muted">/{allHabits.length}</span>
                  </p>
                </Card>
                <Card className="!p-3 sm:!p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted">People sharing</p>
                  <p className="font-display text-3xl font-bold">
                    {habitBoard.length}
                    <span className="text-lg text-muted">/{members.length}</span>
                  </p>
                </Card>
                {best ? (
                  <Card className="col-span-2 !p-3 sm:col-span-1 sm:!p-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Longest streak</p>
                    <p className="font-display text-3xl font-bold">🔥 {best.streak}</p>
                    <p className="truncate text-xs font-semibold text-muted">
                      {nameOf(best.ownerId)} · {best.title}
                    </p>
                  </Card>
                ) : null}
              </div>
            ) : null}

            {habitBoard.length === 0 ? (
              <EmptyState>
                Nobody has shared a habit yet.{" "}
                <Link href={`/circles/${id}/settings`} className="underline underline-offset-4">
                  Choose yours in settings.
                </Link>
              </EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {habitBoard.map((group) => {
                  const done = group.habits.filter((h) => h.doneToday).length;
                  const pct = Math.round((done / group.habits.length) * 100);
                  return (
                    <Card key={group.ownerId} className="space-y-3 border-t-[8px] border-t-green">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-display text-lg font-bold">{nameOf(group.ownerId)}</p>
                        <Badge color={done === group.habits.length ? "green" : "muted"}>
                          {done}/{group.habits.length} today
                        </Badge>
                      </div>
                      <ProgressBar value={pct} color="green" />
                      <ul className="space-y-2">
                        {group.habits.map((h) => (
                          <li key={h.id} className="brut-border space-y-2 rounded-md bg-background/60 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className={clsx("font-bold", h.doneToday && "text-green")}>
                                <span aria-hidden className="mr-1.5">{h.doneToday ? "✓" : "○"}</span>
                                {h.title}
                              </p>
                              <Badge color={h.doneToday ? "green" : "muted"}>
                                {h.currentStreak > 0
                                  ? `🔥 ${h.currentStreak} day${h.currentStreak === 1 ? "" : "s"}`
                                  : h.doneToday
                                    ? "Done today"
                                    : "Not yet"}
                              </Badge>
                            </div>
                            {h.last7 ? (
                              <div className="flex flex-wrap items-center gap-3">
                                <div className="flex gap-1" role="img" aria-label="Last 7 days">
                                  {h.last7.map((d) => (
                                    <span
                                      key={d.date}
                                      title={d.date}
                                      className={clsx("brut-border h-4 w-4 rounded-sm", d.done ? "bg-green" : "bg-surface")}
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
                    </Card>
                  );
                })}
              </div>
            )}

            {habitBoard.length > 0 && quietHabits.length > 0 ? (
              <p className="text-sm font-semibold text-muted">
                Not sharing habits yet: {quietHabits.map((m) => nameOf(m.userId)).join(", ")}.
              </p>
            ) : null}
          </section>
        ) : null}

        {shared.has("finance") ? (
          <section aria-labelledby="finance-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="finance-heading" className="font-display text-2xl font-bold">
                💰 Finance this month
              </h2>
              {!iShareFinance ? (
                <Link href={`/circles/${id}/settings`} className="text-sm font-bold underline underline-offset-4">
                  Share yours
                </Link>
              ) : null}
            </div>

            {financeBoard.length === 0 ? (
              <EmptyState>
                Nobody has shared their finance yet.{" "}
                <Link href={`/circles/${id}/settings`} className="underline underline-offset-4">
                  Choose yours in settings.
                </Link>
              </EmptyState>
            ) : (
              <Card className="border-t-[8px] border-t-blue !p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-sm">
                    <thead>
                      <tr className="border-b-2 border-ink/10 text-left text-[11px] font-bold uppercase tracking-wide text-muted">
                        <th scope="col" className="px-4 py-3">Person</th>
                        <th scope="col" className="px-4 py-3 text-right">Savings</th>
                        <th scope="col" className="px-4 py-3 text-right">Income</th>
                        <th scope="col" className="px-4 py-3 text-right">Spent</th>
                        <th scope="col" className="px-4 py-3 text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financeBoard.map((f) => {
                        const net = f.monthIncome - f.monthExpense;
                        return (
                          <tr key={f.ownerId} className="border-b border-ink/10 align-top">
                            <th scope="row" className="px-4 py-3 text-left font-bold">
                              {nameOf(f.ownerId)}
                              {f.accounts ? (
                                <details className="mt-1 font-normal">
                                  <summary className="cursor-pointer text-xs font-bold text-muted">
                                    {f.accounts.length} account{f.accounts.length === 1 ? "" : "s"}
                                  </summary>
                                  <ul className="mt-1 space-y-0.5 text-xs">
                                    {f.accounts.map((a, i) => (
                                      <li key={`${a.name}-${i}`} className="flex justify-between gap-3">
                                        <span className="truncate font-semibold">{a.name}</span>
                                        <span className="shrink-0 font-bold">{formatINR(a.balance)}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </details>
                              ) : null}
                            </th>
                            <td className="px-4 py-3 text-right font-bold">{formatINR(f.totalSavings)}</td>
                            <td className="px-4 py-3 text-right font-bold text-green">{formatEUR(f.monthIncome)}</td>
                            <td className="px-4 py-3 text-right font-bold text-pink">{formatEUR(f.monthExpense)}</td>
                            <td className={clsx("px-4 py-3 text-right font-bold", net < 0 && "text-pink")}>
                              {formatEUR(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {financeBoard.length > 1 ? (
                      <tfoot>
                        <tr className="bg-yellow/40 font-bold">
                          <th scope="row" className="px-4 py-3 text-left">Together</th>
                          <td className="px-4 py-3 text-right">
                            {formatINR(financeBoard.reduce((s, f) => s + f.totalSavings, 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-green">
                            {formatEUR(financeBoard.reduce((s, f) => s + f.monthIncome, 0))}
                          </td>
                          <td className="px-4 py-3 text-right text-pink">
                            {formatEUR(financeBoard.reduce((s, f) => s + f.monthExpense, 0))}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {formatEUR(financeBoard.reduce((s, f) => s + f.monthIncome - f.monthExpense, 0))}
                          </td>
                        </tr>
                      </tfoot>
                    ) : null}
                  </table>
                </div>
              </Card>
            )}
            <p className="text-xs font-semibold text-muted">
              Only what each person chose to share appears here. Individual entries and notes are never shared.
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

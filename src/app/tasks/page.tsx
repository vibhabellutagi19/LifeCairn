import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { roadmaps, tasks } from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader } from "@/components/ui";
import { NewTaskModal } from "@/components/NewTaskModal";
import { TaskRow } from "@/components/TaskRow";
import { shiftDateISO, todayISO } from "@/lib/dates";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const date = dateParam || todayISO();

  const [dayTasks, allRoadmaps] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        completed: tasks.completed,
        roadmapId: tasks.roadmapId,
        roadmapTitle: roadmaps.title,
      })
      .from(tasks)
      .leftJoin(roadmaps, eq(tasks.roadmapId, roadmaps.id))
      .where(eq(tasks.date, date))
      .orderBy(tasks.sortOrder, tasks.id),
    db.select().from(roadmaps).orderBy(roadmaps.sortOrder, roadmaps.id),
  ]);

  const completedCount = dayTasks.filter((t) => t.completed).length;
  const prev = shiftDateISO(date, -1);
  const next = shiftDateISO(date, 1);

  return (
    <div>
      <PageHeader
        title="Daily Tasks"
        subtitle="Plan your day, one task at a time."
        action={
          <NewTaskModal
            date={date}
            roadmaps={allRoadmaps.map((roadmap) => ({ id: roadmap.id, title: roadmap.title }))}
          />
        }
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <Link href={`/tasks?date=${prev}`}>
              <Button variant="ghost" size="sm" className="w-full">&larr; Prev</Button>
            </Link>
            <form action="/tasks" className="order-first col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
              <Input
                type="date"
                name="date"
                defaultValue={date}
                className="min-w-0 flex-1 font-bold sm:w-auto"
              />
              <Button type="submit" variant="ghost" size="sm">Go</Button>
            </form>
            <Link href={`/tasks?date=${next}`}>
              <Button variant="ghost" size="sm" className="w-full">Next &rarr;</Button>
            </Link>
            <Link href={`/tasks?date=${todayISO()}`}>
              <Button variant="yellow" size="sm" className="w-full">Today</Button>
            </Link>
          </div>
          <span className="text-sm font-bold text-muted">
            {completedCount}/{dayTasks.length} done
          </span>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 font-display text-xl font-bold">{formatDateLong(date)}</h2>
        <div className="space-y-2">
          {dayTasks.length === 0 ? (
            <EmptyState>Nothing planned for this day yet.</EmptyState>
          ) : (
            dayTasks.map((t) => (
              <TaskRow
                key={t.id}
                id={t.id}
                title={t.title}
                completed={t.completed}
                tag={t.roadmapTitle ?? undefined}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

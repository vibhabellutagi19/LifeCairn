import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases, roadmaps } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { requireUserId } from "@/lib/auth";
import { formatDateShort } from "@/lib/format";
import { currentMonthKey, monthRangeISO, todayISO, weekRangeISO } from "@/lib/dates";
import { isOpenTask } from "@/lib/taskStatus";

export const dynamic = "force-dynamic";

const RELEASE_STATUS_COLOR: Record<string, "muted" | "orange" | "green"> = {
  planned: "muted",
  in_progress: "orange",
  released: "green",
};

const TASK_STATUS_COLOR: Record<string, "muted" | "orange" | "pink" | "green"> = {
  not_started: "muted",
  in_progress: "orange",
  blocked: "pink",
  done: "green",
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireUserId();
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  });
  if (!project) notFound();

  const [projectReleases, tasks, goal] = await Promise.all([
    db
      .select()
      .from(releases)
      .where(eq(releases.projectId, id))
      .orderBy(releases.targetDate, releases.sortOrder, releases.id),
    db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, id))
      .orderBy(projectTasks.sortOrder, projectTasks.id),
    project.roadmapId
      ? db.query.roadmaps.findFirst({
          where: and(eq(roadmaps.id, project.roadmapId), eq(roadmaps.userId, userId)),
        })
      : Promise.resolve(undefined),
  ]);

  const shipped = projectReleases.filter((r) => r.status === "released").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const backlogCount = tasks.filter((t) => t.status === "backlog").length;
  const activeTasks = tasks.filter((t) => isOpenTask(t.status)).slice(0, 6);

  const today = todayISO();
  const week = weekRangeISO(today);
  const month = monthRangeISO(currentMonthKey());

  const inRange = (date: string | null, start: string, end: string) =>
    Boolean(date && date >= start && date <= end);

  const tasksDueThisWeek = tasks.filter(
    (t) => isOpenTask(t.status) && inRange(t.dueDate, week.start, week.end)
  ).length;
  const tasksDueThisMonth = tasks.filter(
    (t) => isOpenTask(t.status) && inRange(t.dueDate, month.start, month.end)
  ).length;
  const releasesThisWeek = projectReleases.filter(
    (r) => r.status !== "released" && inRange(r.targetDate, week.start, week.end)
  ).length;
  const releasesThisMonth = projectReleases.filter(
    (r) => r.status !== "released" && inRange(r.targetDate, month.start, month.end)
  ).length;

  return (
    <div>
      <Link href="/projects" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All projects
      </Link>
      <PageHeader
        title={project.name}
        subtitle={project.client ? `Client: ${project.client}` : undefined}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge color="orange">{project.status}</Badge>
            {goal ? (
              <Link href={`/roadmaps/${goal.id}`} className="inline-flex min-h-11 items-center sm:min-h-0">
                <Badge color="yellow">Goal: {goal.title}</Badge>
              </Link>
            ) : null}
            <DeleteProjectButton id={project.id} />
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Releases</p>
          <p className="font-display text-2xl font-bold">{projectReleases.length}</p>
          <p className="text-xs font-semibold text-muted">{shipped} shipped</p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Tasks</p>
          <p className="font-display text-2xl font-bold">{tasks.length}</p>
          <p className="text-xs font-semibold text-muted">
            {done} completed{backlogCount ? ` · ${backlogCount} in backlog` : ""}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Due this week</p>
          <p className="font-display text-2xl font-bold">{tasksDueThisWeek}</p>
          <p className="text-xs font-semibold text-muted">
            {releasesThisWeek > 0 ? `+ ${releasesThisWeek} release${releasesThisWeek > 1 ? "s" : ""}` : "tasks"}
          </p>
        </Card>
        <Card>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Due this month</p>
          <p className="font-display text-2xl font-bold">{tasksDueThisMonth}</p>
          <p className="text-xs font-semibold text-muted">
            {releasesThisMonth > 0
              ? `+ ${releasesThisMonth} release${releasesThisMonth > 1 ? "s" : ""}`
              : "tasks"}
          </p>
        </Card>
      </div>

      {(project.startDate || project.deadline || project.rateValue || project.notes) && (
        <Card className="mb-6">
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {project.startDate ? (
              <p><span className="font-bold">Start:</span> {formatDateShort(project.startDate)}</p>
            ) : null}
            {project.deadline ? (
              <p><span className="font-bold">Deadline:</span> {formatDateShort(project.deadline)}</p>
            ) : null}
            {project.rateValue ? (
              <p><span className="font-bold">Rate:</span> {project.rateValue}</p>
            ) : null}
          </div>
          {project.notes ? <p className="mt-3 text-sm text-ink/80">{project.notes}</p> : null}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Releases</h2>
            <span className="text-sm font-bold text-muted">
              {shipped}/{projectReleases.length} shipped
            </span>
          </div>
          {projectReleases.length === 0 ? (
            <EmptyState>No releases yet.</EmptyState>
          ) : (
            <div className="space-y-2">
              {projectReleases.slice(0, 6).map((r) => (
                <Link
                  key={r.id}
                  href={`/projects/${id}/releases/${r.id}`}
                  className="brut-border brut-press flex items-center justify-between gap-2 rounded-md bg-surface p-2.5 hover:bg-background"
                >
                  <span className="truncate font-bold">{r.name}</span>
                  <Badge color={RELEASE_STATUS_COLOR[r.status]}>{r.status.replace("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
          <Link
            href={`/projects/${id}/releases`}
            className="mt-4 inline-block text-sm font-bold underline underline-offset-4"
          >
            {projectReleases.length > 6 ? `View all ${projectReleases.length} releases` : "Manage releases"}{" "}
            &rarr;
          </Link>
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-bold">Tasks</h2>
            <span className="text-sm font-bold text-muted">
              {done}/{tasks.length - backlogCount} done
            </span>
          </div>
          {tasks.length === 0 ? (
            <EmptyState>No tasks yet.</EmptyState>
          ) : (
            <div className="space-y-2">
              {activeTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/projects/${id}/tasks/${t.branchName || t.id}`}
                  className="brut-border brut-press flex items-center justify-between gap-2 rounded-md bg-surface p-2.5 hover:bg-background"
                >
                  <span className="truncate font-bold">{t.title}</span>
                  <Badge color={TASK_STATUS_COLOR[t.status]}>{t.status.replace("_", " ")}</Badge>
                </Link>
              ))}
            </div>
          )}
          <Link
            href={`/projects/${id}/tasks`}
            className="mt-4 inline-block text-sm font-bold underline underline-offset-4"
          >
            {tasks.length > activeTasks.length ? `View all ${tasks.length} tasks` : "Manage tasks"} &rarr;
          </Link>
        </Card>
      </div>
    </div>
  );
}

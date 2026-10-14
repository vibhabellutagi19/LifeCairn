import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases } from "@/db/schema";
import { requireModule } from "@/lib/moduleSettings";
import { PageHeader } from "@/components/ui";
import { ProjectTaskRow } from "@/components/ProjectTaskRow";
import { MoveTaskForm } from "@/components/MoveTaskForm";
import { TaskDetailsForm } from "@/components/TaskDetailsForm";
import { parseTaskRef, taskRefFor } from "@/lib/taskRef";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskRef: string[] }>;
}) {
  const userId = await requireModule("projects");
  const { id: idParam, taskRef } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  });
  if (!project) notFound();

  // Branch names commonly contain slashes (feature/xyz), so the URL segment
  // is a catch-all — join it back into the full ref before resolving it.
  const ref = parseTaskRef(taskRef.join("/"));
  const task = await db.query.projectTasks.findFirst({
    where:
      "byId" in ref
        ? and(eq(projectTasks.projectId, id), eq(projectTasks.id, ref.byId))
        : and(eq(projectTasks.projectId, id), eq(projectTasks.branchName, ref.byBranch)),
  });
  if (!task) notFound();

  const projectReleases = await db
    .select()
    .from(releases)
    .where(eq(releases.projectId, id))
    .orderBy(releases.sortOrder, releases.id);

  const otherProjects = (
    await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.name)
  ).filter((p) => p.id !== id);

  const release = projectReleases.find((r) => r.id === task.releaseId);

  return (
    <div>
      <Link
        href={`/projects/${id}/tasks`}
        className="mb-4 inline-block text-sm font-bold underline underline-offset-4"
      >
        &larr; All tasks
      </Link>
      <PageHeader title={task.title} subtitle={project.name} />

      <div className="space-y-4">
        <ProjectTaskRow
          id={task.id}
          projectId={id}
          title={task.title}
          priority={task.priority}
          status={task.status}
          startDate={task.startDate}
          dueDate={task.dueDate}
          estHours={task.estHours}
          notes={task.notes}
          releaseId={task.releaseId}
          releaseName={release?.name ?? null}
          releases={projectReleases}
        />

        {release ? (
          <Link
            href={`/projects/${id}/releases/${release.id}`}
            className="inline-block text-sm font-bold underline underline-offset-4"
          >
            View release: {release.name} &rarr;
          </Link>
        ) : null}

        <TaskDetailsForm
          id={task.id}
          projectId={id}
          title={task.title}
          branchName={task.branchName}
          notes={task.notes}
          estHours={task.estHours}
        />

        {otherProjects.length > 0 ? (
          <MoveTaskForm
            id={task.id}
            projectId={id}
            taskRef={taskRefFor(task)}
            hasRelease={task.releaseId !== null}
            projects={otherProjects}
          />
        ) : null}
      </div>
    </div>
  );
}

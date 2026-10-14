import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases } from "@/db/schema";
import { requireModule } from "@/lib/moduleSettings";
import { PageHeader } from "@/components/ui";
import { NewProjectTaskModal } from "@/components/NewProjectTaskModal";
import { TaskSearchList } from "@/components/TaskSearchList";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const userId = await requireModule("projects");
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  });
  if (!project) notFound();

  const [tasks, projectReleases, allProjects] = await Promise.all([
    db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, id))
      .orderBy(projectTasks.sortOrder, projectTasks.id),
    db.select().from(releases).where(eq(releases.projectId, id)).orderBy(releases.sortOrder, releases.id),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(projects.name),
  ]);

  return (
    <div>
      <Link
        href={`/projects/${id}`}
        className="mb-4 inline-block text-sm font-bold underline underline-offset-4"
      >
        &larr; {project.name}
      </Link>
      <PageHeader
        title="Tasks"
        subtitle={project.name}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-muted">
              {tasks.filter((t) => t.status === "done").length}/{tasks.filter((t) => t.status !== "backlog").length} done
              {tasks.some((t) => t.status === "backlog") ? ` · ${tasks.filter((t) => t.status === "backlog").length} in backlog` : ""}
            </span>
            <NewProjectTaskModal
              projectId={id}
              projectName={project.name}
              releases={projectReleases.map((release) => ({ id: release.id, name: release.name }))}
            />
          </div>
        }
      />

      <TaskSearchList
        projectId={id}
        tasks={tasks}
        releases={projectReleases}
        moveTargets={allProjects.filter((p) => p.id !== id)}
      />
    </div>
  );
}

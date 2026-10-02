import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import { NewProjectTaskModal } from "@/components/NewProjectTaskModal";
import { TaskSearchList } from "@/components/TaskSearchList";

export const dynamic = "force-dynamic";

export default async function ProjectTasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) notFound();

  const [tasks, projectReleases] = await Promise.all([
    db
      .select()
      .from(projectTasks)
      .where(eq(projectTasks.projectId, id))
      .orderBy(projectTasks.sortOrder, projectTasks.id),
    db.select().from(releases).where(eq(releases.projectId, id)).orderBy(releases.sortOrder, releases.id),
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
              {tasks.filter((t) => t.status === "done").length}/{tasks.length} done
            </span>
            <NewProjectTaskModal
              projectId={id}
              projectName={project.name}
              releases={projectReleases.map((release) => ({ id: release.id, name: release.name }))}
            />
          </div>
        }
      />

      <TaskSearchList projectId={id} tasks={tasks} releases={projectReleases} />
    </div>
  );
}

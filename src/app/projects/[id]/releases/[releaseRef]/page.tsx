import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases } from "@/db/schema";
import { EmptyState, PageHeader } from "@/components/ui";
import { ReleaseRow } from "@/components/ReleaseRow";
import { ProjectTaskRow } from "@/components/ProjectTaskRow";
import { requireUserId } from "@/lib/auth";
import { taskRefFor } from "@/lib/taskRef";

export const dynamic = "force-dynamic";

export default async function ReleaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; releaseRef: string }>;
}) {
  const userId = await requireUserId();
  const { id: idParam, releaseRef } = await params;
  const id = Number(idParam);
  const releaseId = Number(releaseRef);
  if (Number.isNaN(id) || Number.isNaN(releaseId)) notFound();

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.userId, userId)),
  });
  if (!project) notFound();

  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, releaseId), eq(releases.userId, userId)),
  });
  if (!release || release.projectId !== id) notFound();

  const [tasks, projectReleases] = await Promise.all([
    db
      .select()
      .from(projectTasks)
      .where(and(eq(projectTasks.releaseId, releaseId), eq(projectTasks.userId, userId)))
      .orderBy(projectTasks.sortOrder, projectTasks.id),
    db.select().from(releases).where(eq(releases.projectId, id)).orderBy(releases.sortOrder, releases.id),
  ]);

  return (
    <div>
      <Link
        href={`/projects/${id}/releases`}
        className="mb-4 inline-block text-sm font-bold underline underline-offset-4"
      >
        &larr; All releases
      </Link>
      <PageHeader title={release.name} subtitle={project.name} />

      <div className="space-y-6">
        <ReleaseRow
          id={release.id}
          projectId={id}
          name={release.name}
          status={release.status}
          startDate={release.startDate}
          targetDate={release.targetDate}
          notes={release.notes}
          releaseNoteUrl={release.releaseNoteUrl}
        />

        <div>
          <h2 className="mb-3 font-display text-lg font-bold">
            Tasks in this release <span className="text-sm font-normal text-muted">({tasks.length})</span>
          </h2>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <EmptyState>No tasks tagged to this release yet.</EmptyState>
            ) : (
              tasks.map((t) => (
                <ProjectTaskRow
                  key={t.id}
                  id={t.id}
                  projectId={id}
                  title={t.title}
                  priority={t.priority}
                  status={t.status}
                  startDate={t.startDate}
                  dueDate={t.dueDate}
                  estHours={t.estHours}
                  notes={t.notes}
                  releaseId={t.releaseId}
                  releaseName={release.name}
                  releases={projectReleases}
                  detailHref={`/projects/${id}/tasks/${taskRefFor(t)}`}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

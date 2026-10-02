import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { projects, releases } from "@/db/schema";
import { Button, Card, EmptyState, Input, PageHeader, Textarea } from "@/components/ui";
import { createRelease } from "@/lib/actions/projects";
import { ReleaseRow } from "@/components/ReleaseRow";

export const dynamic = "force-dynamic";

export default async function ProjectReleasesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const project = await db.query.projects.findFirst({ where: eq(projects.id, id) });
  if (!project) notFound();

  const projectReleases = await db
    .select()
    .from(releases)
    .where(eq(releases.projectId, id))
    .orderBy(releases.targetDate, releases.sortOrder, releases.id);

  const shipped = projectReleases.filter((r) => r.status === "released").length;

  return (
    <div>
      <Link
        href={`/projects/${id}`}
        className="mb-4 inline-block text-sm font-bold underline underline-offset-4"
      >
        &larr; {project.name}
      </Link>
      <PageHeader
        title="Releases"
        subtitle={project.name}
        action={
          <span className="text-sm font-bold text-muted">
            {shipped}/{projectReleases.length} shipped
          </span>
        }
      />

      <Card className="mb-6">
        <form action={createRelease.bind(null, id)} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input name="name" placeholder="Release name (e.g. v1.3.0)" required className="sm:col-span-2" />
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
              Start date
            </label>
            <Input type="date" name="startDate" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
              Target date
            </label>
            <Input type="date" name="targetDate" />
          </div>
          <Input name="releaseNoteUrl" placeholder="Release notes URL" className="sm:col-span-2" />
          <Textarea name="notes" rows={2} placeholder="Notes" className="sm:col-span-2" />
          <Button type="submit" variant="primary" className="sm:col-span-2">
            Add Release
          </Button>
        </form>
      </Card>

      <div className="space-y-2">
        {projectReleases.length === 0 ? (
          <EmptyState>No releases yet.</EmptyState>
        ) : (
          projectReleases.map((r) => (
            <div key={r.id}>
              <Link
                href={`/projects/${id}/releases/${r.id}`}
                className="mb-1 inline-block text-[11px] font-bold text-muted hover:text-orange"
              >
                Open details &rarr;
              </Link>
              <ReleaseRow
                id={r.id}
                projectId={id}
                name={r.name}
                status={r.status}
                startDate={r.startDate}
                targetDate={r.targetDate}
                notes={r.notes}
                releaseNoteUrl={r.releaseNoteUrl}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

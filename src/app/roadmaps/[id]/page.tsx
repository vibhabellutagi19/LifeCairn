import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { milestones, roadmaps } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader, ProgressBar, Textarea } from "@/components/ui";
import { createMilestone, deleteRoadmap } from "@/lib/actions/roadmaps";
import { MilestoneRow } from "@/components/MilestoneRow";
import { DeleteRoadmapButton } from "@/components/DeleteRoadmapButton";

export const dynamic = "force-dynamic";

export default async function RoadmapDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (Number.isNaN(id)) notFound();

  const roadmap = await db.query.roadmaps.findFirst({ where: eq(roadmaps.id, id) });
  if (!roadmap) notFound();

  const ms = await db
    .select()
    .from(milestones)
    .where(eq(milestones.roadmapId, id))
    .orderBy(milestones.targetDate, milestones.sortOrder, milestones.id);

  const done = ms.filter((m) => m.status === "done").length;
  const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;

  return (
    <div>
      <Link href="/roadmaps" className="mb-4 inline-block text-sm font-bold underline underline-offset-4">
        &larr; All roadmaps
      </Link>
      <PageHeader
        title={roadmap.title}
        subtitle={roadmap.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge color="orange">{roadmap.category}</Badge>
            <DeleteRoadmapButton id={roadmap.id} action={deleteRoadmap} />
          </div>
        }
      />

      <Card className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm font-bold">
          <span>Overall progress</span>
          <span className="text-muted">
            {done}/{ms.length} milestones done
          </span>
        </div>
        <ProgressBar value={pct} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:order-2">
          <h2 className="mb-4 font-display text-xl font-bold">Add Milestone</h2>
          <form action={createMilestone.bind(null, id)} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Title</label>
              <Input name="title" placeholder="e.g. Week 1: Close first client" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Notes</label>
              <Textarea name="notes" rows={3} placeholder="Checkpoint details, tasks, context..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Target date</label>
              <Input type="date" name="targetDate" />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Add Milestone
            </Button>
          </form>
        </Card>

        <div className="space-y-3 lg:order-1 lg:col-span-2">
          {ms.length === 0 ? (
            <EmptyState>No milestones yet. Add your first checkpoint.</EmptyState>
          ) : (
            ms.map((m) => (
              <MilestoneRow
                key={m.id}
                id={m.id}
                roadmapId={id}
                title={m.title}
                notes={m.notes}
                status={m.status}
                targetDate={m.targetDate}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

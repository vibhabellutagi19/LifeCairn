import Link from "next/link";
import { db } from "@/db";
import { milestones, roadmaps } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader, ProgressBar, Select, Textarea } from "@/components/ui";
import { createRoadmap } from "@/lib/actions/roadmaps";

export const dynamic = "force-dynamic";

const COLOR_BADGE = {
  orange: "orange",
  pink: "pink",
  yellow: "yellow",
  green: "green",
} as const;

export default async function RoadmapsPage() {
  const [allRoadmaps, allMilestones] = await Promise.all([
    db.select().from(roadmaps).orderBy(roadmaps.sortOrder, roadmaps.id),
    db.select().from(milestones),
  ]);

  return (
    <div>
      <PageHeader
        title="Roadmaps"
        subtitle="Career, money, health, relationship — or add your own track."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:order-2">
          <h2 className="mb-4 font-display text-xl font-bold">New Roadmap</h2>
          <form action={createRoadmap} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Title</label>
              <Input name="title" placeholder="e.g. Career" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Category</label>
              <Input name="category" placeholder="e.g. Career, Money, Health..." />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Description</label>
              <Textarea name="description" rows={3} placeholder="What does this roadmap cover?" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Start</label>
                <Input type="date" name="startDate" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">End</label>
                <Input type="date" name="endDate" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Color</label>
              <Select name="color" defaultValue="orange">
                <option value="orange">Orange</option>
                <option value="pink">Pink</option>
                <option value="yellow">Yellow</option>
                <option value="green">Green</option>
              </Select>
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Create Roadmap
            </Button>
          </form>
        </Card>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          {allRoadmaps.length === 0 ? (
            <EmptyState>No roadmaps yet. Create your first one from the panel.</EmptyState>
          ) : (
            allRoadmaps.map((r) => {
              const ms = allMilestones.filter((m) => m.roadmapId === r.id);
              const done = ms.filter((m) => m.status === "done").length;
              const pct = ms.length ? Math.round((done / ms.length) * 100) : 0;
              return (
                <Link key={r.id} href={`/roadmaps/${r.id}`}>
                  <Card className="brut-press hover:bg-background">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-lg font-bold">{r.title}</h3>
                        <Badge color={COLOR_BADGE[r.color as keyof typeof COLOR_BADGE] ?? "yellow"}>
                          {r.category}
                        </Badge>
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wide text-muted">
                        {done}/{ms.length} milestones
                      </span>
                    </div>
                    {r.description ? (
                      <p className="mb-3 text-sm text-ink/80">{r.description}</p>
                    ) : null}
                    <ProgressBar value={pct} />
                  </Card>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

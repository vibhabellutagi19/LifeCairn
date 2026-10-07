import Link from "next/link";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { projectTasks, projects, releases, roadmaps } from "@/db/schema";
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createProject } from "@/lib/actions/projects";
import { FocusNextList } from "@/components/FocusNextList";
import { rankFocusTasks } from "@/lib/focusNext";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const [allProjects, allRoadmaps, allReleases, openTasks] = await Promise.all([
    db.select().from(projects).orderBy(projects.sortOrder, projects.id),
    db.select().from(roadmaps).orderBy(roadmaps.sortOrder, roadmaps.id),
    db.select().from(releases),
    db
      .select({
        id: projectTasks.id,
        title: projectTasks.title,
        branchName: projectTasks.branchName,
        priority: projectTasks.priority,
        status: projectTasks.status,
        startDate: projectTasks.startDate,
        dueDate: projectTasks.dueDate,
        projectId: projectTasks.projectId,
        projectName: projects.name,
      })
      .from(projectTasks)
      .innerJoin(projects, eq(projectTasks.projectId, projects.id))
      .where(
        and(ne(projectTasks.status, "done"), ne(projectTasks.status, "blocked"), ne(projectTasks.status, "backlog"))
      ),
  ]);

  const focusItems = rankFocusTasks(openTasks).slice(0, 8);
  const roadmapTitle = (id: number | null) =>
    allRoadmaps.find((r) => r.id === id)?.title ?? null;

  return (
    <div>
      <PageHeader title="Projects" subtitle="Client work: goal → project → release → task." />

      <Card className="mb-6">
        <h2 className="mb-3 font-display text-xl font-bold">Focus Next</h2>
        <p className="mb-4 text-sm font-medium text-muted">
          Auto-ranked across every project: continues what&apos;s in progress, then highest
          priority, then nearest due date.
        </p>
        <FocusNextList items={focusItems} />
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:order-2">
          <h2 className="mb-4 font-display text-xl font-bold">New Project</h2>
          <form action={createProject} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Name</label>
              <Input name="name" placeholder="e.g. Move - the gym app" required />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Client</label>
              <Input name="client" placeholder="Client name" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Goal (roadmap)</label>
              <Select name="roadmapId" defaultValue="">
                <option value="">No goal linked</option>
                {allRoadmaps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Status</label>
              <Select name="status" defaultValue="Active">
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Lead">Lead</option>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Start</label>
                <Input type="date" name="startDate" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Deadline</label>
                <Input type="date" name="deadline" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Rate / value</label>
              <Input name="rateValue" placeholder="e.g. $3,000 (fixed)" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide">Notes</label>
              <Textarea name="notes" rows={2} />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Create Project
            </Button>
          </form>
        </Card>

        <div className="space-y-4 lg:order-1 lg:col-span-2">
          {allProjects.length === 0 ? (
            <EmptyState>No projects yet. Add your first one from the panel.</EmptyState>
          ) : (
            allProjects.map((p) => {
              const projectReleases = allReleases.filter((r) => r.projectId === p.id);
              const released = projectReleases.filter((r) => r.status === "released").length;
              const goal = roadmapTitle(p.roadmapId);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <Card className="brut-press hover:bg-background">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-lg font-bold">{p.name}</h3>
                        <Badge color="orange">{p.status}</Badge>
                        {goal ? <Badge color="yellow">Goal: {goal}</Badge> : null}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wide text-muted">
                        {released}/{projectReleases.length} releases shipped
                      </span>
                    </div>
                    {p.client ? (
                      <p className="text-sm text-ink/80">Client: {p.client}</p>
                    ) : null}
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

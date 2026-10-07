"use client";

import { useMemo, useState } from "react";
import { EmptyState, Input } from "@/components/ui";
import { ProjectTaskRow } from "@/components/ProjectTaskRow";
import { Collapsible } from "@/components/Collapsible";
import { taskRefFor } from "@/lib/taskRef";
import type { ProjectTaskStatus } from "@/lib/taskStatus";

const STATUS_GROUPS = [
  { key: "in_progress", label: "In Progress", defaultOpen: true },
  { key: "not_started", label: "Not Started", defaultOpen: true },
  { key: "blocked", label: "Blocked", defaultOpen: false },
  { key: "done", label: "Done", defaultOpen: false },
  { key: "backlog", label: "📥 Backlog", defaultOpen: false },
] as const;

type Task = {
  id: number;
  title: string;
  branchName: string | null;
  priority: "low" | "medium" | "high";
  status: ProjectTaskStatus;
  startDate: string | null;
  dueDate: string | null;
  estHours: string | null;
  notes: string | null;
  releaseId: number | null;
};

export function TaskSearchList({
  projectId,
  tasks,
  releases,
}: {
  projectId: number;
  tasks: Task[];
  releases: { id: number; name: string }[];
}) {
  const [query, setQuery] = useState("");

  const releaseName = (releaseId: number | null) =>
    releases.find((r) => r.id === releaseId)?.name ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tasks;
    return tasks.filter((t) =>
      [t.title, t.branchName, t.notes, releases.find((r) => r.id === t.releaseId)?.name]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
    );
  }, [tasks, releases, query]);

  const searching = query.trim().length > 0;

  return (
    <div>
      <div className="relative mb-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tasks by title, branch, notes, or release..."
          className="pl-9"
        />
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          🔍
        </span>
      </div>

      {tasks.length === 0 ? (
        <EmptyState>No tasks yet.</EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState>No tasks match &ldquo;{query}&rdquo;.</EmptyState>
      ) : (
        <div className="space-y-2">
          {STATUS_GROUPS.map(({ key, label, defaultOpen }) => {
            const group = filtered.filter((t) => t.status === key);
            if (group.length === 0) return null;
            return (
              <Collapsible
                key={`${key}-${searching}`}
                title={label}
                count={group.length}
                defaultOpen={searching || defaultOpen}
              >
                {group.map((t) => (
                  <ProjectTaskRow
                    key={t.id}
                    id={t.id}
                    projectId={projectId}
                    title={t.title}
                    priority={t.priority}
                    status={t.status}
                    startDate={t.startDate}
                    dueDate={t.dueDate}
                    estHours={t.estHours}
                    notes={t.notes}
                    releaseId={t.releaseId}
                    releaseName={releaseName(t.releaseId)}
                    releases={releases}
                    detailHref={`/projects/${projectId}/tasks/${taskRefFor(t)}`}
                  />
                ))}
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

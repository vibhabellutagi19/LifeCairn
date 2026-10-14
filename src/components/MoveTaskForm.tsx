"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveProjectTask } from "@/lib/actions/projects";
import { Button, Card, Select } from "@/components/ui";

export function MoveTaskForm({
  id,
  projectId,
  taskRef,
  hasRelease,
  projects,
}: {
  id: number;
  projectId: number;
  taskRef: string;
  hasRelease: boolean;
  projects: { id: number; name: string }[];
}) {
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  const router = useRouter();

  return (
    <Card>
      <h2 className="mb-3 font-display text-lg font-bold">Move to another project</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={target} onChange={(e) => setTarget(e.target.value)} disabled={isPending}>
          <option value="">Choose a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Button
          type="button"
          variant="primary"
          disabled={!target || isPending}
          onClick={() =>
            startTransition(async () => {
              const toId = Number(target);
              await moveProjectTask(id, projectId, toId);
              router.push(`/projects/${toId}/tasks/${taskRef}`);
            })
          }
        >
          {isPending ? "Moving..." : "Move"}
        </Button>
      </div>
      {hasRelease ? (
        <p className="mt-2 text-xs font-semibold text-muted">
          The task&apos;s release link will be cleared, since releases belong to a project.
        </p>
      ) : null}
    </Card>
  );
}

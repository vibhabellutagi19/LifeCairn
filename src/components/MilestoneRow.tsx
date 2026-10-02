"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { cycleMilestoneStatus, deleteMilestone } from "@/lib/actions/roadmaps";
import { Badge } from "@/components/ui";
import { formatDateShort } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_COLOR: Record<string, "muted" | "orange" | "green"> = {
  not_started: "muted",
  in_progress: "orange",
  done: "green",
};

export function MilestoneRow({
  id,
  roadmapId,
  title,
  notes,
  status,
  targetDate,
}: {
  id: number;
  roadmapId: number;
  title: string;
  notes: string | null;
  status: "not_started" | "in_progress" | "done";
  targetDate: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className={clsx("brut-border rounded-md bg-surface p-4", status === "done" && "bg-green/10")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className={clsx("font-bold", status === "done" && "text-muted line-through")}>{title}</p>
          {notes ? <p className="mt-1 text-sm text-ink/80">{notes}</p> : null}
          {targetDate ? (
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted">
              Target: {formatDateShort(targetDate)}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                cycleMilestoneStatus(id, roadmapId, status);
              })
            }
          >
            <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
          </button>
          <button
            type="button"
            aria-label="Delete milestone"
            className="text-muted hover:text-pink"
            onClick={() =>
              startTransition(() => {
                deleteMilestone(id, roadmapId);
              })
            }
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

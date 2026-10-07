"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  deleteProjectTask,
  setProjectTaskDates,
  setProjectTaskPriority,
  setProjectTaskRelease,
  setProjectTaskStatus,
} from "@/lib/actions/projects";
import { Button, Input } from "@/components/ui";
import { formatDateShort } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { isOpenTask, type ProjectTaskStatus } from "@/lib/taskStatus";

const STATUS_SELECT_COLOR: Record<string, string> = {
  not_started: "bg-background text-muted",
  in_progress: "bg-orange text-white",
  blocked: "bg-pink text-white",
  done: "bg-green text-white",
  backlog: "bg-ink/10 text-ink/60",
};

const PRIORITY_COLOR: Record<string, "muted" | "orange" | "pink"> = {
  low: "muted",
  medium: "orange",
  high: "pink",
};

export function ProjectTaskRow({
  id,
  projectId,
  title,
  priority,
  status,
  startDate,
  dueDate,
  estHours,
  notes,
  releaseId,
  releaseName,
  releases,
  projectName,
  detailHref,
  focusHref,
}: {
  id: number;
  projectId: number;
  title: string;
  priority: "low" | "medium" | "high";
  status: ProjectTaskStatus;
  startDate?: string | null;
  dueDate: string | null;
  estHours: string | null;
  notes: string | null;
  releaseId?: number | null;
  releaseName?: string | null;
  releases?: { id: number; name: string }[];
  projectName?: string | null;
  detailHref?: string;
  /** When set, shows a "🍅 Focus" link that opens the Pomodoro on this task. */
  focusHref?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingDates, setEditingDates] = useState(false);
  const overdue = Boolean(dueDate && isOpenTask(status) && dueDate < todayISO());
  const [startVal, setStartVal] = useState(startDate ?? "");
  const [dueVal, setDueVal] = useState(dueDate ?? "");

  return (
    <div className={clsx("brut-border rounded-md bg-surface p-3", status === "done" && "bg-green/10", status === "backlog" && "border-dashed bg-background opacity-80")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {detailHref ? (
          <Link
            href={detailHref}
            className={clsx(
              "min-w-0 basis-full font-bold hover:underline sm:flex-1 sm:basis-auto",
              status === "done" && "text-muted line-through"
            )}
          >
            {title}
          </Link>
        ) : (
          <p className={clsx("min-w-0 basis-full font-bold sm:flex-1 sm:basis-auto", status === "done" && "text-muted line-through")}>
            {title}
          </p>
        )}
        <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-center gap-2 sm:flex sm:w-auto sm:shrink-0">
          <select
            suppressHydrationWarning
            disabled={isPending}
            value={priority}
            onChange={(e) =>
              startTransition(() => {
                setProjectTaskPriority(id, projectId, e.target.value as "low" | "medium" | "high");
              })
            }
            className="brut-border min-h-11 min-w-0 flex-1 rounded-md bg-surface px-2 py-1 text-xs font-bold uppercase w-full sm:w-auto sm:min-h-0 sm:flex-none sm:px-1 sm:py-0.5 sm:text-[11px]"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select
            suppressHydrationWarning
            disabled={isPending}
            value={status}
            aria-label="Task status"
            onChange={(event) =>
              startTransition(() => {
                setProjectTaskStatus(
                  id,
                  projectId,
                  event.target.value as ProjectTaskStatus
                );
              })
            }
            className={clsx(
              "brut-border min-h-11 w-full min-w-0 flex-1 rounded-md px-2 py-1 text-xs font-bold uppercase sm:w-auto sm:min-h-0 sm:flex-none sm:px-1 sm:py-0.5 sm:text-[11px]",
              STATUS_SELECT_COLOR[status]
            )}
          >
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Done</option>
            <option value="backlog">📥 Backlog</option>
          </select>
          <button
            type="button"
            aria-label="Delete task"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-pink sm:h-auto sm:w-auto"
            onClick={() =>
              startTransition(() => {
                deleteProjectTask(id, projectId);
              })
            }
          >
            ✕
          </button>
        </div>
      </div>

      {notes ? <p className="mt-1 text-sm text-ink/80">{notes}</p> : null}

      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
        {status === "backlog" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                setProjectTaskStatus(id, projectId, "not_started");
              })
            }
            className="focus-pill"
            title="Move out of the backlog, back to Not started"
          >
            ↩ Bring back
          </button>
        ) : null}
        {focusHref && isOpenTask(status) ? (
          <Link href={focusHref} className="focus-pill" title="Start a pomodoro on this task">
            <span aria-hidden>🍅</span> Focus
          </Link>
        ) : null}
        {projectName ? <span>{projectName}</span> : null}
        {releases ? (
          <select
            suppressHydrationWarning
            disabled={isPending}
            value={releaseId ?? ""}
            onChange={(e) =>
              startTransition(() => {
                setProjectTaskRelease(id, projectId, e.target.value ? Number(e.target.value) : null);
              })
            }
            className="brut-border min-h-11 max-w-full rounded bg-surface px-2 py-1 text-xs font-bold uppercase normal-case sm:min-h-0 sm:px-1 sm:py-0.5 sm:text-[11px]"
          >
            <option value="">No release</option>
            {releases.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : releaseName ? (
          <span>{releaseName}</span>
        ) : null}
        {estHours ? <span>{estHours}h est.</span> : null}
      </div>

      {editingDates ? (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end">
          <div className="min-w-0">
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted">
              Start
            </label>
            <Input
              type="date"
              value={startVal}
              onChange={(e) => setStartVal(e.target.value)}
              className="w-full py-1 text-base sm:w-auto sm:text-xs"
            />
          </div>
          <div className="min-w-0">
            <label className="mb-0.5 block text-[10px] font-bold uppercase tracking-wide text-muted">
              End
            </label>
            <Input
              type="date"
              value={dueVal}
              onChange={(e) => setDueVal(e.target.value)}
              className="w-full py-1 text-base sm:w-auto sm:text-xs"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="green"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await setProjectTaskDates(id, projectId, startVal || null, dueVal || null);
                setEditingDates(false);
              })
            }
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setStartVal(startDate ?? "");
              setDueVal(dueDate ?? "");
              setEditingDates(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingDates(true)}
          className="mt-1 min-h-11 text-left text-xs font-bold uppercase tracking-wide text-muted underline decoration-dashed underline-offset-2 hover:text-orange sm:min-h-0"
        >
          {startDate && dueDate
            ? `${formatDateShort(startDate)} → ${formatDateShort(dueDate)}`
            : startDate
              ? `Starts ${formatDateShort(startDate)} (no end date)`
              : dueDate
                ? `Due ${formatDateShort(dueDate)} (no start date)`
                : "Set start / end date"}
          {overdue ? (
            <span className="overdue-badge ml-2" suppressHydrationWarning>
              ⚠ Overdue
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}

export { PRIORITY_COLOR };

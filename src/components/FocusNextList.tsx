"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge, Button, EmptyState, Input } from "@/components/ui";
import { setProjectTaskDates } from "@/lib/actions/projects";
import { formatDateShort } from "@/lib/format";

const PRIORITY_COLOR: Record<string, "muted" | "orange" | "pink"> = {
  low: "muted",
  medium: "orange",
  high: "pink",
};

type FocusItem = {
  id: number;
  title: string;
  branchName?: string | null;
  priority: "low" | "medium" | "high";
  status: "not_started" | "in_progress" | "blocked" | "done";
  startDate?: string | null;
  dueDate: string | null;
  projectId: number;
  projectName: string;
};

export function FocusNextList({ items }: { items: FocusItem[] }) {
  if (items.length === 0) {
    return <EmptyState>Nothing to work on next &mdash; add tasks to a project.</EmptyState>;
  }

  return (
    <div className="space-y-2">
      {items.map((t, i) => (
        <FocusRow key={t.id} item={t} index={i} />
      ))}
    </div>
  );
}

function FocusRow({ item: t, index: i }: { item: FocusItem; index: number }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [startVal, setStartVal] = useState(t.startDate ?? "");
  const [dueVal, setDueVal] = useState(t.dueDate ?? "");

  return (
    <div className="brut-border rounded-md bg-surface p-3">
      <div className="flex flex-wrap items-start gap-3 sm:flex-nowrap sm:items-center">
        <span className="font-display w-6 shrink-0 text-lg font-bold text-muted">{i + 1}</span>
        <Link
          href={`/projects/${t.projectId}/tasks/${t.branchName || t.id}`}
          className="min-w-0 flex-1 hover:underline"
        >
          <p className="truncate font-bold">{t.title}</p>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{t.projectName}</p>
        </Link>
        <div className="ml-9 flex w-[calc(100%-2.25rem)] flex-wrap items-center gap-2 sm:ml-0 sm:w-auto sm:shrink-0">
          {t.status === "in_progress" ? <Badge color="orange">In progress</Badge> : null}
          <Badge color={PRIORITY_COLOR[t.priority]}>{t.priority}</Badge>
        </div>
      </div>

      {editing ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-end sm:pl-9">
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
                await setProjectTaskDates(t.id, t.projectId, startVal || null, dueVal || null);
                setEditing(false);
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
              setStartVal(t.startDate ?? "");
              setDueVal(t.dueDate ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-1 min-h-11 pl-9 text-left text-xs font-bold uppercase tracking-wide text-muted underline decoration-dashed underline-offset-2 hover:text-orange"
        >
          {t.startDate && t.dueDate
            ? `${formatDateShort(t.startDate)} → ${formatDateShort(t.dueDate)}`
            : t.startDate
              ? `Starts ${formatDateShort(t.startDate)} (no end date)`
              : t.dueDate
                ? `Due ${formatDateShort(t.dueDate)} (no start date)`
                : "Set start / end date"}
        </button>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { cycleReleaseStatus, deleteRelease, updateRelease } from "@/lib/actions/projects";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import { formatDateShort } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  planned: "Planned",
  in_progress: "In progress",
  released: "Released",
};

const STATUS_COLOR: Record<string, "muted" | "orange" | "green"> = {
  planned: "muted",
  in_progress: "orange",
  released: "green",
};

export function ReleaseRow({
  id,
  projectId,
  name,
  status,
  startDate,
  targetDate,
  notes,
  releaseNoteUrl,
}: {
  id: number;
  projectId: number;
  name: string;
  status: "planned" | "in_progress" | "released";
  startDate?: string | null;
  targetDate: string | null;
  notes: string | null;
  releaseNoteUrl: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(name);
  const [startVal, setStartVal] = useState(startDate ?? "");
  const [targetVal, setTargetVal] = useState(targetDate ?? "");
  const [urlVal, setUrlVal] = useState(releaseNoteUrl ?? "");
  const [notesVal, setNotesVal] = useState(notes ?? "");

  const resetValues = () => {
    setNameVal(name);
    setStartVal(startDate ?? "");
    setTargetVal(targetDate ?? "");
    setUrlVal(releaseNoteUrl ?? "");
    setNotesVal(notes ?? "");
  };

  const openEditor = () => {
    resetValues();
    setEditing(true);
  };

  const resetAndClose = () => {
    resetValues();
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="brut-border rounded-md bg-surface p-4">
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await updateRelease(id, projectId, {
                name: nameVal,
                startDate: startVal || null,
                targetDate: targetVal || null,
                notes: notesVal || null,
                releaseNoteUrl: urlVal || null,
              });
              setEditing(false);
            });
          }}
        >
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
              Release name
            </label>
            <Input
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              placeholder="Release name"
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Start date
              </label>
              <Input type="date" value={startVal} onChange={(e) => setStartVal(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
                Target date
              </label>
              <Input type="date" value={targetVal} onChange={(e) => setTargetVal(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
              Release note URL
            </label>
            <Input
              value={urlVal}
              onChange={(e) => setUrlVal(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">
              Release notes
            </label>
            <Textarea
              value={notesVal}
              onChange={(e) => setNotesVal(e.target.value)}
              rows={3}
              placeholder="What changed in this release?"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              size="sm"
              variant="green"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save release"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={resetAndClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className={clsx("brut-border rounded-md bg-surface p-4", status === "released" && "bg-green/10")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={openEditor}
            className="text-left font-bold hover:underline"
            title="Edit release"
          >
            {name}
          </button>
          {notes ? <p className="mt-1 text-sm text-ink/80">{notes}</p> : null}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
            {startDate && targetDate ? (
              <span>{formatDateShort(startDate)} &rarr; {formatDateShort(targetDate)}</span>
            ) : startDate ? (
              <span>Starts {formatDateShort(startDate)}</span>
            ) : targetDate ? (
              <span>Target: {formatDateShort(targetDate)}</span>
            ) : null}
            {releaseNoteUrl ? (
              <a href={releaseNoteUrl} target="_blank" rel="noreferrer" className="underline">
                Release notes ↗
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
          <Button type="button" size="sm" variant="ghost" onClick={openEditor}>
            Edit release
          </Button>
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => {
                cycleReleaseStatus(id, projectId, status);
              })
            }
          >
            <Badge color={STATUS_COLOR[status]}>{STATUS_LABEL[status]}</Badge>
          </button>
          <button
            type="button"
            aria-label="Delete release"
            className="ml-auto flex h-10 w-10 items-center justify-center text-muted hover:text-pink sm:ml-0 sm:h-auto sm:w-auto"
            onClick={() =>
              startTransition(() => {
                deleteRelease(id, projectId);
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

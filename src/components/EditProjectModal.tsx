"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { updateProject } from "@/lib/actions/projects";

const STATUSES = ["Active", "On Hold", "Completed", "Lead"];

type EditableProject = {
  id: number;
  name: string;
  client: string | null;
  status: string;
  roadmapId: number | null;
  startDate: string | null;
  deadline: string | null;
  rateValue: string | null;
  notes: string | null;
};

export function EditProjectModal({
  project,
  roadmaps,
}: {
  project: EditableProject;
  roadmaps: { id: number; title: string }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const statuses = STATUSES.includes(project.status) ? STATUSES : [...STATUSES, project.status];
  const close = () => dialogRef.current?.close();
  const labelClass = "mb-1 block text-xs font-bold uppercase tracking-wide";

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => dialogRef.current?.showModal()}>
        Edit
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,36rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isPending) close();
        }}
      >
        <div className="brut-border brut-shadow rounded-lg bg-surface p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-2xl font-bold">Edit project</h2>
            <button
              type="button"
              aria-label="Close edit project modal"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <form
            key={JSON.stringify(project)}
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                await updateProject(project.id, formData);
                close();
              });
            }}
          >
            <div>
              <label className={labelClass} htmlFor={`${titleId}-name`}>Name</label>
              <Input id={`${titleId}-name`} name="name" defaultValue={project.name} required />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${titleId}-client`}>Client</label>
              <Input id={`${titleId}-client`} name="client" defaultValue={project.client ?? ""} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`${titleId}-status`}>Status</label>
                <Select id={`${titleId}-status`} name="status" defaultValue={project.status}>
                  {statuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className={labelClass} htmlFor={`${titleId}-goal`}>Goal (roadmap)</label>
                <Select id={`${titleId}-goal`} name="roadmapId" defaultValue={project.roadmapId ?? ""}>
                  <option value="">No goal linked</option>
                  {roadmaps.map((r) => (
                    <option key={r.id} value={r.id}>{r.title}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor={`${titleId}-start`}>Start</label>
                <Input id={`${titleId}-start`} type="date" name="startDate" defaultValue={project.startDate ?? ""} />
              </div>
              <div>
                <label className={labelClass} htmlFor={`${titleId}-deadline`}>Deadline</label>
                <Input id={`${titleId}-deadline`} type="date" name="deadline" defaultValue={project.deadline ?? ""} />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${titleId}-rate`}>Rate / value</label>
              <Input id={`${titleId}-rate`} name="rateValue" defaultValue={project.rateValue ?? ""} />
            </div>
            <div>
              <label className={labelClass} htmlFor={`${titleId}-notes`}>Notes</label>
              <Textarea id={`${titleId}-notes`} name="notes" rows={3} defaultValue={project.notes ?? ""} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="green" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

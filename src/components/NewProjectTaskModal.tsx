"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Select, Textarea } from "@/components/ui";
import { createProjectTask } from "@/lib/actions/projects";

export function NewProjectTaskModal({
  projectId,
  projectName,
  releases,
}: {
  projectId: number;
  projectName: string;
  releases: { id: number; name: string }[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button type="button" variant="primary" onClick={() => dialogRef.current?.showModal()}>
        + New task
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,42rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isPending) close();
        }}
      >
        <div className="brut-border brut-shadow rounded-lg bg-surface p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-bold">
                New task
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">{projectName}</p>
            </div>
            <button
              type="button"
              aria-label="Close new project task modal"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <form
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              startTransition(async () => {
                await createProjectTask(projectId, formData);
                form.reset();
                close();
              });
            }}
          >
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-task`}>
                Task title
              </label>
              <Input
                id={`${titleId}-task`}
                name="title"
                placeholder="What needs to be done?"
                autoFocus
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-branch`}>
                Feature branch
              </label>
              <Input
                id={`${titleId}-branch`}
                name="branchName"
                placeholder="Optional branch name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-priority`}>
                Priority
              </label>
              <Select id={`${titleId}-priority`} name="priority" defaultValue="medium">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-release`}>
                Release
              </label>
              <Select id={`${titleId}-release`} name="releaseId" defaultValue="">
                <option value="">No release</option>
                {releases.map((release) => (
                  <option key={release.id} value={release.id}>
                    {release.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-start`}>
                Start date
              </label>
              <Input id={`${titleId}-start`} type="date" name="startDate" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-due`}>
                Due date
              </label>
              <Input id={`${titleId}-due`} type="date" name="dueDate" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-hours`}>
                Estimated hours
              </label>
              <Input
                id={`${titleId}-hours`}
                name="estHours"
                placeholder="e.g. 4"
                inputMode="decimal"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-notes`}>
                Notes / next action
              </label>
              <Textarea id={`${titleId}-notes`} name="notes" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:col-span-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="green" disabled={isPending}>
                {isPending ? "Creating..." : "Create task"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

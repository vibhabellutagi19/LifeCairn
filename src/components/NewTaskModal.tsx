"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createTask } from "@/lib/actions/tasks";
import { formatDateLong } from "@/lib/format";

export function NewTaskModal({
  date,
  roadmaps,
}: {
  date: string;
  roadmaps: { id: number; title: string }[];
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
        className="m-auto w-[min(92vw,32rem)] rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
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
              <p className="mt-1 text-sm font-semibold text-muted">{formatDateLong(date)}</p>
            </div>
            <button
              type="button"
              aria-label="Close new task modal"
              disabled={isPending}
              className="text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              startTransition(async () => {
                await createTask(date, formData);
                form.reset();
                close();
              });
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-task`}>
                Task
              </label>
              <Input
                id={`${titleId}-task`}
                name="title"
                placeholder="What are you planning to do?"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-roadmap`}>
                Roadmap
              </label>
              <Select id={`${titleId}-roadmap`} name="roadmapId" defaultValue="">
                <option value="">No roadmap</option>
                {roadmaps.map((roadmap) => (
                  <option key={roadmap.id} value={roadmap.id}>
                    {roadmap.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
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

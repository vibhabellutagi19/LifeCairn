"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { createAffirmation } from "@/lib/actions/affirmations";
import {
  AFFIRMATION_CATEGORIES,
  AFFIRMATION_SUBCATEGORIES,
} from "@/lib/affirmationSubcategories";

export function NewAffirmationModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button type="button" variant="primary" onClick={() => dialogRef.current?.showModal()}>
        + New affirmation
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
            <div>
              <h2 id={titleId} className="font-display text-2xl font-bold">New affirmation</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Write a clear statement you want to repeat and reinforce.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close new affirmation modal"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
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
                await createAffirmation(formData);
                form.reset();
                close();
              });
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-text`}>
                Affirmation
              </label>
              <Textarea
                id={`${titleId}-text`}
                name="text"
                rows={4}
                placeholder="I am..."
                className="text-base leading-relaxed"
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-category`}>
                  Category
                </label>
                <Select id={`${titleId}-category`} name="category" defaultValue="General">
                  {AFFIRMATION_CATEGORIES.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-subcategory`}>
                  Subcategory <span className="normal-case text-muted">(optional)</span>
                </label>
                <Select id={`${titleId}-subcategory`} name="subcategory" defaultValue="">
                  <option value="">No subcategory</option>
                  {AFFIRMATION_SUBCATEGORIES.map((subcategory) => (
                    <option key={subcategory} value={subcategory}>{subcategory}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="green" disabled={isPending}>
                {isPending ? "Adding..." : "Add affirmation"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

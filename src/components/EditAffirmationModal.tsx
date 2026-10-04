"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Select, Textarea } from "@/components/ui";
import { updateAffirmation } from "@/lib/actions/affirmations";
import {
  AFFIRMATION_CATEGORIES,
  AFFIRMATION_SUBCATEGORIES,
} from "@/lib/affirmationSubcategories";

export function EditAffirmationModal({
  id,
  text,
  category,
  subcategory,
}: {
  id: number;
  text: string;
  category: string;
  subcategory: string | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const categories = AFFIRMATION_CATEGORIES.includes(
    category as (typeof AFFIRMATION_CATEGORIES)[number]
  )
    ? AFFIRMATION_CATEGORIES
    : [...AFFIRMATION_CATEGORIES, category];
  const subcategories = subcategory && !AFFIRMATION_SUBCATEGORIES.includes(
    subcategory as (typeof AFFIRMATION_SUBCATEGORIES)[number]
  )
    ? [...AFFIRMATION_SUBCATEGORIES, subcategory]
    : AFFIRMATION_SUBCATEGORIES;

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Edit affirmation"
        title="Edit affirmation"
        className="h-11 w-11 !p-0 sm:h-9 sm:w-9"
        onClick={() => dialogRef.current?.showModal()}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.174 6.812a2.1 2.1 0 0 0-3-3L5.324 16.653 4 21l4.347-1.324Z" />
          <path d="m15 5 3 3" />
        </svg>
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
              <h2 id={titleId} className="font-display text-2xl font-bold">Edit affirmation</h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Update the statement or move it to another category.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close edit affirmation modal"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <form
            key={`${id}-${text}-${category}-${subcategory ?? ""}`}
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                await updateAffirmation(id, formData);
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
                rows={5}
                defaultValue={text}
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
                <Select id={`${titleId}-category`} name="category" defaultValue={category}>
                  {categories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-subcategory`}>
                  Subcategory
                </label>
                <Select id={`${titleId}-subcategory`} name="subcategory" defaultValue={subcategory ?? ""}>
                  <option value="">No subcategory</option>
                  {subcategories.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </Select>
              </div>
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

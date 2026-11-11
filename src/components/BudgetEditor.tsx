"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { saveBudgets } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES, categoryColor } from "@/lib/financeCategories";

/** "Budgets" button on the By category card: a monthly limit per category. */
export function BudgetEditor({ budgets }: { budgets: Record<string, number> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const count = Object.keys(budgets).length;
  const close = () => {
    if (!isPending) dialogRef.current?.close();
  };

  return (
    <>
      <Button type="button" size="sm" variant="ghost" onClick={() => dialogRef.current?.showModal()}>
        {count > 0 ? `Budgets (${count})` : "Set budgets"}
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,30rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <form
          className="brut-border brut-shadow space-y-4 rounded-lg bg-surface p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await saveBudgets(formData);
              if (result.ok) {
                setError(null);
                dialogRef.current?.close();
              } else {
                setError(result.error);
              }
            });
          }}
        >
          <div>
            <h2 id={titleId} className="font-display text-2xl font-bold">
              Monthly budgets
            </h2>
            <p className="mt-1 text-sm font-semibold text-muted">
              A spending limit per category, the same every month. Leave a box empty for no limit.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPENSE_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: categoryColor(category) }} />
                <span className="w-28 shrink-0 text-sm font-bold">{category}</span>
                <Input
                  name={`budget-${category}`}
                  inputMode="decimal"
                  placeholder="€ —"
                  defaultValue={budgets[category] !== undefined ? String(budgets[category]) : ""}
                  className="min-w-0"
                />
              </label>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-sm font-bold text-pink">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="green" disabled={isPending}>
              {isPending ? "Saving..." : "Save budgets"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

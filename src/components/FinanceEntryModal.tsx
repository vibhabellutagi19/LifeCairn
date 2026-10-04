"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createFinanceEntry } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";

export function FinanceEntryModal({
  type,
  defaultDate,
}: {
  type: "income" | "expense";
  defaultDate: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const isExpense = type === "expense";
  const label = isExpense ? "expense" : "income";

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button
        type="button"
        variant={isExpense ? "pink" : "green"}
        onClick={() => dialogRef.current?.showModal()}
      >
        + Add {label}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,34rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
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
                Add {label}
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                {isExpense
                  ? "Record spending for the selected month."
                  : "Record money received for the selected month."}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Close add ${label} modal`}
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
                await createFinanceEntry(formData);
                form.reset();
                close();
              });
            }}
          >
            <input type="hidden" name="type" value={type} />
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-source`}>
                {isExpense ? "Merchant or expense" : "Income source"}
              </label>
              <Input
                id={`${titleId}-source`}
                name="source"
                placeholder={isExpense ? "e.g. Groceries" : "e.g. Salary"}
                autoFocus
                required
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-amount`}>
                  Amount (€)
                </label>
                <Input
                  id={`${titleId}-amount`}
                  name="amount"
                  placeholder="0"
                  inputMode="decimal"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-date`}>
                  Date
                </label>
                <Input id={`${titleId}-date`} type="date" name="date" defaultValue={defaultDate} required />
              </div>
            </div>
            {isExpense ? (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-category`}>
                  Category
                </label>
                <Select id={`${titleId}-category`} name="category" defaultValue="Other" required>
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-notes`}>
                Notes <span className="normal-case text-muted">(optional)</span>
              </label>
              <Input id={`${titleId}-notes`} name="notes" placeholder="Add a short note" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant={isExpense ? "pink" : "green"} disabled={isPending}>
                {isPending ? "Saving..." : `Save ${label}`}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

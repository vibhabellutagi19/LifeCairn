"use client";

import { useRef, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Input, Select } from "@/components/ui";
import { deleteFinanceEntry, updateFinanceEntry } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import { formatDateShort, formatEUR } from "@/lib/format";

export function FinanceEntryRow({
  id,
  date,
  type,
  source,
  category,
  tags = [],
  amount,
  notes,
}: {
  id: number;
  date: string;
  type: "income" | "expense";
  source: string;
  category?: string;
  tags?: string[];
  amount: string;
  notes: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const close = () => dialogRef.current?.close();
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide";

  const remove = () => {
    if (!confirm(`Delete “${source}”?`)) return;
    startTransition(async () => {
      await deleteFinanceEntry(id);
      close();
    });
  };

  return (
    <div className="brut-border flex items-stretch rounded-md bg-surface">
      {/* The whole row opens the editor; on wider screens a quick delete sits beside it. */}
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md p-3 text-left hover:bg-background"
        onClick={() => dialogRef.current?.showModal()}
      >
        <span className="w-11 shrink-0 text-xs font-bold text-muted sm:w-14">{formatDateShort(date)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-bold">{source}</span>
            {type === "expense" && category ? (
              <span className="hidden shrink-0 rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline">
                {category}
              </span>
            ) : null}
          </span>
          {(type === "expense" && category) || tags.length > 0 || notes ? (
            <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs">
              {type === "expense" && category ? (
                <span className="shrink-0 font-bold uppercase text-muted sm:hidden">{category}</span>
              ) : null}
              {tags.map((tag) => (
                <span key={tag} className="shrink-0 font-bold text-blue">
                  #{tag}
                </span>
              ))}
              {notes ? <span className="truncate text-muted">{notes}</span> : null}
            </span>
          ) : null}
        </span>
        <span className={clsx("shrink-0 font-bold", type === "income" ? "text-green" : "text-pink")}>
          {type === "income" ? "+" : "-"}
          {formatEUR(amount)}
        </span>
        <span className="sr-only">, edit</span>
      </button>
      <button
        type="button"
        aria-label={`Delete ${source}`}
        disabled={isPending}
        className="hidden w-11 shrink-0 items-center justify-center text-muted hover:text-pink disabled:opacity-50 sm:flex"
        onClick={remove}
      >
        ✕
      </button>

      <dialog
        ref={dialogRef}
        aria-label={`Edit ${type}`}
        className="m-auto max-h-[90vh] w-[min(92vw,34rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onClick={(event) => {
          if (event.target === event.currentTarget && !isPending) close();
        }}
      >
        <div className="brut-border brut-shadow rounded-lg bg-surface p-5">
          <h2 className="mb-4 font-display text-2xl font-bold">Edit {type}</h2>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                await updateFinanceEntry(id, formData);
                close();
              });
            }}
          >
            <div>
              <label className={label}>{type === "expense" ? "Merchant or expense" : "Income source"}</label>
              <Input name="source" defaultValue={source} required />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label}>Amount (€)</label>
                <Input name="amount" defaultValue={amount} inputMode="decimal" required />
              </div>
              <div>
                <label className={label}>Date</label>
                <Input type="date" name="date" defaultValue={date} required />
              </div>
            </div>
            {type === "expense" ? (
              <div>
                <label className={label}>Category</label>
                <Select name="category" defaultValue={category ?? "Other"}>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            {type === "expense" ? (
              <div>
                <label className={label}>
                  Tags <span className="normal-case text-muted">(optional, comma separated)</span>
                </label>
                <Input name="tags" defaultValue={tags.join(", ")} placeholder="e.g. goa-trip, work" />
              </div>
            ) : null}
            <div>
              <label className={label}>Notes</label>
              <Input name="notes" defaultValue={notes ?? ""} />
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" disabled={isPending} onClick={remove} className="mr-auto text-pink">
                Delete
              </Button>
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant={type === "expense" ? "pink" : "green"} disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}

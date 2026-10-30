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

  return (
    <div className="brut-border grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md bg-surface p-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto_auto]">
      <span className="shrink-0 text-xs font-bold text-muted">{formatDateShort(date)}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-bold">{source}</p>
          {type === "expense" && category ? (
            <span className="rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {category}
            </span>
          ) : null}
        </div>
        {tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span key={tag} className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-blue">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        {notes ? <p className="truncate text-xs text-muted">{notes}</p> : null}
      </div>
      <span
        className={clsx(
          "col-start-2 row-start-2 shrink-0 justify-self-start font-bold sm:col-start-3 sm:row-start-1 sm:justify-self-end",
          type === "income" ? "text-green" : "text-pink"
        )}
      >
        {type === "income" ? "+" : "-"}
        {formatEUR(amount)}
      </span>
      <button
        type="button"
        aria-label="Edit entry"
        className="col-start-3 row-start-2 flex h-11 w-11 shrink-0 items-center justify-center text-xs font-bold uppercase text-blue hover:underline sm:col-start-4 sm:row-start-1 sm:h-auto sm:w-auto"
        onClick={() => dialogRef.current?.showModal()}
      >
        Edit
      </button>
      <button
        type="button"
        aria-label="Delete entry"
        disabled={isPending}
        className="col-start-3 row-start-1 flex h-11 w-11 shrink-0 items-center justify-center text-muted hover:text-pink sm:col-start-5 sm:h-auto sm:w-auto"
        onClick={() =>
          startTransition(() => {
            deleteFinanceEntry(id);
          })
        }
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
            <div className="flex justify-end gap-2 pt-2">
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

"use client";

import { useId, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Input, Select } from "@/components/ui";
import { createFinanceEntries, type BulkExpenseRow } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";

type Row = BulkExpenseRow & { key: number };

const INITIAL_ROWS = 5;

// Row keys only need to be unique on the client, so a module counter is enough.
let nextKey = 0;

function isBlank(row: Row) {
  return !row.source.trim() && !row.amount.trim() && !row.tags.trim() && !row.notes.trim();
}

function rowError(row: Row) {
  if (isBlank(row)) return null;
  if (!row.source.trim()) return "Add what it was for";
  const amount = Number(row.amount.replaceAll(",", "").trim());
  if (!row.amount.trim() || !Number.isFinite(amount) || amount <= 0) return "Enter an amount above 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return "Pick a date";
  return null;
}

export function BulkExpenseModal({ defaultDate }: { defaultDate: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const [showErrors, setShowErrors] = useState(false);
  // Shared defaults so a trip can be logged without retyping the tag each row.
  const [sharedTags, setSharedTags] = useState("");

  const blankRow = (from?: Row): Row => ({
    key: nextKey++,
    date: from?.date ?? defaultDate,
    source: "",
    amount: "",
    category: from?.category ?? "Other",
    tags: "",
    notes: "",
  });

  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: INITIAL_ROWS }, () => blankRow())
  );

  const filled = rows.filter((row) => !isBlank(row));
  const invalid = filled.filter((row) => rowError(row));
  const total = filled.reduce((sum, row) => {
    const amount = Number(row.amount.replaceAll(",", "").trim());
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);

  const update = (key: number, patch: Partial<BulkExpenseRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const reset = () => {
    setRows(Array.from({ length: INITIAL_ROWS }, () => blankRow()));
    setSharedTags("");
    setShowErrors(false);
  };

  const close = () => dialogRef.current?.close();

  const save = () => {
    if (invalid.length > 0) {
      setShowErrors(true);
      return;
    }
    if (filled.length === 0) return;
    const payload = filled.map((row) => ({
      date: row.date,
      source: row.source,
      amount: row.amount,
      category: row.category,
      tags: [sharedTags, row.tags].filter((t) => t.trim()).join(","),
      notes: row.notes,
    }));
    startTransition(async () => {
      await createFinanceEntries(payload);
      reset();
      close();
    });
  };

  const cell = "h-10 w-full min-w-0 px-2 py-1 text-sm";

  return (
    <>
      <Button type="button" variant="ghost" onClick={() => dialogRef.current?.showModal()}>
        + Bulk add expenses
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[92vh] w-[min(96vw,64rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
      >
        <div className="brut-border brut-shadow rounded-lg bg-surface p-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-bold">
                Bulk add expenses
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Fill in as many rows as you need. Empty rows are ignored. New rows copy the date and
                category from the row above.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close bulk add"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <div className="mb-4 max-w-sm">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-shared`}>
              Tags for every row <span className="normal-case text-muted">(optional, e.g. goa-trip)</span>
            </label>
            <Input
              id={`${titleId}-shared`}
              value={sharedTags}
              onChange={(event) => setSharedTags(event.target.value)}
              placeholder="goa-trip"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[56rem] border-separate border-spacing-y-1.5 text-left">
              <thead>
                <tr className="text-[11px] font-bold uppercase tracking-wide text-muted">
                  <th className="w-8 px-1">#</th>
                  <th className="w-36 px-1">Date</th>
                  <th className="px-1">Expense</th>
                  <th className="w-28 px-1">Amount (€)</th>
                  <th className="w-36 px-1">Category</th>
                  <th className="w-36 px-1">Tags</th>
                  <th className="w-40 px-1">Notes</th>
                  <th className="w-8 px-1" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const error = showErrors ? rowError(row) : null;
                  return (
                    <tr key={row.key} className={clsx(error && "[&_input]:border-pink [&_select]:border-pink")}>
                      <td className="px-1 text-xs font-bold text-muted">{index + 1}</td>
                      <td className="px-1">
                        <Input
                          type="date"
                          aria-label={`Row ${index + 1} date`}
                          className={cell}
                          value={row.date}
                          onChange={(event) => update(row.key, { date: event.target.value })}
                        />
                      </td>
                      <td className="px-1">
                        <Input
                          aria-label={`Row ${index + 1} expense`}
                          className={cell}
                          placeholder="e.g. Dinner"
                          value={row.source}
                          onChange={(event) => update(row.key, { source: event.target.value })}
                        />
                        {error ? <p className="mt-0.5 text-[11px] font-bold text-pink">{error}</p> : null}
                      </td>
                      <td className="px-1">
                        <Input
                          aria-label={`Row ${index + 1} amount`}
                          className={cell}
                          inputMode="decimal"
                          placeholder="0"
                          value={row.amount}
                          onChange={(event) => update(row.key, { amount: event.target.value })}
                        />
                      </td>
                      <td className="px-1">
                        <Select
                          aria-label={`Row ${index + 1} category`}
                          className={cell}
                          value={row.category}
                          onChange={(event) => update(row.key, { category: event.target.value })}
                        >
                          {EXPENSE_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {category}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-1">
                        <Input
                          aria-label={`Row ${index + 1} tags`}
                          className={cell}
                          placeholder="optional"
                          value={row.tags}
                          onChange={(event) => update(row.key, { tags: event.target.value })}
                        />
                      </td>
                      <td className="px-1">
                        <Input
                          aria-label={`Row ${index + 1} notes`}
                          className={cell}
                          placeholder="optional"
                          value={row.notes}
                          onChange={(event) => update(row.key, { notes: event.target.value })}
                        />
                      </td>
                      <td className="px-1">
                        <button
                          type="button"
                          aria-label={`Remove row ${index + 1}`}
                          disabled={rows.length === 1}
                          className="flex h-10 w-8 items-center justify-center text-muted hover:text-pink disabled:opacity-30"
                          onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setRows((current) => [...current, blankRow(current[current.length - 1])])}
            >
              + Add row
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setRows((current) => [
                  ...current,
                  ...Array.from({ length: 5 }, () => blankRow(current[current.length - 1])),
                ])
              }
            >
              + 5 rows
            </Button>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-ink/10 pt-4">
            <p className="text-sm font-bold">
              {filled.length} {filled.length === 1 ? "expense" : "expenses"} ·{" "}
              <span className="text-pink">€{total.toFixed(2)}</span>
              {showErrors && invalid.length > 0 ? (
                <span className="ml-2 text-pink">· fix {invalid.length} highlighted {invalid.length === 1 ? "row" : "rows"}</span>
              ) : null}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="button" variant="pink" disabled={isPending || filled.length === 0} onClick={save}>
                {isPending ? "Saving..." : `Save ${filled.length || ""} ${filled.length === 1 ? "expense" : "expenses"}`}
              </Button>
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}

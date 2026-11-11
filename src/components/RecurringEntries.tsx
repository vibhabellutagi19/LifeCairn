"use client";

import { useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Input, Select } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
import { addRecurringForMonth, createRecurring, deleteRecurring } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";
import { formatEUR } from "@/lib/format";

export type RecurringItem = {
  id: number;
  type: "income" | "expense";
  source: string;
  category: string;
  amount: number;
  dayOfMonth: number;
  /** Already added to the month being viewed. */
  added: boolean;
};

function ordinal(day: number) {
  const suffix = day % 10 === 1 && day !== 11 ? "st" : day % 10 === 2 && day !== 12 ? "nd" : day % 10 === 3 && day !== 13 ? "rd" : "th";
  return `${day}${suffix}`;
}

/** Rent, salary, subscriptions: add the month's regulars in one tap. */
export function RecurringEntries({
  month,
  monthLabel,
  items,
}: {
  month: string;
  monthLabel: string;
  items: RecurringItem[];
}) {
  const [isPending, startTransition] = useTransition();
  const [formOpen, setFormOpen] = useState(items.length === 0);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const due = items.filter((item) => !item.added);
  const dueOut = due.filter((i) => i.type === "expense").reduce((sum, i) => sum + i.amount, 0);
  const dueIn = due.filter((i) => i.type === "income").reduce((sum, i) => sum + i.amount, 0);

  const add = (ids: number[]) =>
    startTransition(async () => {
      const count = await addRecurringForMonth(month, ids);
      setMessage(count > 0 ? `✓ Added ${count} to ${monthLabel}` : "Nothing new to add.");
    });

  return (
    <div>
      <CardHeader
        className="mb-3"
        title="Regulars"
        description={`Rent, salary, subscriptions: add ${monthLabel}'s in one tap.`}
        action={
          due.length > 0 ? (
            <Button type="button" size="sm" variant="primary" disabled={isPending} onClick={() => add(due.map((i) => i.id))}>
              {isPending ? "Adding..." : `Add ${due.length} due`}
            </Button>
          ) : items.length > 0 ? (
            <span className="rounded-full bg-green/15 px-3 py-1 text-xs font-bold uppercase">✓ All added</span>
          ) : null
        }
      />

      {due.length > 0 ? (
        <p className="mb-2 text-xs font-semibold text-muted">
          Still to add for {monthLabel}:
          {dueOut > 0 ? <b className="text-pink"> −{formatEUR(dueOut)}</b> : null}
          {dueIn > 0 ? <b className="text-green"> +{formatEUR(dueIn)}</b> : null}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="brut-border divide-y divide-ink/10 overflow-hidden rounded-md bg-surface">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-3 py-2">
              <span
                className={clsx(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  item.added ? "bg-green text-white" : "brut-border bg-background text-muted"
                )}
                aria-label={item.added ? "Added this month" : "Not added yet"}
              >
                {item.added ? "✓" : ""}
              </span>
              <div className="min-w-0 flex-1">
                <p className={clsx("truncate text-sm font-bold", item.added && "text-muted")}>{item.source}</p>
                <p className="text-[11px] font-semibold text-muted">
                  {ordinal(item.dayOfMonth)} · {item.type === "income" ? "Income" : item.category}
                </p>
              </div>
              <span className={clsx("shrink-0 text-sm font-bold", item.type === "income" ? "text-green" : "text-pink")}>
                {item.type === "income" ? "+" : "−"}
                {formatEUR(item.amount)}
              </span>
              {!item.added ? (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => add([item.id])}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold uppercase text-blue hover:bg-background disabled:opacity-50"
                >
                  Add
                </button>
              ) : null}
              <button
                type="button"
                aria-label={`Stop ${item.source} repeating`}
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Remove “${item.source}” from your regulars? Entries already added stay.`)) return;
                  startTransition(() => deleteRecurring(item.id));
                }}
                className="flex h-8 w-8 shrink-0 items-center justify-center text-muted hover:text-pink disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p aria-live="polite" className="mt-2 min-h-4 text-xs font-bold text-green">
        {message}
      </p>

      {formOpen ? (
        <form
          className="brut-border mt-2 grid grid-cols-2 gap-2 rounded-md bg-background p-3 sm:grid-cols-[auto_minmax(0,1fr)_7rem_9rem_5rem_auto]"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const formData = new FormData(form);
            startTransition(async () => {
              const result = await createRecurring(formData);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setError(null);
              form.reset();
              setFormOpen(false);
            });
          }}
        >
          <input type="hidden" name="type" value={type} />
          <div className="col-span-2 flex overflow-hidden rounded-md border-2 border-ink sm:col-span-1" role="group" aria-label="Type">
            {(["expense", "income"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={type === t}
                onClick={() => setType(t)}
                className={clsx(
                  "flex-1 px-3 py-2 text-xs font-bold uppercase",
                  type === t ? (t === "income" ? "bg-green text-white" : "bg-pink text-white") : "bg-surface"
                )}
              >
                {t === "income" ? "In" : "Out"}
              </button>
            ))}
          </div>
          <Input name="source" placeholder={type === "income" ? "e.g. Salary" : "e.g. Rent"} aria-label="Name" className="col-span-2 sm:col-span-1" required />
          <Input name="amount" inputMode="decimal" placeholder="€ 0.00" aria-label="Amount" required />
          {type === "expense" ? (
            <Select name="category" aria-label="Category" defaultValue="Housing">
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          ) : (
            <span className="hidden sm:block" />
          )}
          <label className="flex items-center gap-1 text-xs font-bold text-muted">
            Day
            <Input name="dayOfMonth" type="number" min={1} max={28} defaultValue={1} aria-label="Day of the month" className="min-w-0" />
          </label>
          <div className="col-span-2 flex justify-end gap-2 sm:col-span-1">
            {items.length > 0 ? (
              <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" size="sm" variant="green" disabled={isPending}>
              Save
            </Button>
          </div>
          {error ? (
            <p role="alert" className="col-span-full text-sm font-bold text-pink">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="mt-1 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
        >
          + Add a regular
        </button>
      )}
    </div>
  );
}

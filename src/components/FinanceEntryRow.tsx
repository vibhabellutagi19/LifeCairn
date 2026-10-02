"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { deleteFinanceEntry } from "@/lib/actions/finance";
import { formatDateShort, formatEUR } from "@/lib/format";

export function FinanceEntryRow({
  id,
  date,
  type,
  source,
  category,
  amount,
  notes,
}: {
  id: number;
  date: string;
  type: "income" | "expense";
  source: string;
  category?: string;
  amount: string;
  notes: string | null;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="brut-border grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-md bg-surface p-3 sm:grid-cols-[4rem_minmax(0,1fr)_auto_auto]">
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
        aria-label="Delete entry"
        disabled={isPending}
        className="col-start-3 row-start-1 flex h-10 w-10 shrink-0 items-center justify-center text-muted hover:text-pink sm:col-start-4 sm:h-auto sm:w-auto"
        onClick={() =>
          startTransition(() => {
            deleteFinanceEntry(id);
          })
        }
      >
        ✕
      </button>
    </div>
  );
}

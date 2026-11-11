"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { setMonthlyTarget } from "@/lib/actions/finance";

/** Set, change or clear the selected month's income target, inline. */
export function IncomeTargetEditor({ month, target }: { month: string; target: number | null }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] font-bold uppercase tracking-wide text-blue hover:underline"
      >
        {target === null ? "+ Set income target" : "Edit target"}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await setMonthlyTarget(month, formData);
          if (result.ok) {
            setError(null);
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <Input
        name="targetAmount"
        inputMode="decimal"
        placeholder="€ target (empty to clear)"
        defaultValue={target ?? ""}
        aria-label="Income target for the month"
        className="w-44 min-w-0 py-1"
        autoFocus
      />
      <Button type="submit" size="sm" variant="green" disabled={isPending}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error ? <p role="alert" className="w-full text-xs font-bold text-pink">{error}</p> : null}
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button, Input } from "@/components/ui";
import { setEurToInr } from "@/lib/actions/finance";

/** "€1 = ₹ [ ]": the rate used to show INR and EUR savings as one total. */
export function EurRateForm({ rate }: { rate: number | null }) {
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
        {rate === null ? "+ Add a € → ₹ rate for one combined total" : `Change rate (€1 = ₹${rate})`}
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
          const result = await setEurToInr(formData);
          if (result.ok) {
            setError(null);
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <span className="text-sm font-bold">€1 = ₹</span>
      <Input
        name="eurToInr"
        inputMode="decimal"
        placeholder="e.g. 104.5"
        defaultValue={rate ?? ""}
        aria-label="Rupees per euro (empty to remove)"
        className="w-28 min-w-0 py-1"
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

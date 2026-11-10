"use client";

import { useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createFinanceEntry } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES } from "@/lib/financeCategories";

// One-line expense logger for the top of the Finance page: amount, what, category, go.
export function QuickExpense({ defaultDate }: { defaultDate: string }) {
  const [isPending, startTransition] = useTransition();
  const [lastAdded, setLastAdded] = useState<string | null>(null);

  return (
    <form
      className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 md:grid-cols-[8rem_minmax(0,1fr)_10rem_9.5rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const source = String(formData.get("source") || "");
        startTransition(async () => {
          await createFinanceEntry(formData);
          form.reset();
          setLastAdded(source);
          (form.elements.namedItem("amount") as HTMLInputElement | null)?.focus();
        });
      }}
    >
      <input type="hidden" name="type" value="expense" />
      <Input
        name="amount"
        inputMode="decimal"
        placeholder="€ 0.00"
        aria-label="Amount in euros"
        className="font-display text-lg"
        required
      />
      <Input name="source" placeholder="What was it? e.g. Lidl" aria-label="What was it" required />
      <Select name="category" defaultValue="Food" aria-label="Category">
        {EXPENSE_CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </Select>
      <Input type="date" name="date" defaultValue={defaultDate} aria-label="Date" required />
      <Button type="submit" variant="pink" disabled={isPending} className="col-span-2 md:col-span-1">
        {isPending ? "Adding..." : "Log it"}
      </Button>
      <p aria-live="polite" className="col-span-full min-h-4 text-xs font-bold text-green">
        {lastAdded && !isPending ? `✓ Added “${lastAdded}”` : ""}
      </p>
    </form>
  );
}

"use client";

import { useId, useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createFinanceEntry } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES, guessCategory, matchMerchant, type Merchant } from "@/lib/financeCategories";

/**
 * One-line expense logger for the top of the Finance page: amount, what,
 * category, go. The category follows what you used for that merchant before
 * (or a hint word like "Lidl"), until you pick one yourself.
 */
export function QuickExpense({ defaultDate, merchants }: { defaultDate: string; merchants: Merchant[] }) {
  const listId = useId();
  const [isPending, startTransition] = useTransition();
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("Food");
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const followSource = (source: string) => {
    if (categoryTouched) return;
    const known = matchMerchant(merchants, source);
    const guess = known?.category ?? guessCategory(source);
    if (guess) setCategory(guess);
  };

  return (
    <form
      className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-2 md:grid-cols-[8rem_minmax(0,1fr)_10rem_9.5rem_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        const source = String(formData.get("source") || "").trim();
        startTransition(async () => {
          const result = await createFinanceEntry(formData);
          if (!result.ok) {
            // Keep what was typed so it can be fixed.
            setError(result.error);
            setLastAdded(null);
            return;
          }
          setError(null);
          form.reset();
          setCategory("Food");
          setCategoryTouched(false);
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
        aria-invalid={error ? true : undefined}
        className="font-display text-lg"
        required
      />
      <Input
        name="source"
        placeholder="What was it? e.g. Lidl"
        aria-label="What was it"
        list={listId}
        autoComplete="off"
        onChange={(event) => followSource(event.target.value)}
        required
      />
      <datalist id={listId}>
        {merchants.map((m) => (
          <option key={m.source} value={m.source} />
        ))}
      </datalist>
      <Select
        name="category"
        aria-label="Category"
        value={category}
        onChange={(event) => {
          setCategory(event.target.value);
          setCategoryTouched(true);
        }}
      >
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

      <div className={moreOpen ? "col-span-full grid grid-cols-1 gap-2 sm:grid-cols-2" : "hidden"}>
        <Input name="tags" placeholder="Tags, e.g. goa-trip, work" aria-label="Tags (comma separated)" />
        <Input name="notes" placeholder="Note (optional)" aria-label="Note" />
      </div>

      <div className="col-span-full flex min-h-5 flex-wrap items-center justify-between gap-2">
        <p aria-live="polite" className={`text-xs font-bold ${error ? "text-pink" : "text-green"}`}>
          {error ?? (lastAdded && !isPending ? `✓ Added “${lastAdded}”` : "")}
        </p>
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          className="text-xs font-bold uppercase tracking-wide text-blue hover:underline"
        >
          {moreOpen ? "Fewer details" : "+ Tags & note"}
        </button>
      </div>
    </form>
  );
}

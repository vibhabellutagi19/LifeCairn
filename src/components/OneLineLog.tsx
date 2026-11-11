"use client";

import { useId, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button } from "@/components/ui";
import { QuickExpense } from "@/components/QuickExpense";
import { createFinanceEntry } from "@/lib/actions/finance";
import { EXPENSE_CATEGORIES, categoryColor, matchMerchant, type Merchant } from "@/lib/financeCategories";
import { parseEntry } from "@/lib/telegram/parse";
import { formatEUR } from "@/lib/format";

export const ONE_LINE_INPUT_ID = "one-line-log";

function chipDate(iso: string, today: string) {
  if (iso === today) return "Today";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Log an expense in one line, the same way as the Telegram bot:
 * "12.50 Lidl #trip yesterday". What it understood shows as chips before
 * saving; the category can be changed there. "Use the form" switches to the
 * field-by-field Quick log.
 */
export function OneLineLog({ today, merchants }: { today: string; merchants: Merchant[] }) {
  const helpId = useId();
  const [text, setText] = useState("");
  const [category, setCategory] = useState<string | null>(null); // user's pick, overrides the guess
  const [mode, setMode] = useState<"line" | "form">("line");
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = text.trim() ? parseEntry(text, "expense", today) : null;
  const entry = parsed?.ok ? parsed.entry : null;
  // Category: typed name > what you used for this place before > hint word > Other.
  const learned = entry ? matchMerchant(merchants, entry.source)?.category ?? null : null;
  const autoCategory = entry ? (entry.category && !entry.guessed ? entry.category : learned ?? entry.category ?? "Other") : "Other";
  const shownCategory = category ?? autoCategory;

  const submit = () => {
    if (!entry) {
      setError(parsed && !parsed.ok ? parsed.error : "Type an amount and what it was, like 12.50 Lidl.");
      return;
    }
    const form = new FormData();
    form.set("type", "expense");
    form.set("amount", String(entry.amount));
    form.set("source", entry.source);
    form.set("category", shownCategory);
    form.set("date", entry.date);
    form.set("tags", entry.tags.join(","));
    startTransition(async () => {
      const result = await createFinanceEntry(form);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setError(null);
      setAdded(`${formatEUR(entry.amount)} · ${entry.source}`);
      setText("");
      setCategory(null);
      document.getElementById(ONE_LINE_INPUT_ID)?.focus();
    });
  };

  if (mode === "form") {
    return (
      <div>
        <QuickExpense defaultDate={today} merchants={merchants} />
        <button
          type="button"
          onClick={() => setMode("line")}
          className="mt-1 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
        >
          ← Back to one line
        </button>
      </div>
    );
  }

  const chip = "brut-border rounded-full bg-surface px-2.5 py-1 text-xs font-bold";
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={ONE_LINE_INPUT_ID} className="mb-2 block font-display text-xs font-bold uppercase tracking-[0.14em]">
        Log in one line
      </label>
      <div className="flex gap-2">
        <input
          id={ONE_LINE_INPUT_ID}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError(null);
            setAdded(null);
          }}
          placeholder="12.50 Lidl #trip yesterday"
          autoComplete="off"
          enterKeyHint="send"
          aria-describedby={helpId}
          aria-invalid={error ? true : undefined}
          className="brut-border h-13 min-w-0 flex-1 rounded-lg bg-surface px-3.5 text-base font-semibold placeholder:text-muted/70 focus:outline-none focus:ring-4 focus:ring-yellow"
        />
        <Button type="submit" variant="pink" disabled={isPending} className="h-13 shrink-0 px-5">
          {isPending ? "…" : "Log"}
        </Button>
      </div>

      <div id={helpId} aria-live="polite" className="mt-2.5 flex min-h-8 flex-wrap items-center gap-1.5">
        {entry ? (
          <>
            <span className="text-xs font-semibold text-muted">Reads as</span>
            <span className={chip}>{formatEUR(entry.amount)}</span>
            <span className={clsx(chip, "max-w-[12rem] truncate")}>{entry.source}</span>
            <label className={clsx(chip, "flex items-center gap-1.5 py-0.5 pr-1")}>
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: categoryColor(shownCategory) }} />
              <span className="sr-only">Category</span>
              <select
                value={shownCategory}
                onChange={(event) => setCategory(event.target.value)}
                className="min-h-7 cursor-pointer bg-transparent font-bold focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {entry.tags.map((tag) => (
              <span key={tag} className={clsx(chip, "text-blue")}>
                #{tag}
              </span>
            ))}
            <span className={chip}>{chipDate(entry.date, today)}</span>
          </>
        ) : error ? (
          <span className="text-xs font-bold text-pink">{error}</span>
        ) : added ? (
          <span className="text-xs font-bold text-green">✓ Added {added}</span>
        ) : (
          <span className="text-xs font-semibold text-muted">
            Amount, what, then optional <b>#tags</b> and a day: <b>yesterday</b>, <b>fri</b>, <b>3/11</b>.
          </span>
        )}
      </div>
      {error && entry ? <p className="mt-1 text-xs font-bold text-pink">{error}</p> : null}
      <button
        type="button"
        onClick={() => setMode("form")}
        className="mt-1 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
      >
        Use the form instead
      </button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Badge, Button, Input } from "@/components/ui";
import { deleteSaving, updateSavingBalance } from "@/lib/actions/finance";
import { formatEUR, formatINR } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = {
  fd: "Fixed Deposit",
  mutual_fund: "Mutual Fund",
  cash: "Emergency Fund",
  bank: "Bank",
  stocks: "Stocks",
  other: "Other",
};

export function SavingRow({
  id,
  name,
  type,
  balance,
}: {
  id: number;
  name: string;
  type: string;
  balance: string;
}) {
  const [value, setValue] = useState(balance);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dirty = value !== balance;
  const isEuroSaving = /\bEUR\b/i.test(name);

  return (
    <div className="brut-border rounded-md bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold" title={name}>{name}</p>
          <Badge color="muted">{TYPE_LABEL[type] ?? type}</Badge>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <div className="text-right">
            <p className="font-display text-lg font-bold">
              {isEuroSaving ? formatEUR(balance) : formatINR(balance)}
            </p>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-end text-xs font-bold uppercase tracking-wide text-blue hover:underline sm:min-h-0"
              onClick={() => {
                setValue(balance);
                setIsEditing((current) => !current);
              }}
            >
              {isEditing ? "Close" : "Edit"}
            </button>
          </div>
          <button
            type="button"
            aria-label={`Delete ${name}`}
            disabled={isPending}
            className="flex h-11 w-11 items-center justify-center text-muted hover:text-pink disabled:opacity-50 sm:h-9 sm:w-9"
            onClick={() =>
              startTransition(() => {
                deleteSaving(id);
              })
            }
          >
            ✕
          </button>
        </div>
      </div>

      {isEditing ? (
        <form
          className="mt-3 flex items-center gap-2 border-t-2 border-ink/10 pt-3"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              await updateSavingBalance(id, value);
              setIsEditing(false);
            });
          }}
        >
          <span className="text-sm font-bold text-muted">{isEuroSaving ? "€" : "₹"}</span>
          <Input
            aria-label={`Current value for ${name}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            className="min-w-0 flex-1"
          />
          <Button
            type="submit"
            size="sm"
            variant="green"
            disabled={isPending || !dirty}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

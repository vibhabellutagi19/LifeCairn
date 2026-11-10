"use client";

import { useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { deleteSaving, updateSaving } from "@/lib/actions/finance";

const TYPE_LABEL: Record<string, string> = {
  fd: "Fixed Deposit",
  mutual_fund: "Mutual Fund",
  cash: "Emergency Fund",
  bank: "Bank",
  stocks: "Stocks",
  other: "Other",
};

// Rename / retype / delete a saving from inside the snapshot form. Uses buttons
// rather than a nested <form>; balances are edited through the snapshot itself.
export function SavingAccountControls({
  id,
  name,
  type,
  balance,
  currency,
}: {
  id: number;
  name: string;
  type: string;
  balance: string;
  currency: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [typeValue, setTypeValue] = useState(type);
  const [currencyValue, setCurrencyValue] = useState(currency);
  const [isPending, startTransition] = useTransition();
  const dirty = nameValue.trim() !== name || typeValue !== type || currencyValue !== currency;

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate font-bold" title={name}>{name}</p>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
          {TYPE_LABEL[type] ?? type}
        </span>
        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
          {currency}
        </span>
        <button
          type="button"
          className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-blue hover:underline"
          onClick={() => {
            setNameValue(name);
            setTypeValue(type);
            setCurrencyValue(currency);
            setIsEditing(true);
          }}
        >
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${name}`}
          disabled={isPending}
          className="shrink-0 text-muted hover:text-pink disabled:opacity-50"
          onClick={() => {
            if (!confirm(`Delete "${name}"? Past snapshots keep their values.`)) return;
            startTransition(() => {
              deleteSaving(id);
            });
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        aria-label="Saving name"
        value={nameValue}
        onChange={(event) => setNameValue(event.target.value)}
        className="min-w-0 flex-1"
      />
      <Select aria-label="Saving type" value={typeValue} onChange={(event) => setTypeValue(event.target.value)}>
        {Object.entries(TYPE_LABEL).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </Select>
      <Select aria-label="Currency" value={currencyValue} onChange={(event) => setCurrencyValue(event.target.value)}>
        <option value="INR">₹ INR</option>
        <option value="EUR">€ EUR</option>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="green"
        disabled={isPending || !dirty || !nameValue.trim()}
        onClick={() => {
          const formData = new FormData();
          formData.set("name", nameValue);
          formData.set("type", typeValue);
          formData.set("balance", balance);
          formData.set("currency", currencyValue);
          startTransition(async () => {
            await updateSaving(id, formData);
            setIsEditing(false);
          });
        }}
      >
        {isPending ? "Saving..." : "Save"}
      </Button>
      <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setIsEditing(false)}>
        Cancel
      </Button>
    </div>
  );
}

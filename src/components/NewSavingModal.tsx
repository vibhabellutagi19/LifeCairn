"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { DepositTermsFields } from "@/components/DepositTerms";
import { createSaving } from "@/lib/actions/finance";

export function NewSavingModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState("mutual_fund");
  const [error, setError] = useState<string | null>(null);

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button type="button" variant="primary" onClick={() => dialogRef.current?.showModal()}>
        + Add saving
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,34rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isPending) close();
        }}
      >
        <div className="brut-border brut-shadow rounded-lg bg-surface p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-bold">
                Add saving
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Add an FD, fund, investment, bank balance, or emergency fund.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close add saving modal"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const formData = new FormData(form);
              startTransition(async () => {
                const result = await createSaving(formData);
                if (result && !result.ok) {
                  setError(result.error);
                  return;
                }
                setError(null);
                form.reset();
                setType("mutual_fund");
                close();
              });
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-name`}>
                Saving name
              </label>
              <Input
                id={`${titleId}-name`}
                name="name"
                placeholder="e.g. Zerodha mutual fund"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-type`}>
                Saving type
              </label>
              <Select id={`${titleId}-type`} name="type" value={type} onChange={(event) => setType(event.target.value)}>
                <option value="fd">Fixed Deposit</option>
                <option value="rd">Recurring Deposit</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="stocks">Stocks</option>
                <option value="bank">Bank balance</option>
                <option value="cash">Emergency fund</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-balance`}>
                  Current value
                </label>
                <Input
                  id={`${titleId}-balance`}
                  name="balance"
                  placeholder="0"
                  inputMode="decimal"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-currency`}>
                  Currency
                </label>
                <Select id={`${titleId}-currency`} name="currency" defaultValue="INR">
                  <option value="INR">₹ INR</option>
                  <option value="EUR">€ EUR</option>
                </Select>
              </div>
            </div>
            {type === "fd" || type === "rd" ? (
              <fieldset className="brut-border space-y-3 rounded-md bg-background p-3">
                <legend className="px-1 text-xs font-bold uppercase tracking-wide">Deposit terms (optional)</legend>
                <p className="text-xs font-semibold text-muted">
                  Add them to see interest, maturity value and payouts on the Wealth page. You can add them later too.
                </p>
                <DepositTermsFields key={type} type={type} />
              </fieldset>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm font-bold text-pink">
                {error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? "Saving..." : "Add saving"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

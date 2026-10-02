"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { createSaving } from "@/lib/actions/finance";

export function NewSavingModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();

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
              className="text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
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
                await createSaving(formData);
                form.reset();
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
              <Select id={`${titleId}-type`} name="type" defaultValue="mutual_fund">
                <option value="fd">Fixed Deposit</option>
                <option value="mutual_fund">Mutual Fund</option>
                <option value="stocks">Stocks</option>
                <option value="bank">Bank balance</option>
                <option value="cash">Emergency fund</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-balance`}>
                Current value (₹)
              </label>
              <Input
                id={`${titleId}-balance`}
                name="balance"
                placeholder="0"
                inputMode="decimal"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
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

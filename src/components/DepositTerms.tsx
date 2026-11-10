"use client";

import { useId, useState, useTransition } from "react";
import { Button, Input, Select } from "@/components/ui";
import { updateDepositTerms } from "@/lib/actions/finance";
import { INTEREST_PAYOUTS, PAYOUT_LABEL, type InterestPayout } from "@/lib/deposits";

export type DepositTermsValues = {
  amount: string;
  rate: string;
  start: string;
  maturity: string;
  payout: InterestPayout;
};

const label = "mb-1 block text-xs font-bold uppercase tracking-wide";

/** The deposit inputs, named as the server actions expect. Uncontrolled. */
export function DepositTermsFields({
  type,
  initial,
  required = false,
}: {
  type: "fd" | "rd";
  initial?: DepositTermsValues | null;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={label} htmlFor={`${id}-amount`}>
          {type === "rd" ? "Monthly instalment" : "Principal"}
        </label>
        <Input
          id={`${id}-amount`}
          name="depositAmount"
          inputMode="decimal"
          placeholder={type === "rd" ? "5000" : "100000"}
          defaultValue={initial?.amount}
          required={required}
        />
      </div>
      <div>
        <label className={label} htmlFor={`${id}-rate`}>
          Interest % a year
        </label>
        <Input
          id={`${id}-rate`}
          name="interestRate"
          inputMode="decimal"
          placeholder="7.1"
          defaultValue={initial?.rate}
          required={required}
        />
      </div>
      <div>
        <label className={label} htmlFor={`${id}-start`}>
          Start date
        </label>
        <Input id={`${id}-start`} type="date" name="depositStart" defaultValue={initial?.start} required={required} />
      </div>
      <div>
        <label className={label} htmlFor={`${id}-maturity`}>
          Maturity date
        </label>
        <Input
          id={`${id}-maturity`}
          type="date"
          name="depositMaturity"
          defaultValue={initial?.maturity}
          required={required}
        />
      </div>
      {type === "fd" ? (
        <div className="col-span-2">
          <label className={label} htmlFor={`${id}-payout`}>
            Interest
          </label>
          <Select id={`${id}-payout`} name="interestPayout" defaultValue={initial?.payout ?? "maturity"}>
            {INTEREST_PAYOUTS.map((payout) => (
              <option key={payout} value={payout}>
                {payout === "maturity" ? "At maturity (added to the deposit)" : PAYOUT_LABEL[payout]}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <p className="col-span-2 text-xs font-semibold text-muted">
          An RD pays its interest at maturity, together with your instalments.
        </p>
      )}
    </div>
  );
}

/** "Add terms" / "Edit terms" on a deposit row, expanding into the form. */
export function DepositTermsEditor({
  id,
  name,
  type,
  initial,
}: {
  id: number;
  name: string;
  type: "fd" | "rd";
  initial: DepositTermsValues | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant={initial ? "ghost" : "primary"} onClick={() => setOpen(true)}>
        {initial ? "Edit terms" : "Add terms"}
      </Button>
    );
  }

  return (
    <form
      aria-label={`Terms for ${name}`}
      className="brut-border mt-3 w-full space-y-3 rounded-md bg-background p-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await updateDepositTerms(id, formData);
          if (result.ok) {
            setError(null);
            setOpen(false);
          } else {
            setError(result.error);
          }
        });
      }}
    >
      <DepositTermsFields type={type} initial={initial} required />
      {error ? (
        <p role="alert" className="text-sm font-bold text-pink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="green" disabled={isPending}>
          {isPending ? "Saving..." : "Save terms"}
        </Button>
      </div>
    </form>
  );
}

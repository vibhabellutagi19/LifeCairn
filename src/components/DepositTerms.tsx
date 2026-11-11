"use client";

import { useId, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Input, Select } from "@/components/ui";
import { updateDepositTerms } from "@/lib/actions/finance";
import { INTEREST_PAYOUTS, PAYOUT_LABEL, type DepositType, type InterestPayout } from "@/lib/deposits";

export type DepositTermsValues = {
  amount: string;
  rate: string;
  start: string;
  maturity: string;
  payout: InterestPayout;
};

const label = "mb-1 block text-xs font-bold uppercase tracking-wide";

const KINDS: { value: DepositType; title: string; line: string }[] = [
  { value: "fd", title: "Fixed deposit", line: "One lump sum" },
  { value: "rd", title: "Recurring deposit", line: "Monthly deductions, interest at the end" },
];

/**
 * The deposit inputs, named as the server actions expect. With `chooseKind`
 * it also lets you pick FD or RD (sent as `depositKind`); otherwise the kind
 * comes from the parent form's own type field.
 */
export function DepositTermsFields({
  type,
  initial,
  required = false,
  chooseKind = false,
}: {
  type: DepositType;
  initial?: DepositTermsValues | null;
  required?: boolean;
  chooseKind?: boolean;
}) {
  const id = useId();
  const [picked, setPicked] = useState<DepositType>(type);
  const kind = chooseKind ? picked : type;
  const isRD = kind === "rd";

  return (
    <div className="grid grid-cols-2 gap-3">
      {chooseKind ? (
        <fieldset className="col-span-2">
          <legend className={label}>Kind</legend>
          <input type="hidden" name="depositKind" value={kind} />
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={kind === option.value}
                onClick={() => setPicked(option.value)}
                className={clsx(
                  "brut-border rounded-md px-3 py-2 text-left",
                  kind === option.value ? "brut-shadow-sm bg-yellow" : "bg-surface hover:bg-background"
                )}
              >
                <span className="block text-sm font-bold">{option.title}</span>
                <span className="block text-[11px] font-semibold leading-tight text-muted">{option.line}</span>
              </button>
            ))}
          </div>
        </fieldset>
      ) : null}
      <div>
        <label className={label} htmlFor={`${id}-amount`}>
          {isRD ? "Deducted each month" : "Principal"}
        </label>
        <Input
          id={`${id}-amount`}
          name="depositAmount"
          inputMode="decimal"
          placeholder={isRD ? "5000" : "100000"}
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
          {isRD ? "First deduction" : "Start date"}
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
      {isRD ? (
        <p className="col-span-2 text-xs font-semibold text-muted">
          The same amount is deducted every month on the day of the first deduction. All the interest is paid at
          maturity, together with what you put in.
        </p>
      ) : (
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
      )}
    </div>
  );
}

/** The terms form inside an expanded deposit row. */
export function DepositTermsEditor({
  id,
  name,
  type,
  initial,
}: {
  id: number;
  name: string;
  type: DepositType;
  initial: DepositTermsValues | null;
}) {
  const [open, setOpen] = useState(!initial);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Edit terms
      </Button>
    );
  }

  return (
    <form
      aria-label={`Terms for ${name}`}
      className="w-full space-y-3"
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
      <DepositTermsFields type={type} initial={initial} required chooseKind />
      {error ? (
        <p role="alert" className="text-sm font-bold text-pink">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {initial ? (
          <Button type="button" size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" variant="green" disabled={isPending}>
          {isPending ? "Saving..." : "Save terms"}
        </Button>
      </div>
    </form>
  );
}

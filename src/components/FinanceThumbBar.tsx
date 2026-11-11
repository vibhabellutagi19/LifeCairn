"use client";

import { FinanceEntryModal } from "@/components/FinanceEntryModal";
import { ONE_LINE_INPUT_ID } from "@/components/OneLineLog";

/** Phones only: a bar at the bottom of the screen with the two ways to add money in or out. */
export function FinanceThumbBar({ defaultDate }: { defaultDate: string }) {
  const button = "h-13 w-full rounded-lg font-display text-base font-bold text-white";
  return (
    <nav
      aria-label="Add an entry"
      className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-3 gap-2 rounded-2xl bg-ink p-2 shadow-[0_6px_0_0_rgba(22,19,15,0.25)] md:hidden print:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <button
        type="button"
        className={`${button} col-span-2 bg-pink`}
        onClick={() => {
          const input = document.getElementById(ONE_LINE_INPUT_ID);
          input?.scrollIntoView({ behavior: "smooth", block: "center" });
          input?.focus({ preventScroll: true });
        }}
      >
        + Expense
      </button>
      <FinanceEntryModal type="income" defaultDate={defaultDate} triggerLabel="+ In" triggerClassName={`${button} bg-green`} />
    </nav>
  );
}

"use client";

/** Opens the browser's print dialog, where "Save as PDF" turns the report into a file. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="brut-border flex min-h-11 items-center rounded-md bg-surface px-3 text-xs font-bold uppercase tracking-wide hover:bg-yellow"
    >
      Save as PDF
    </button>
  );
}

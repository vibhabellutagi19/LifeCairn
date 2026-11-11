"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { clsx } from "clsx";
import { Button, Select } from "@/components/ui";
import { importSnapshotHistory } from "@/lib/actions/finance";
import { formatMoney } from "@/lib/format";
import { matchKey, parseHistory, type HistoryImportPayload } from "@/lib/snapshotImport";

type Saving = { id: number; name: string; currency: string };

const SKIP = "skip";

function monthLabel(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function gainPct(invested: number, current: number) {
  return invested > 0 ? ((current - invested) / invested) * 100 : 0;
}

/** Paste past months from a spreadsheet and save them as monthly snapshots. */
export function SnapshotHistoryImport({ savings, existingMonths }: { savings: Saving[]; existingMonths: string[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [text, setText] = useState("");
  // Only the names the user re-assigned; everything else uses the automatic match.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseHistory(text), [text]);
  const byKey = useMemo(() => new Map(savings.map((s) => [matchKey(s.name), s])), [savings]);
  const existing = useMemo(() => new Set(existingMonths), [existingMonths]);

  const names = [...new Set(parsed.months.flatMap((m) => m.rows.map((r) => r.name)))];
  const assignment = (name: string): string =>
    overrides[name] ?? (byKey.get(matchKey(name)) ? String(byKey.get(matchKey(name))!.id) : SKIP);
  const unmatched = names.filter((name) => !byKey.has(matchKey(name)));
  const savingById = new Map(savings.map((s) => [String(s.id), s]));
  // Show amounts in the currency of the savings they're assigned to (INR if unknown).
  const currencyOf = (name: string) => savingById.get(assignment(name))?.currency ?? "INR";

  const payload: HistoryImportPayload = {
    months: parsed.months
      .map((m) => {
        const items = new Map<number, { accountId: number; invested: number; current: number }>();
        for (const row of m.rows) {
          const target = assignment(row.name);
          if (target === SKIP) continue;
          const id = Number(target);
          // Two sheet rows assigned to one saving: add them up.
          const prev = items.get(id);
          items.set(id, {
            accountId: id,
            invested: (prev?.invested ?? 0) + row.invested,
            current: (prev?.current ?? 0) + row.current,
          });
        }
        return { month: m.month, snapshotDate: m.snapshotDate, items: [...items.values()] };
      })
      .filter((m) => m.items.length > 0),
  };
  const replacing = payload.months.filter((m) => existing.has(m.month)).length;

  const close = () => {
    if (isPending) return;
    dialogRef.current?.close();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setDone(null);
          setError(null);
          dialogRef.current?.showModal();
        }}
      >
        Import history
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[92vh] w-[min(94vw,46rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="brut-border brut-shadow space-y-4 rounded-lg bg-surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-display text-2xl font-bold">
                Import savings history
              </h2>
              <p className="mt-1 text-sm font-semibold text-muted">
                Copy the rows from your spreadsheet and paste them here: a date, then each saving with what you
                invested and its total. Total rows are only used as a check.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close import"
              disabled={isPending}
              className="flex h-11 w-11 shrink-0 items-center justify-center text-xl font-bold text-muted hover:text-ink disabled:opacity-50"
              onClick={close}
            >
              ✕
            </button>
          </div>

          {done ? (
            <div className="space-y-4">
              <p className="brut-border rounded-md bg-green/15 px-4 py-3 font-bold">{done}</p>
              <div className="flex justify-end">
                <Button type="button" variant="primary" onClick={close}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <>
              <textarea
                aria-label="Pasted spreadsheet rows"
                value={text}
                onChange={(event) => {
                  setText(event.target.value);
                  setError(null);
                }}
                rows={6}
                spellCheck={false}
                placeholder={"25/10/2025\tZerodha MF\t48,180.53\t57,408.94\n\tFD\t150,000.00\t151,623\n\tTotal\t…\t…"}
                className="brut-border w-full rounded-md bg-background p-3 font-mono text-xs"
              />

              {text.trim() && parsed.months.length === 0 ? (
                <p className="text-sm font-bold text-pink">
                  No months found. Each block needs a date like 25/10/2025 in the first column.
                </p>
              ) : null}

              {unmatched.length > 0 ? (
                <fieldset className="brut-border space-y-2 rounded-md bg-yellow/30 p-3">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wide">Match these names</legend>
                  <p className="text-xs font-semibold text-muted">
                    These aren&apos;t savings in the app. Pick which saving each one is, or skip it.
                  </p>
                  {unmatched.map((name) => (
                    <label key={name} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                      <span className="truncate text-sm font-bold">{name}</span>
                      <Select
                        value={assignment(name)}
                        onChange={(event) => setOverrides((o) => ({ ...o, [name]: event.target.value }))}
                      >
                        <option value={SKIP}>Skip</option>
                        {savings.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </Select>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              {parsed.months.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    Preview · {parsed.months.length} {parsed.months.length === 1 ? "month" : "months"}
                  </p>
                  <ul className="brut-border max-h-80 divide-y-2 divide-ink/10 overflow-y-auto rounded-md">
                    {parsed.months.map((m) => {
                      const used = m.rows.filter((r) => assignment(r.name) !== SKIP);
                      const invested = used.reduce((sum, r) => sum + r.invested, 0);
                      const current = used.reduce((sum, r) => sum + r.current, 0);
                      const currency = used[0] ? currencyOf(used[0].name) : "INR";
                      const allUsed = used.length === m.rows.length;
                      const sheetMatches =
                        m.sheetTotal &&
                        Math.abs(m.sheetTotal.invested - invested) < 1 &&
                        Math.abs(m.sheetTotal.current - current) < 1;
                      const gain = gainPct(invested, current);
                      return (
                        <li key={m.month}>
                          <details>
                            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-background [&::-webkit-details-marker]:hidden">
                              <span className="w-20 shrink-0 font-display font-bold">{monthLabel(m.month)}</span>
                              <span className="text-xs font-semibold text-muted">
                                {used.length} saving{used.length === 1 ? "" : "s"}
                                {allUsed ? "" : ` (${m.rows.length - used.length} skipped)`}
                              </span>
                              <span className="ml-auto text-sm font-bold">
                                {formatMoney(invested, currency)} → {formatMoney(current, currency)}{" "}
                                <span className={gain >= 0 ? "text-green" : "text-pink"}>
                                  {gain >= 0 ? "+" : ""}
                                  {gain.toFixed(2)}%
                                </span>
                              </span>
                              <span className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                                {m.sheetTotal ? (
                                  <span
                                    className={clsx(
                                      "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                      sheetMatches ? "bg-green/15 text-green" : "bg-orange text-white"
                                    )}
                                  >
                                    {sheetMatches ? "✓ matches sheet total" : "≠ sheet total"}
                                  </span>
                                ) : null}
                                {existing.has(m.month) ? (
                                  <span className="rounded-full bg-yellow px-2 py-0.5 text-[10px] font-bold uppercase">
                                    Updates saved snapshot
                                  </span>
                                ) : null}
                              </span>
                            </summary>
                            <table className="w-full bg-background text-xs">
                              <tbody>
                                {m.rows.map((r, index) => {
                                  const target = savingById.get(assignment(r.name));
                                  return (
                                    <tr key={`${index}-${r.name}`} className={clsx("border-t border-ink/10", !target && "text-muted line-through")}>
                                      <th scope="row" className="px-3 py-1.5 text-left font-bold">
                                        {r.name}
                                        {target && matchKey(target.name) !== matchKey(r.name) ? (
                                          <span className="font-semibold text-muted"> → {target.name}</span>
                                        ) : null}
                                      </th>
                                      <td className="px-3 py-1.5 text-right">{formatMoney(r.invested, target?.currency ?? "INR")}</td>
                                      <td className="px-3 py-1.5 text-right font-bold">
                                        {formatMoney(r.current, target?.currency ?? "INR")}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="text-xs font-semibold text-muted">
                    Dates come from the sheet. Savings you don&apos;t include keep whatever that month already has.
                    {parsed.duplicates.length > 0
                      ? ` ${parsed.duplicates.map(monthLabel).join(", ")} appear twice; the later block is used.`
                      : ""}
                    {parsed.skipped.length > 0 ? ` ${parsed.skipped.length} line(s) couldn't be read and are ignored.` : ""}
                  </p>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="text-sm font-bold text-pink">
                  {error}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="green"
                  disabled={isPending || payload.months.length === 0}
                  onClick={() => {
                    if (replacing > 0 && !confirm(`${replacing} of these months already have a snapshot. Update them?`)) {
                      return;
                    }
                    startTransition(async () => {
                      const result = await importSnapshotHistory(payload);
                      if (result.ok) {
                        setText("");
                        setOverrides({});
                        setDone(`Imported ${result.months} ${result.months === 1 ? "month" : "months"}.`);
                      } else {
                        setError(result.error);
                      }
                    });
                  }}
                >
                  {isPending
                    ? "Importing..."
                    : `Import ${payload.months.length} ${payload.months.length === 1 ? "month" : "months"}`}
                </Button>
              </div>
            </>
          )}
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";
import { formatMoney } from "@/lib/format";

// Categorical palette, in fixed order, validated on the app surface (#fffdf7)
// for colour-blind separation. Colour follows the saving (its position among
// all savings), never its rank, so it stays the same across months.
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6"];
const OTHER = "#a39b8b";
const INVESTED = "#c9c1b1";
const PRESENT = "var(--orange)";

export type AllocationRow = {
  id: number;
  name: string;
  invested: number;
  present: number;
  /** Position of this saving among all of the user's savings. */
  order: number;
};

function share(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function fmtPct(value: number) {
  return `${value.toFixed(1)}%`;
}

function compact(value: number, currency: string) {
  return new Intl.NumberFormat(currency === "EUR" ? "en-IE" : "en-IN", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

type Slice = { key: string; name: string; value: number; color: string };

// Up to seven savings get their own colour; the rest fold into "Other".
function slicesFor(rows: AllocationRow[], pick: (r: AllocationRow) => number, colorOf: (r: AllocationRow) => string) {
  const ranked = [...rows].filter((r) => pick(r) > 0).sort((a, b) => pick(b) - pick(a));
  const own = ranked.filter((r) => colorOf(r) !== OTHER);
  const rest = ranked.filter((r) => colorOf(r) === OTHER);
  const slices: Slice[] = own.map((r) => ({ key: String(r.id), name: r.name, value: pick(r), color: colorOf(r) }));
  const otherTotal = rest.reduce((sum, r) => sum + pick(r), 0);
  if (otherTotal > 0) slices.push({ key: "other", name: `Other (${rest.length})`, value: otherTotal, color: OTHER });
  return slices;
}

function Donut({
  title,
  slices,
  currency,
  active,
  onActive,
}: {
  title: string;
  slices: Slice[];
  currency: string;
  active: string | null;
  onActive: (key: string | null) => void;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const r = 40;
  const c = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 0.8 : 0; // surface gap between segments
  const lengths = slices.map((s) => (s.value / total) * c);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((sum, l) => sum + l, 0));
  const focus = slices.find((s) => s.key === active) ?? null;

  return (
    <figure className="flex flex-col items-center">
      <figcaption className="mb-2 self-start text-xs font-bold uppercase tracking-[0.18em] text-muted">{title}</figcaption>
      <div className="relative aspect-square w-full max-w-[220px]">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label={`${title} split by saving`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--background)" strokeWidth="16" />
          {slices.map((s, i) => {
            const dash = Math.max(0, lengths[i] - gap);
            return (
              <circle
                key={s.key}
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? 19 : 16}
                strokeOpacity={active && active !== s.key ? 0.35 : 1}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offsets[i]}
                className="cursor-pointer transition-all"
                onPointerEnter={() => onActive(s.key)}
                onPointerLeave={() => onActive(null)}
              >
                <title>{`${s.name}: ${formatMoney(s.value, currency)} (${fmtPct(share(s.value, total))})`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          {focus ? (
            <>
              <span className="line-clamp-2 text-[11px] font-bold uppercase leading-tight text-muted">{focus.name}</span>
              <span className="private-value font-display text-2xl font-bold">{fmtPct(share(focus.value, total))}</span>
              <span className="private-value text-xs font-bold">{compact(focus.value, currency)}</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted">Total</span>
              <span className="private-value font-display text-xl font-bold">{compact(total, currency)}</span>
            </>
          )}
        </div>
      </div>
    </figure>
  );
}

function GroupedBars({ rows, currency }: { rows: AllocationRow[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.flatMap((r) => [r.invested, r.present]));
  // Round the axis up to a tidy step so gridlines land on readable numbers.
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step =
    [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => max / s <= 5) ?? magnitude * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  return (
    <figure>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <figcaption className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Invested vs present</figcaption>
        <div className="flex gap-3 text-xs font-bold text-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: INVESTED }} /> Invested
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PRESENT }} /> Present
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        {/* y axis */}
        <div className="relative h-56 w-12 text-right text-[10px] font-bold text-muted">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              <span className="private-value">{compact(t, currency)}</span>
            </span>
          ))}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <div className="relative" style={{ minWidth: `${rows.length * 3.5}rem` }}>
            <div className="relative h-56 border-b-2 border-ink">
              {ticks.slice(1).map((t) => (
                <span key={t} className="absolute inset-x-0 border-t border-ink/10" style={{ bottom: `${(t / top) * 100}%` }} />
              ))}
              <div className="absolute inset-0 flex items-end">
                {rows.map((r, i) => {
                  const gain = r.present - r.invested;
                  return (
                    <div
                      key={r.id}
                      tabIndex={0}
                      aria-label={`${r.name}: invested ${formatMoney(r.invested, currency)}, present ${formatMoney(r.present, currency)}`}
                      className={`relative flex h-full flex-1 items-end justify-center gap-[2px] rounded-t-md outline-none ${
                        hover === i ? "bg-yellow/40" : ""
                      }`}
                      onPointerEnter={() => setHover(i)}
                      onPointerLeave={() => setHover(null)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                    >
                      <span
                        className="w-[30%] max-w-6 rounded-t-[4px]"
                        style={{ height: `${share(r.invested, top)}%`, background: INVESTED }}
                      />
                      <span
                        className="w-[30%] max-w-6 rounded-t-[4px]"
                        style={{ height: `${share(r.present, top)}%`, background: PRESENT }}
                      />
                      {hover === i ? (
                        <span
                          className={`brut-border brut-shadow-sm pointer-events-none absolute bottom-full z-10 mb-1 w-max rounded-md bg-surface px-3 py-2 text-left text-xs ${
                            i > rows.length / 2 ? "right-0" : "left-0"
                          }`}
                        >
                          <span className="block font-bold">{r.name}</span>
                          <span className="private-value block font-semibold text-muted">
                            Invested <b className="text-ink">{formatMoney(r.invested, currency)}</b>
                          </span>
                          <span className="private-value block font-semibold text-muted">
                            Present <b className="text-ink">{formatMoney(r.present, currency)}</b>
                          </span>
                          <span className={`private-value block font-bold ${gain >= 0 ? "text-green" : "text-pink"}`}>
                            {gain >= 0 ? "▲ +" : "▼ "}
                            {formatMoney(gain, currency)} ({fmtPct(share(Math.abs(gain), r.invested))})
                          </span>
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 flex">
              {rows.map((r) => (
                <span key={r.id} className="flex-1 px-0.5 text-center text-[11px] font-bold leading-tight text-muted">
                  {r.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

export function AllocationCharts({
  rows,
  currency,
  monthLabel,
}: {
  rows: AllocationRow[];
  currency: string;
  monthLabel: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const colorOf = (r: AllocationRow) => SERIES[r.order] ?? OTHER;
  const investedTotal = rows.reduce((sum, r) => sum + r.invested, 0);
  const presentTotal = rows.reduce((sum, r) => sum + r.present, 0);
  const tableRows = [...rows].sort((a, b) => b.present - a.present);

  return (
    <Card>
      <CardHeader
        title={`Portfolio split${currency === "EUR" ? " · €" : ""}`}
        description={`How your ${currency} savings are spread, invested vs. what they're worth now. Emergency funds not included.`}
        action={
          <span className="rounded-full bg-background px-3 py-1 text-xs font-bold uppercase text-muted">{monthLabel}</span>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
        <Donut
          title="Invested"
          slices={slicesFor(rows, (r) => r.invested, colorOf)}
          currency={currency}
          active={active}
          onActive={setActive}
        />
        <Donut
          title="Present"
          slices={slicesFor(rows, (r) => r.present, colorOf)}
          currency={currency}
          active={active}
          onActive={setActive}
        />

        {/* The figures behind both donuts: every saving, shares side by side. */}
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b-2 border-ink text-[10px] uppercase tracking-wide text-muted">
                <th scope="col" className="py-1.5 text-left">Saving</th>
                <th scope="col" className="py-1.5 text-right">Invested</th>
                <th scope="col" className="py-1.5 text-right">Present</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((r) => {
                const key = SERIES[r.order] ? String(r.id) : "other";
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-ink/10 ${active === key ? "bg-yellow/40" : ""}`}
                    onPointerEnter={() => setActive(key)}
                    onPointerLeave={() => setActive(null)}
                  >
                    <th scope="row" className="py-1.5 text-left font-bold">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: colorOf(r) }} />
                        <span className="truncate">{r.name}</span>
                      </span>
                    </th>
                    <td className="py-1.5 text-right">
                      <span className="private-value block font-bold">{compact(r.invested, currency)}</span>
                      <span className="text-muted">{fmtPct(share(r.invested, investedTotal))}</span>
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="private-value block font-bold">{compact(r.present, currency)}</span>
                      <span className="text-muted">{fmtPct(share(r.present, presentTotal))}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6">
        <GroupedBars rows={rows} currency={currency} />
      </div>
    </Card>
  );
}

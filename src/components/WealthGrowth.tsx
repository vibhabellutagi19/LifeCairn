"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { FINANCE_PRIVACY_KEY, PrivacyBlur } from "@/components/PrivacyBlur";
import { formatMoney } from "@/lib/format";

export type GrowthPoint = { month: string; invested: number; present: number };

const W = 640;
const H = 240;
const PAD = { top: 16, right: 16, bottom: 28, left: 16 };

function monthIndex(month: string) {
  const [y, m] = month.split("-").map(Number);
  return y * 12 + (m - 1);
}

function shortMonth(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

/** Compact amounts for axis-free labels: ₹52.4L, €12.3k. */
function compact(value: number, currency: string) {
  if (currency === "INR") {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(2)}Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  }
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-IE", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function signed(value: number, currency: string) {
  return `${value >= 0 ? "+" : "−"}${formatMoney(Math.abs(value), currency)}`;
}

/** Where the change between two snapshots came from: money put in vs. growth. */
function Breakdown({ from, to, currency, label }: { from: GrowthPoint; to: GrowthPoint; currency: string; label: string }) {
  const added = to.invested - from.invested;
  const growth = to.present - to.invested - (from.present - from.invested);
  const total = to.present - from.present;
  return (
    <div className="brut-border rounded-md bg-background p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className={clsx("private-value font-display text-xl font-bold", total < 0 && "text-pink")}>{signed(total, currency)}</p>
      <dl className="mt-1 space-y-0.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-muted">You put in</dt>
          <dd className="private-value font-bold">{signed(added, currency)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="font-semibold text-muted">Growth</dt>
          <dd className={clsx("private-value font-bold", growth >= 0 ? "text-green" : "text-pink")}>{signed(growth, currency)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Chart({ points, currency }: { points: GrowthPoint[]; currency: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const first = monthIndex(points[0].month);
  const last = monthIndex(points[points.length - 1].month);
  const span = Math.max(1, last - first);
  const max = Math.max(...points.flatMap((p) => [p.invested, p.present])) * 1.08;
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  // x follows the calendar, so a missing month leaves a visible gap.
  const x = (month: string) => PAD.left + ((monthIndex(month) - first) / span) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const path = (key: "invested" | "present") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.month).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
  const area = `${path("present")} L${x(points[points.length - 1].month).toFixed(1)},${y(0)} L${x(points[0].month).toFixed(1)},${y(0)} Z`;
  const ticks = points.length <= 6 ? points : [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const focus = hover !== null ? points[hover] : null;

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        Savings in {currency} from {shortMonth(points[0].month)} to {shortMonth(points[points.length - 1].month)}: worth{" "}
        {formatMoney(points[points.length - 1].present, currency)}, invested {formatMoney(points[points.length - 1].invested, currency)}.
      </figcaption>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-orange" /> Worth
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 border-t-2 border-dashed border-ink" /> Put in
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="private-value h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Savings growth in ${currency}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          let best = 0;
          points.forEach((p, i) => {
            if (Math.abs(x(p.month) - px) < Math.abs(x(points[best].month) - px)) best = i;
          });
          setHover(best);
        }}
      >
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={PAD.left} x2={W - PAD.right} y1={PAD.top + innerH * f} y2={PAD.top + innerH * f} stroke="var(--ink)" strokeOpacity={0.08} />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="var(--ink)" strokeWidth={2} />
        <path d={area} fill="var(--orange)" fillOpacity={0.1} />
        <path d={path("invested")} fill="none" stroke="var(--ink)" strokeWidth={2} strokeDasharray="6 5" strokeLinejoin="round" />
        <path d={path("present")} fill="none" stroke="var(--orange)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p) => (
          <circle key={p.month} cx={x(p.month)} cy={y(p.present)} r={3.5} fill="var(--orange)" stroke="var(--surface)" strokeWidth={1.5} />
        ))}
        {focus ? (
          <>
            <line x1={x(focus.month)} x2={x(focus.month)} y1={PAD.top} y2={y(0)} stroke="var(--ink)" strokeOpacity={0.4} strokeDasharray="2 3" />
            <circle cx={x(focus.month)} cy={y(focus.present)} r={6} fill="var(--surface)" stroke="var(--orange)" strokeWidth={2.5} />
          </>
        ) : null}
        {ticks.map((p, i) => (
          <text
            key={p.month}
            x={x(p.month)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
            className="fill-muted text-[11px] font-bold"
          >
            {shortMonth(p.month)}
          </text>
        ))}
        <text x={x(points[points.length - 1].month)} y={y(points[points.length - 1].present) - 10} textAnchor="end" className="fill-ink text-[12px] font-bold">
          {compact(points[points.length - 1].present, currency)}
        </text>
      </svg>
      {focus ? (
        <div
          className="brut-border brut-shadow-sm pointer-events-none absolute top-8 z-10 rounded-md bg-surface px-3 py-2 text-xs"
          style={{
            left: `${(x(focus.month) / W) * 100}%`,
            transform: `translateX(${x(focus.month) > W / 2 ? "calc(-100% - 10px)" : "10px"})`,
          }}
        >
          <p className="font-bold">{shortMonth(focus.month)}</p>
          <p className="font-semibold text-muted">
            Worth <span className="private-value font-bold text-ink">{formatMoney(focus.present, currency)}</span>
          </p>
          <p className="font-semibold text-muted">
            Put in <span className="private-value font-bold text-ink">{formatMoney(focus.invested, currency)}</span>
          </p>
          <p className="font-semibold text-muted">
            Growth{" "}
            <span className={clsx("private-value font-bold", focus.present >= focus.invested ? "text-green" : "text-pink")}>
              {signed(focus.present - focus.invested, currency)}
            </span>
          </p>
        </div>
      ) : null}
    </figure>
  );
}

/** Savings over time per currency, and how much of the change was money put in vs. growth. */
export function WealthGrowth({ series }: { series: { currency: string; points: GrowthPoint[] }[] }) {
  const usable = series.filter((s) => s.points.length > 0);
  const [currency, setCurrency] = useState(usable[0]?.currency ?? "INR");
  const current = usable.find((s) => s.currency === currency) ?? usable[0];
  if (!current) return null;
  const { points } = current;
  const lastTwo = points.length >= 2 ? [points[points.length - 2], points[points.length - 1]] : null;

  return (
    <Card>
      <PrivacyBlur
        storageKey={FINANCE_PRIVACY_KEY}
        label="growth amounts"
        title="How your savings grew"
        description="Every snapshot, everything included. Gaps are months without a snapshot."
      >
        {usable.length > 1 ? (
          <div className="mb-3 flex gap-1" role="tablist" aria-label="Currency">
            {usable.map((s) => (
              <button
                key={s.currency}
                type="button"
                role="tab"
                aria-selected={s.currency === current.currency}
                onClick={() => setCurrency(s.currency)}
                className={clsx(
                  "brut-border rounded-md px-3 py-1 text-xs font-bold uppercase",
                  s.currency === current.currency ? "bg-ink text-surface" : "bg-surface hover:bg-yellow"
                )}
              >
                {s.currency}
              </button>
            ))}
          </div>
        ) : null}

        {points.length >= 2 ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <Chart points={points} currency={current.currency} />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Breakdown
                from={points[0]}
                to={points[points.length - 1]}
                currency={current.currency}
                label={`Since ${shortMonth(points[0].month)}`}
              />
              {lastTwo ? (
                <Breakdown
                  from={lastTwo[0]}
                  to={lastTwo[1]}
                  currency={current.currency}
                  label={`${shortMonth(lastTwo[0].month)} → ${shortMonth(lastTwo[1].month)}`}
                />
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm font-semibold text-muted">Save a second monthly snapshot to see growth over time.</p>
        )}
      </PrivacyBlur>
    </Card>
  );
}

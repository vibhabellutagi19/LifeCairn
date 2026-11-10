"use client";

import { useState } from "react";
import { formatEUR } from "@/lib/format";

const W = 640;
const H = 220;
const PAD = { top: 14, right: 14, bottom: 26, left: 14 };

/**
 * Cumulative spending through the month against income. One € axis.
 * `daily[i]` is what was spent on day i+1; `uptoDay` is the last day with data
 * (today for the current month), after which a dashed projection continues.
 */
export function PaceChart({
  daily,
  income,
  uptoDay,
  monthLabel,
}: {
  daily: number[];
  income: number;
  uptoDay: number;
  monthLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const days = daily.length;
  const cumulative: number[] = [];
  daily.forEach((v, i) => cumulative.push((cumulative[i - 1] ?? 0) + v));
  const spentSoFar = cumulative[uptoDay - 1] ?? 0;
  const projected = uptoDay > 0 ? (spentSoFar / uptoDay) * days : 0;
  const showProjection = uptoDay < days && spentSoFar > 0;
  const yMax = Math.max(income, showProjection ? projected : 0, cumulative[days - 1] ?? 0, 1) * 1.1;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + (days <= 1 ? 0 : ((day - 1) / (days - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - (value / yMax) * innerH;
  const baseline = y(0);

  const actual = cumulative.slice(0, uptoDay);
  const linePath = actual.map((v, i) => `${i === 0 ? "M" : "L"}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const areaPath = actual.length
    ? `${linePath} L${x(actual.length).toFixed(1)},${baseline} L${x(1).toFixed(1)},${baseline} Z`
    : "";
  const ticks = [1, Math.ceil(days / 2), days];
  const hovered = hover !== null && hover <= uptoDay ? hover : null;

  return (
    <figure className="relative">
      <figcaption className="sr-only">
        Cumulative spending in {monthLabel}: {formatEUR(spentSoFar)} by day {uptoDay} of {days}, against income of{" "}
        {formatEUR(income)}.
      </figcaption>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted" aria-hidden>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-5 rounded-full bg-pink" /> Spent so far
        </span>
        {showProjection ? (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-pink" /> At this pace
          </span>
        ) : null}
        {income > 0 ? (
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-blue" /> Income
          </span>
        ) : null}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full touch-none select-none"
        role="img"
        aria-label={`Spending pace for ${monthLabel}`}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - rect.left) / rect.width) * W;
          const day = Math.round(((px - PAD.left) / innerW) * (days - 1)) + 1;
          setHover(Math.min(days, Math.max(1, day)));
        }}
      >
        {/* recessive grid */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={W - PAD.right}
            y1={PAD.top + innerH * f}
            y2={PAD.top + innerH * f}
            stroke="var(--ink)"
            strokeOpacity={0.08}
          />
        ))}
        <line x1={PAD.left} x2={W - PAD.right} y1={baseline} y2={baseline} stroke="var(--ink)" strokeWidth={2} />

        {income > 0 ? (
          <>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(income)}
              y2={y(income)}
              stroke="var(--blue)"
              strokeWidth={2}
              strokeDasharray="6 5"
            />
            <text x={W - PAD.right} y={y(income) - 6} textAnchor="end" className="fill-ink text-[11px] font-bold">
              Income {formatEUR(income)}
            </text>
          </>
        ) : null}

        {areaPath ? <path d={areaPath} fill="var(--pink)" fillOpacity={0.1} /> : null}
        {showProjection ? (
          <line
            x1={x(uptoDay)}
            y1={y(spentSoFar)}
            x2={x(days)}
            y2={y(projected)}
            stroke="var(--pink)"
            strokeWidth={2}
            strokeDasharray="5 5"
            strokeOpacity={0.7}
          />
        ) : null}
        {linePath ? (
          <path d={linePath} fill="none" stroke="var(--pink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {uptoDay > 0 ? (
          <circle cx={x(uptoDay)} cy={y(spentSoFar)} r={5} fill="var(--pink)" stroke="var(--surface)" strokeWidth={2} />
        ) : null}

        {hovered !== null ? (
          <>
            <line
              x1={x(hovered)}
              x2={x(hovered)}
              y1={PAD.top}
              y2={baseline}
              stroke="var(--ink)"
              strokeOpacity={0.4}
              strokeDasharray="2 3"
            />
            <circle cx={x(hovered)} cy={y(cumulative[hovered - 1])} r={5} fill="var(--surface)" stroke="var(--pink)" strokeWidth={2.5} />
          </>
        ) : null}

        {ticks.map((day) => (
          <text
            key={day}
            x={x(day)}
            y={H - 6}
            textAnchor={day === 1 ? "start" : day === days ? "end" : "middle"}
            className="fill-muted text-[11px] font-bold"
          >
            Day {day}
          </text>
        ))}
      </svg>

      {hovered !== null ? (
        <div
          className="brut-border brut-shadow-sm pointer-events-none absolute top-8 z-10 rounded-md bg-surface px-3 py-2 text-xs"
          style={{
            left: `${(x(hovered) / W) * 100}%`,
            transform: `translateX(${hovered > days / 2 ? "calc(-100% - 10px)" : "10px"})`,
          }}
        >
          <p className="font-bold">Day {hovered}</p>
          <p className="font-semibold text-muted">
            Spent that day <span className="font-bold text-ink">{formatEUR(daily[hovered - 1])}</span>
          </p>
          <p className="font-semibold text-muted">
            Total so far <span className="font-bold text-ink">{formatEUR(cumulative[hovered - 1])}</span>
          </p>
        </div>
      ) : null}
    </figure>
  );
}

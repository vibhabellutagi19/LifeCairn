"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Card } from "@/components/ui";
import { CardHeader } from "@/components/FinanceHeadings";

type View = "calendar" | "pace";

const COPY: Record<View, { title: string; description: string }> = {
  calendar: { title: "Where the days went", description: "Each day shaded by what you spent. Tap one to see its expenses." },
  pace: { title: "Spending pace", description: "What you've spent so far, day by day, against what came in." },
};

/** This month, day by day: the spending calendar or the pace chart, one card. */
export function DayViews({ calendar, pace }: { calendar: React.ReactNode; pace: React.ReactNode }) {
  const [view, setView] = useState<View>("calendar");
  return (
    <Card className="brut-shadow">
      <CardHeader
        className="mb-3"
        title={COPY[view].title}
        description={COPY[view].description}
        action={
          <div role="tablist" aria-label="Show the month as" className="flex overflow-hidden rounded-md border-2 border-ink">
            {(["calendar", "pace"] as const).map((v, i) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={clsx(
                  "min-h-9 px-3 text-xs font-bold uppercase tracking-wide",
                  i > 0 && "border-l-2 border-ink",
                  view === v ? "bg-ink text-surface" : "bg-surface hover:bg-yellow"
                )}
              >
                {v === "calendar" ? "Calendar" : "Pace"}
              </button>
            ))}
          </div>
        }
      />
      <div role="tabpanel">{view === "calendar" ? calendar : pace}</div>
    </Card>
  );
}

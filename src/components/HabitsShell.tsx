"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { createHabit } from "@/lib/actions/habits";

/**
 * Phones get a Today / Month switch and a "+" button that opens an add-habit sheet;
 * from `md` up both views are shown, one after the other, and the sheet opens as a dialog.
 */
export function HabitsShell({
  today,
  month,
  roadmaps,
}: {
  today: React.ReactNode;
  month: React.ReactNode;
  roadmaps: { id: number; title: string }[];
}) {
  const [tab, setTab] = useState<"today" | "month">("today");
  const sheetRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const openSheet = () => {
    sheetRef.current?.showModal();
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  return (
    <>
      <div className="hab-tabs mb-4 md:hidden" role="tablist" aria-label="Habit view" style={{ "--tab": tab === "today" ? 0 : 1 } as React.CSSProperties}>
        <span aria-hidden className="hab-tab-pill" />
        {(["today", "month"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={clsx("hab-tab", tab === value && "is-active")}
          >
            {value === "today" ? "☀️ Today" : "🗓 Month"}
          </button>
        ))}
      </div>

      <div className="hab-section-head">
        <h2 className="font-display text-2xl font-bold">
          <span className="home-marker is-always">☀️ Check in</span>
        </h2>
        <button type="button" onClick={openSheet} className="hab-new-btn">
          + New habit
        </button>
      </div>
      <div className={clsx(tab === "today" ? "block" : "hidden", "md:block")}>{today}</div>

      <div className="hab-section-head mt-10">
        <h2 className="font-display text-2xl font-bold">
          <span className="home-marker is-always">🗓 The month at a glance</span>
        </h2>
      </div>
      <div className={clsx(tab === "month" ? "block" : "hidden", "md:block")}>{month}</div>

      <button
        type="button"
        onClick={openSheet}
        aria-label="Add a habit"
        className="hab-fab md:hidden"
      >
        +
      </button>

      <dialog
        ref={sheetRef}
        aria-label="Add a habit"
        className="hab-sheet"
        onClick={(event) => {
          if (event.target === event.currentTarget) sheetRef.current?.close();
        }}
      >
        <form
          action={async (formData) => {
            await createHabit(formData);
            sheetRef.current?.close();
          }}
          className="space-y-3 p-5 pb-8"
        >
          <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/20" aria-hidden />
          <h2 className="font-display text-2xl font-bold">New habit</h2>
          <input ref={titleRef} name="title" required placeholder="e.g. 10 min stretch" aria-label="Habit name" className="hab-input" />
          <select name="roadmapId" defaultValue="" aria-label="Roadmap" className="hab-input">
            <option value="">No roadmap</option>
            {roadmaps.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
            Monthly goal: days (optional)
            <input type="number" name="targetDays" inputMode="numeric" min={1} max={31} placeholder="e.g. 20" className="hab-input mt-1 normal-case" />
          </label>
          <label className="block text-[11px] font-bold uppercase tracking-wide text-muted">
            Ends (optional)
            <input type="date" name="endDate" className="hab-input mt-1 normal-case" />
          </label>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button type="button" onClick={() => sheetRef.current?.close()} className="hab-btn bg-surface">
              Cancel
            </button>
            <button type="submit" className="hab-btn bg-orange text-white">
              Add habit
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

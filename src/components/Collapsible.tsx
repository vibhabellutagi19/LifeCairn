"use client";

import { useState } from "react";
import { clsx } from "clsx";

export function Collapsible({
  title,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="brut-border rounded-md bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-yellow/30"
      >
        <span className="text-sm font-bold text-ink">{title}</span>
        <span className="flex items-center gap-2 text-xs font-bold text-ink/70">
          <span className="rounded-full bg-surface px-2 py-0.5">{count}</span>
          <span
            className={clsx("inline-block transition-transform", open && "rotate-90")}
            aria-hidden
          >
            &#9656;
          </span>
        </span>
      </button>
      <div
        className={clsx(
          "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

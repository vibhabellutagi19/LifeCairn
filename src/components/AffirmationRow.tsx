"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import {
  deleteAffirmation,
  setAffirmationSubcategory,
  toggleAffirmationActive,
} from "@/lib/actions/affirmations";
import { AFFIRMATION_SUBCATEGORIES } from "@/lib/affirmationSubcategories";
import { EditAffirmationModal } from "@/components/EditAffirmationModal";
import { CelebrateAffirmationModal } from "@/components/CelebrateAffirmationModal";
import { affirmationLines } from "@/lib/affirmationText";
import { burstConfetti } from "@/lib/confetti";

export function AffirmationRow({
  id,
  text,
  category,
  active,
  subcategory,
  manifested,
  today,
}: {
  id: number;
  text: string;
  category: string;
  active: boolean;
  subcategory: string | null;
  manifested: boolean;
  today: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="aff-row brut-border flex flex-wrap items-start gap-3 rounded-md bg-surface p-4 sm:flex-nowrap sm:gap-4">
      <button
        type="button"
        aria-label={manifested ? "Manifested" : active ? "Deactivate" : "Activate"}
        disabled={isPending || manifested}
        onClick={(event) => {
          if (!active) burstConfetti(event.currentTarget, 10, ["✦", "✨"]);
          startTransition(() => {
            toggleAffirmationActive(id, !active);
          });
        }}
        className={clsx(
          "check-pop brut-border flex h-11 w-11 shrink-0 items-center justify-center rounded text-sm font-bold sm:mt-0.5 sm:h-7 sm:w-7",
          manifested ? "bg-yellow text-ink" : active ? "bg-orange text-white" : "bg-surface"
        )}
      >
        {manifested ? "✨" : active ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        {(() => {
          const lines = affirmationLines(text);
          const textClass = clsx(
            "text-base font-semibold leading-7 text-ink md:text-lg",
            !active && !manifested && "text-muted line-through",
            manifested && "text-ink/75"
          );
          return lines.length > 1 ? (
            <ul className={clsx(textClass, "space-y-1")}>
              {lines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-sm text-orange">✦</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={textClass}>{text}</p>
          );
        })()}
        {manifested ? (
          <span className="mt-2 inline-flex rounded-full bg-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            Manifested
          </span>
        ) : null}
        <select
          suppressHydrationWarning
          disabled={isPending}
          value={subcategory ?? ""}
          onChange={(e) =>
            startTransition(() => {
              setAffirmationSubcategory(id, e.target.value);
            })
          }
          className="mt-2 min-h-11 border-b border-dashed border-ink/40 bg-transparent py-1 text-base font-bold uppercase tracking-wide text-ink/70 focus:border-orange focus:outline-none sm:min-h-0 sm:text-xs"
        >
          <option value="">No subcategory</option>
          {AFFIRMATION_SUBCATEGORIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="ml-14 flex w-full shrink-0 items-center justify-end gap-2 border-t border-ink/10 pt-2 sm:ml-0 sm:w-auto sm:border-0 sm:pt-0">
        {!manifested ? (
          <CelebrateAffirmationModal
            id={id}
            text={text}
            defaultDate={today}
            compact
          />
        ) : null}
        <EditAffirmationModal
          id={id}
          text={text}
          category={category}
          subcategory={subcategory}
        />
        <button
          type="button"
          aria-label="Delete affirmation"
          disabled={isPending}
          className="flex h-11 w-11 items-center justify-center text-muted hover:text-pink disabled:opacity-50 sm:h-10 sm:w-10"
          onClick={() =>
            startTransition(() => {
              deleteAffirmation(id);
            })
          }
        >
          ✕
        </button>
      </div>
    </div>
  );
}

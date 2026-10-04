"use client";

import { useId, useRef, useTransition } from "react";
import { Button, Input, Textarea } from "@/components/ui";
import { celebrateAffirmation } from "@/lib/actions/affirmations";

export function CelebrateAffirmationModal({
  id,
  text,
  defaultDate,
  compact = false,
}: {
  id: number;
  text: string;
  defaultDate: string;
  compact?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [isPending, startTransition] = useTransition();

  const close = () => dialogRef.current?.close();

  return (
    <>
      <Button
        type="button"
        variant="yellow"
        size="sm"
        aria-label="Celebrate this manifestation"
        title={compact ? "Mark as manifested" : undefined}
        className={compact ? "h-11 w-11 !p-0 text-base sm:h-9 sm:w-9" : undefined}
        onClick={() => dialogRef.current?.showModal()}
      >
        <span aria-hidden>✨</span>
        {compact ? null : "I manifested this"}
      </Button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[90vh] w-[min(92vw,38rem)] overflow-y-auto rounded-lg bg-transparent p-0 backdrop:bg-ink/60"
        onCancel={(event) => {
          if (isPending) event.preventDefault();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !isPending) close();
        }}
      >
        <div className="brut-border brut-shadow overflow-hidden rounded-lg bg-surface">
          <div className="bg-gradient-to-r from-yellow to-orange/40 px-5 py-6 text-center">
            <span className="text-4xl" aria-hidden>🎉</span>
            <h2 id={titleId} className="mt-2 font-display text-2xl font-bold">
              Celebrate this manifestation
            </h2>
            <p className="mt-2 font-display text-lg font-semibold leading-relaxed text-ink/80">
              “{text}”
            </p>
          </div>

          <form
            className="space-y-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                await celebrateAffirmation(id, formData);
                close();
              });
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-date`}>
                Manifested on
              </label>
              <Input
                id={`${titleId}-date`}
                type="date"
                name="manifestedOn"
                defaultValue={defaultDate}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wide" htmlFor={`${titleId}-reflection`}>
                What happened? <span className="normal-case text-muted">(optional)</span>
              </label>
              <Textarea
                id={`${titleId}-reflection`}
                name="reflection"
                rows={4}
                placeholder="Capture the moment, the outcome, or how it felt..."
                className="text-base leading-relaxed"
              />
            </div>
            <p className="rounded-md bg-yellow/30 p-3 text-sm font-semibold text-ink/75">
              This affirmation will move out of your active deck and into your celebration history.
            </p>
            <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
              <Button type="button" variant="ghost" disabled={isPending} onClick={close}>
                Not yet
              </Button>
              <Button type="submit" variant="pink" disabled={isPending}>
                {isPending ? "Celebrating..." : "Celebrate 🎉"}
              </Button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

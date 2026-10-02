import { Card, EmptyState } from "@/components/ui";
import { formatDateLong } from "@/lib/format";

export function ManifestationHistory({
  celebrations,
}: {
  celebrations: {
    id: number;
    affirmationText: string;
    category: string;
    subcategory: string | null;
    manifestedOn: string;
    reflection: string | null;
  }[];
}) {
  return (
    <Card className="mt-8 overflow-hidden bg-gradient-to-br from-pink/10 via-surface to-yellow/30">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow text-2xl" aria-hidden>
            🎉
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink">Your wins</p>
            <h2 className="font-display text-2xl font-bold">Celebrations</h2>
            <p className="text-sm font-semibold text-muted">
              A history of affirmations that became real.
            </p>
          </div>
        </div>
        <span className="rounded-full bg-pink px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          {celebrations.length} manifested
        </span>
      </div>

      {celebrations.length === 0 ? (
        <EmptyState>
          When an affirmation manifests, celebrate it here and keep the story of that moment.
        </EmptyState>
      ) : (
        <div className="grid max-h-[520px] grid-cols-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
          {celebrations.map((celebration, index) => (
            <article
              key={celebration.id}
              className="affirmation-enter rounded-xl border-2 border-ink/15 bg-surface p-5 shadow-[3px_3px_0_0_var(--ink)]"
              style={{ animationDelay: `${Math.min(index * 65, 325)}ms` }}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="rounded-full bg-yellow px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
                  {celebration.category}
                </span>
                <time className="text-xs font-bold text-muted" dateTime={celebration.manifestedOn}>
                  {formatDateLong(celebration.manifestedOn)}
                </time>
              </div>
              <blockquote className="font-display text-lg font-semibold leading-relaxed text-ink">
                “{celebration.affirmationText}”
              </blockquote>
              {celebration.subcategory ? (
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-orange">
                  {celebration.subcategory}
                </p>
              ) : null}
              {celebration.reflection ? (
                <p className="mt-4 border-t-2 border-ink/10 pt-3 text-sm font-medium leading-6 text-ink/75">
                  {celebration.reflection}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}

// The two heading levels used on the Finance page, so every section and card
// is titled the same way. No hooks: safe in server and client components.

const SECTION_COLORS = {
  blue: "bg-blue text-white",
  pink: "bg-pink text-white",
  orange: "bg-orange text-white",
} as const;

/** A page section: numbered badge, title, one-line description, actions on the right. */
export function SectionHeader({
  id,
  index,
  color,
  title,
  description,
  action,
}: {
  id: string;
  index: number;
  color: keyof typeof SECTION_COLORS;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header
      id={id}
      className="mb-4 flex scroll-mt-48 md:scroll-mt-24 flex-wrap items-end justify-between gap-3 border-b-[3px] border-ink pb-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={`brut-border brut-shadow-sm flex h-11 w-11 shrink-0 items-center justify-center rounded-md font-display text-lg font-bold ${SECTION_COLORS[color]}`}
        >
          {String(index).padStart(2, "0")}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">{title}</h2>
          <p className="text-sm font-semibold text-muted">{description}</p>
        </div>
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </header>
  );
}

/** A card's title row. Same size everywhere; optional description and right-hand slot. */
export function CardHeader({
  title,
  description,
  action,
  className = "mb-4",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-bold leading-tight">{title}</h3>
        {description ? <p className="mt-0.5 text-sm font-semibold text-muted">{description}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  );
}

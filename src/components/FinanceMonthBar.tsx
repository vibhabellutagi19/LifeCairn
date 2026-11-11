import Link from "next/link";
import Form from "next/form";
import { Button, Input } from "@/components/ui";
import { currentMonthKey, shiftMonthKey } from "@/lib/dates";
import { financeHref, formatMonthLabel } from "@/lib/financeView";

/**
 * Sticky bar shared by /finance and /finance/wealth: the month being viewed
 * (with prev/next and a picker) on the left, page-specific links on the right.
 * Sits under the mobile app header (4rem) on small screens, where it stays one
 * row: the section links are hidden and only `mobileAction` is shown.
 */
export function FinanceMonthBar({
  month,
  path,
  mobileAction,
  children,
}: {
  month: string;
  /** The page the arrows and picker stay on. */
  path: "/finance" | "/finance/wealth";
  /** The one link kept on phones (e.g. to the other finance page). */
  mobileAction?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const isCurrent = month === currentMonthKey();
  const prev = shiftMonthKey(month, -1);
  const next = shiftMonthKey(month, 1);
  const arrow =
    "brut-border flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-surface text-xl font-bold hover:bg-yellow";
  const monthName = formatMonthLabel(month);

  return (
    <div className="sticky top-16 z-20 -mx-4 mb-8 border-y-[3px] border-ink bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-0 md:-mx-10 md:px-10">
      <div className="flex items-center justify-between gap-x-4 gap-y-2 sm:flex-wrap">
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
          <Link href={financeHref(prev, path)} aria-label={`Previous month, ${formatMonthLabel(prev)}`} className={arrow}>
            ‹
          </Link>
          <div className="min-w-[6.5rem] text-center sm:min-w-[9.5rem]">
            <p className="text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-muted">
              {isCurrent ? "This month" : (
                <Link href={path} className="text-blue hover:underline sm:pointer-events-none sm:text-muted">
                  <span className="sm:hidden">Back to today</span>
                  <span className="hidden sm:inline">Viewing</span>
                </Link>
              )}
            </p>
            <p className="font-display text-lg font-bold leading-tight sm:text-xl">
              <span className="sm:hidden">{monthName.replace(/ (\d{2})(\d{2})$/, " ’$2")}</span>
              <span className="hidden sm:inline">{monthName}</span>
            </p>
          </div>
          <Link href={financeHref(next, path)} aria-label={`Next month, ${formatMonthLabel(next)}`} className={arrow}>
            ›
          </Link>
          {!isCurrent ? (
            <Link href={path} className="hidden px-1 text-xs font-bold uppercase tracking-wide text-blue hover:underline sm:inline">
              Today
            </Link>
          ) : null}
          <Form action={path} className="ml-1 hidden items-center gap-1 lg:flex">
            <Input
              type="month"
              name="month"
              aria-label="Jump to month"
              defaultValue={month}
              required
              className="min-h-10 w-auto py-1"
            />
            <Button type="submit" variant="ghost" size="sm">Go</Button>
          </Form>
        </div>
        {mobileAction ? <div className="shrink-0 sm:hidden">{mobileAction}</div> : null}
        {children ? (
          <nav aria-label="Finance sections" className="hidden flex-wrap items-center gap-1 sm:flex">
            {children}
          </nav>
        ) : null}
      </div>
    </div>
  );
}

import Link from "next/link";
import { clsx } from "clsx";

/** Overview / Settings switcher shown at the top of both circle pages. */
export function CircleTabs({ circleId, active }: { circleId: number; active: "overview" | "settings" }) {
  const tabs = [
    { key: "overview", label: "Overview", href: `/circles/${circleId}` },
    { key: "settings", label: "Settings", href: `/circles/${circleId}/settings` },
  ] as const;
  return (
    <nav aria-label="Circle sections" className="mb-6 flex gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.key === active ? "page" : undefined}
          className={clsx(
            "brut-border brut-press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold sm:min-h-0 sm:py-1.5",
            tab.key === active ? "bg-ink text-white" : "bg-surface hover:bg-yellow/60"
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

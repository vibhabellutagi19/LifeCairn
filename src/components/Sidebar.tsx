"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", emoji: "🏠" },
  { href: "/roadmaps", label: "Roadmaps", emoji: "🗺️" },
  { href: "/projects", label: "Projects", emoji: "🧩" },
  { href: "/habits", label: "Habit Tracker", emoji: "🔥" },
  { href: "/pomodoro", label: "Pomodoro", emoji: "🍅" },
  { href: "/manifestation", label: "Manifestation", emoji: "◌" },
  { href: "/finance", label: "Finance", emoji: "💰" },
  { href: "/review", label: "Review", emoji: "📊" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileOpen]);

  const navLinks = (mobile = false) => NAV_ITEMS.map((item) => {
    const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-label={!mobile && collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        title={!mobile && collapsed ? item.label : undefined}
        onClick={mobile ? () => setMobileOpen(false) : undefined}
        className={clsx(
          "brut-border brut-shadow-sm brut-press flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-bold",
          !mobile && collapsed && "justify-center px-2",
          active ? "bg-orange text-white" : "bg-surface hover:bg-yellow"
        )}
      >
        <span aria-hidden className="text-lg">{item.emoji}</span>
        {mobile || !collapsed ? item.label : null}
      </Link>
    );
  });

  return (
    <>
      <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between border-b-3 border-ink bg-surface px-4 py-2 md:hidden">
        <Link href="/" className="min-w-0" onClick={() => setMobileOpen(false)}>
          <span className="block truncate font-display text-xl font-bold tracking-tight">THE ROADMAP</span>
          <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">
            Oct &rarr; Dec 2026
          </span>
        </Link>
        <button
          type="button"
          aria-label="Open navigation"
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen(true)}
          className="brut-border brut-shadow-sm brut-press flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-yellow"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/55"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            id="mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
            className="mobile-drawer-enter absolute inset-y-0 right-0 flex w-[min(88vw,22rem)] flex-col border-l-3 border-ink bg-background shadow-[-6px_0_0_0_var(--ink)]"
          >
            <div className="flex items-start justify-between gap-4 border-b-3 border-ink bg-surface p-4">
              <div>
                <p className="font-display text-2xl font-bold">Navigate</p>
                <p className="text-xs font-semibold text-muted">Where do you want to go?</p>
              </div>
              <button
                type="button"
                autoFocus
                aria-label="Close navigation"
                onClick={() => setMobileOpen(false)}
                className="brut-border flex h-11 w-11 items-center justify-center rounded-md bg-yellow text-xl font-bold"
              >
                ✕
              </button>
            </div>
            <nav className="flex-1 space-y-2 overflow-y-auto p-4" aria-label="Primary navigation">
              {navLinks(true)}
            </nav>
          </aside>
        </div>
      ) : null}

      <aside
        className={clsx(
          "sticky top-0 hidden h-screen shrink-0 border-r-3 border-ink bg-surface transition-[width] duration-200 md:block",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className={clsx("flex items-start gap-3", collapsed ? "justify-center p-3" : "justify-between p-6")}>
          {!collapsed ? (
            <Link href="/" className="block min-w-0">
              <span className="font-display text-2xl font-bold tracking-tight">THE ROADMAP</span>
              <span className="mt-1 block text-xs font-semibold uppercase tracking-widest text-muted">
                Oct &rarr; Dec 2026
              </span>
            </Link>
          ) : null}
          <button
            type="button"
            aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
            aria-expanded={!collapsed}
            title={collapsed ? "Open sidebar" : "Close sidebar"}
            onClick={() => setCollapsed((value) => !value)}
            className="brut-border brut-shadow-sm brut-press flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-yellow text-xl font-bold"
          >
            <span aria-hidden>{collapsed ? "›" : "‹"}</span>
          </button>
        </div>
        <nav
          aria-label="Primary navigation"
          className={clsx("flex flex-col gap-2 pb-6", collapsed ? "px-2" : "px-4")}
        >
          {navLinks()}
        </nav>
      </aside>
    </>
  );
}

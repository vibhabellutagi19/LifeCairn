"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import { UserButton } from "@clerk/nextjs";
import { Logo } from "@/components/Logo";
import { MODULES, type ModuleKey } from "@/lib/modules";

const NAV_ITEMS: { href: string; label: string; emoji: string; module?: ModuleKey }[] = [
  { href: "/", label: "Dashboard", emoji: "🏠" },
  ...MODULES.map((m) => ({
    href: m.href,
    label: m.label,
    emoji: m.emoji,
    module: m.key,
  })),
  { href: "/circles", label: "Circles", emoji: "🫂" },
  { href: "/profile", label: "Profile", emoji: "👤" },
];

export function Sidebar({ disabledModules }: { disabledModules: ModuleKey[] }) {
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

  const visibleItems = NAV_ITEMS.filter((item) => !item.module || !disabledModules.includes(item.module));

  const navLinks = (mobile = false) => visibleItems.map((item) => {
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
        <Link href="/" className="flex min-w-0 items-center gap-2.5" onClick={() => setMobileOpen(false)}>
          <Logo className="h-8 w-8 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate font-display text-xl font-bold tracking-tight">LIFECAIRN</span>
            <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted">
              Oct &rarr; Dec 2026
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
        <UserButton />
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
        </div>
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
          "sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r-3 border-ink bg-surface transition-[width] duration-200 md:flex",
          collapsed ? "w-[76px]" : "w-64"
        )}
      >
        <div className={clsx("flex shrink-0 items-start gap-3", collapsed ? "justify-center p-3" : "justify-between p-6")}>
          {!collapsed ? (
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <Logo className="h-9 w-9 shrink-0" />
              <span className="min-w-0">
                <span className="block font-display text-2xl font-bold tracking-tight">LIFECAIRN</span>
                <span className="mt-1 block text-xs font-semibold uppercase tracking-widest text-muted">
                  Oct &rarr; Dec 2026
                </span>
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
          className={clsx("flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-4", collapsed ? "px-2" : "px-4")}
        >
          {navLinks()}
        </nav>
        <div className={clsx("flex min-w-0 shrink-0 items-center border-t-3 border-ink p-4", collapsed && "justify-center px-2")}>
          <UserButton showName={!collapsed} />
        </div>
      </aside>
    </>
  );
}

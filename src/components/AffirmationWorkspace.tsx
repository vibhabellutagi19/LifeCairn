"use client";

import { useEffect, useMemo, useState } from "react";
import { clsx } from "clsx";
import { AffirmationRow } from "@/components/AffirmationRow";
import { CelebrateAffirmationModal } from "@/components/CelebrateAffirmationModal";
import { Collapsible } from "@/components/Collapsible";
import { Button, Card, EmptyState } from "@/components/ui";

type AffirmationItem = {
  id: number;
  text: string;
  category: string;
  subcategory: string | null;
  active: boolean;
  manifested: boolean;
};

const ALL = "__all__";
const NO_SUBCATEGORY = "__none__";
const SLIDE_INTERVAL_MS = 10_000;

function subcategoryKey(item: AffirmationItem) {
  return item.subcategory || NO_SUBCATEGORY;
}

function subcategoryLabel(value: string) {
  return value === NO_SUBCATEGORY ? "Other" : value;
}

export function AffirmationWorkspace({
  affirmations,
  today,
}: {
  affirmations: AffirmationItem[];
  today: string;
}) {
  const [category, setCategory] = useState(ALL);
  const [subcategory, setSubcategory] = useState(ALL);
  const [activeIndex, setActiveIndex] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [deckHovered, setDeckHovered] = useState(false);
  const [deckFocused, setDeckFocused] = useState(false);

  const categories = useMemo(
    () => [...new Set(affirmations.map((item) => item.category))].sort(),
    [affirmations]
  );

  const subcategories = useMemo(() => {
    const matchingCategory = category === ALL
      ? affirmations
      : affirmations.filter((item) => item.category === category);
    return [...new Set(matchingCategory.map(subcategoryKey))].sort((a, b) =>
      subcategoryLabel(a).localeCompare(subcategoryLabel(b))
    );
  }, [affirmations, category]);

  const filtered = useMemo(
    () => affirmations.filter((item) => {
      const categoryMatches = category === ALL || item.category === category;
      const subcategoryMatches = subcategory === ALL || subcategoryKey(item) === subcategory;
      return categoryMatches && subcategoryMatches;
    }),
    [affirmations, category, subcategory]
  );

  const activeAffirmations = filtered.filter((item) => item.active && !item.manifested);
  const safeActiveIndex = activeAffirmations.length > 0
    ? activeIndex % activeAffirmations.length
    : 0;
  const currentAffirmation = activeAffirmations[safeActiveIndex];
  const grouped = filtered.reduce<Record<string, Record<string, AffirmationItem[]>>>((groups, item) => {
    groups[item.category] ??= {};
    const sub = subcategoryKey(item);
    groups[item.category][sub] ??= [];
    groups[item.category][sub].push(item);
    return groups;
  }, {});
  const hasFilters = category !== ALL || subcategory !== ALL;
  const slideshowRunning = autoPlay && !deckHovered && !deckFocused;

  useEffect(() => {
    if (!slideshowRunning || activeAffirmations.length < 2) return;

    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % activeAffirmations.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [activeAffirmations.length, safeActiveIndex, slideshowRunning]);

  const moveDeck = (direction: number) => {
    if (activeAffirmations.length === 0) return;
    setActiveIndex(
      (safeActiveIndex + direction + activeAffirmations.length) % activeAffirmations.length
    );
  };

  const shuffleDeck = () => {
    if (activeAffirmations.length < 2) return;
    const randomIndex = Math.floor(Math.random() * (activeAffirmations.length - 1));
    setActiveIndex(randomIndex >= safeActiveIndex ? randomIndex + 1 : randomIndex);
  };

  return (
    <>
      <Card className="mb-6 bg-yellow/20">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange">Choose what you need today</p>
            <h2 className="font-display text-xl font-bold">Shape your practice</h2>
            <p className="mt-1 text-sm font-semibold text-ink/70">
              Choose a category, then narrow it to a subcategory.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink">
              {filtered.length} matching
            </span>
            {hasFilters ? (
              <button
                type="button"
                className="text-xs font-bold uppercase tracking-wide text-blue hover:underline"
                onClick={() => {
                  setCategory(ALL);
                  setSubcategory(ALL);
                  setActiveIndex(0);
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/70">Category</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
            {[ALL, ...categories].map((value) => {
              const selected = category === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setCategory(value);
                    setSubcategory(ALL);
                    setActiveIndex(0);
                  }}
                  className={clsx(
                    "brut-border rounded-full px-3 py-1.5 text-xs font-bold transition duration-200",
                    selected
                      ? "-translate-y-0.5 bg-orange text-white shadow-[2px_2px_0_0_var(--ink)]"
                      : "bg-surface text-ink hover:-translate-y-0.5 hover:bg-yellow"
                  )}
                >
                  {value === ALL ? "All" : value}
                </button>
              );
            })}
          </div>
        </div>

        {subcategories.length > 0 ? (
          <div className="mt-4 border-t-2 border-ink/10 pt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink/70">Subcategory</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by subcategory">
              {[ALL, ...subcategories].map((value) => {
                const selected = subcategory === value;
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setSubcategory(value);
                      setActiveIndex(0);
                    }}
                    className={clsx(
                      "rounded-full border-2 border-ink px-3 py-1 text-xs font-bold transition duration-200",
                      selected ? "bg-yellow text-ink" : "bg-surface text-ink/70 hover:bg-yellow/50"
                    )}
                  >
                    {value === ALL ? "All" : subcategoryLabel(value)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </Card>

      <Card className="mb-8 overflow-hidden bg-gradient-to-br from-yellow/45 via-surface to-orange/15">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange">A moment for you</p>
            <h2 className="font-display text-2xl font-bold">Daily affirmation</h2>
          </div>
          {currentAffirmation ? (
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/70">
              {safeActiveIndex + 1} of {activeAffirmations.length}
            </span>
          ) : null}
        </div>

        {!currentAffirmation ? (
          <EmptyState>No active affirmations match these filters.</EmptyState>
        ) : (
          <div>
            <div
              key={currentAffirmation.id}
              className="affirmation-deck-enter relative flex min-h-[220px] flex-col justify-center rounded-xl border-2 border-ink/15 bg-surface/90 px-6 py-8 text-center shadow-[0_10px_30px_rgba(255,91,35,0.10)] md:min-h-[250px] md:px-12"
              aria-live="polite"
              onMouseEnter={() => setDeckHovered(true)}
              onMouseLeave={() => setDeckHovered(false)}
              onFocusCapture={() => setDeckFocused(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDeckFocused(false);
                }
              }}
            >
              <span className="mb-3 text-3xl text-orange" aria-hidden>✦</span>
              <blockquote className="mx-auto max-w-4xl font-display text-2xl font-semibold leading-relaxed text-ink md:text-3xl">
                {currentAffirmation.text}
              </blockquote>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <span className="rounded-full bg-orange px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  {currentAffirmation.category}
                </span>
                {currentAffirmation.subcategory ? (
                  <span className="rounded-full bg-yellow px-3 py-1 text-xs font-bold text-ink">
                    {currentAffirmation.subcategory}
                  </span>
                ) : null}
              </div>
              <div className="mt-6">
                <CelebrateAffirmationModal
                  id={currentAffirmation.id}
                  text={currentAffirmation.text}
                  defaultDate={today}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-ink/65">
              <span>
                {activeAffirmations.length < 2
                  ? "Only one affirmation in this view"
                  : slideshowRunning
                    ? "Next affirmation in 10 seconds"
                    : autoPlay
                      ? "Slideshow paused while you interact"
                      : "Slideshow paused"}
              </span>
              {activeAffirmations.length > 1 ? (
                <button
                  type="button"
                  aria-pressed={!autoPlay}
                  className="min-h-10 rounded-full bg-surface px-3 text-xs font-bold uppercase tracking-wide text-ink hover:bg-yellow"
                  onClick={() => setAutoPlay((playing) => !playing)}
                >
                  {autoPlay ? "Pause" : "Play"}
                </button>
              ) : null}
            </div>

            <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              {slideshowRunning && activeAffirmations.length > 1 ? (
                <div
                  key={`${currentAffirmation.id}-${safeActiveIndex}`}
                  className="affirmation-slideshow-progress h-full rounded-full bg-orange"
                />
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => moveDeck(-1)}>
                ← Previous
              </Button>
              <Button
                type="button"
                variant="yellow"
                size="sm"
                disabled={activeAffirmations.length < 2}
                onClick={shuffleDeck}
              >
                Shuffle
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={() => moveDeck(1)}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </Card>

      <section>
        <button
          type="button"
          aria-expanded={libraryOpen}
          aria-controls="affirmation-library"
          onClick={() => setLibraryOpen((open) => !open)}
          className="brut-border brut-shadow-sm flex w-full items-center justify-between gap-4 rounded-lg bg-surface px-5 py-4 text-left transition-colors hover:bg-yellow/30"
        >
          <div>
            <h2 className="font-display text-xl font-bold">Manage affirmations</h2>
            <p className="mt-0.5 text-sm font-semibold text-muted">
              Organize, activate, or remove your statements.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="rounded-full bg-yellow px-2.5 py-1 text-xs font-bold">
              {filtered.length}
            </span>
            <span
              className={clsx(
                "text-xl font-bold transition-transform duration-300",
                libraryOpen && "rotate-180"
              )}
              aria-hidden
            >
              ↓
            </span>
          </div>
        </button>

        <div
          id="affirmation-library"
          className={clsx(
            "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
            libraryOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
          aria-hidden={!libraryOpen}
          inert={!libraryOpen}
        >
          <div className="overflow-hidden">
            <div className="pt-6">
              {filtered.length === 0 ? (
                <EmptyState>No affirmations match these filters.</EmptyState>
              ) : (
                <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
                  {Object.entries(grouped).map(([groupCategory, subgroups], categoryIndex) => {
                    const total = Object.values(subgroups).reduce((sum, items) => sum + items.length, 0);
                    return (
                      <div
                        key={groupCategory}
                        className="affirmation-enter"
                        style={{ animationDelay: `${categoryIndex * 70}ms` }}
                      >
                        <Card>
                          <div className="mb-4 flex items-center justify-between border-b-2 border-ink/10 pb-3">
                            <h3 className="font-display text-xl font-bold">{groupCategory}</h3>
                            <span className="rounded-full bg-yellow px-2.5 py-1 text-xs font-bold">{total}</span>
                          </div>
                          <div className="space-y-3">
                            {Object.entries(subgroups).map(([sub, items]) => (
                              <Collapsible
                                key={`${groupCategory}-${sub}-${category}-${subcategory}`}
                                title={subcategoryLabel(sub)}
                                count={items.length}
                                defaultOpen={subcategory !== ALL}
                              >
                                {items.map((affirmation) => (
                                  <AffirmationRow
                                    key={affirmation.id}
                                    id={affirmation.id}
                                    text={affirmation.text}
                                    category={affirmation.category}
                                    active={affirmation.active}
                                    subcategory={affirmation.subcategory}
                                    manifested={affirmation.manifested}
                                    today={today}
                                  />
                                ))}
                              </Collapsible>
                            ))}
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

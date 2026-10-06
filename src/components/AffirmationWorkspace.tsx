"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { AffirmationRow } from "@/components/AffirmationRow";
import { CelebrateAffirmationModal } from "@/components/CelebrateAffirmationModal";
import { Collapsible } from "@/components/Collapsible";
import { Card, EmptyState } from "@/components/ui";
import { categoryEmoji } from "@/lib/affirmationSubcategories";
import { affirmationLines } from "@/lib/affirmationText";
import { burstConfetti } from "@/lib/confetti";

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
const SLIDE_INTERVAL_MS = 8_000;
const REPS_GOAL = 3;
const REP_RING = 2 * Math.PI * 16;

function subcategoryKey(item: AffirmationItem) {
  return item.subcategory || NO_SUBCATEGORY;
}

function subcategoryLabel(value: string) {
  return value === NO_SUBCATEGORY ? "Other" : value;
}

function speak(text: string, onEnd: () => void) {
  if (!("speechSynthesis" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
  return true;
}

function stopSpeaking() {
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [moves, setMoves] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [autoPlay, setAutoPlay] = useState(true);
  const [deckHovered, setDeckHovered] = useState(false);
  const [deckFocused, setDeckFocused] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [reps, setReps] = useState<Record<number, number>>({});
  const cardRef = useRef<HTMLElement>(null);
  const swipeStart = useRef<number | null>(null);

  const categories = useMemo(
    () => [...new Set(affirmations.map((item) => item.category))].sort(),
    [affirmations]
  );
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of affirmations) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, [affirmations]);

  const subcategories = useMemo(() => {
    const matchingCategory = category === ALL
      ? affirmations
      : affirmations.filter((item) => item.category === category);
    return [...new Set(matchingCategory.map(subcategoryKey))].sort((a, b) =>
      subcategoryLabel(a).localeCompare(subcategoryLabel(b))
    );
  }, [affirmations, category]);

  const needle = query.trim().toLowerCase();
  const filtered = useMemo(
    () => affirmations.filter((item) => {
      const categoryMatches = category === ALL || item.category === category;
      const subcategoryMatches = subcategory === ALL || subcategoryKey(item) === subcategory;
      const textMatches = !needle || item.text.toLowerCase().includes(needle);
      return categoryMatches && subcategoryMatches && textMatches;
    }),
    [affirmations, category, subcategory, needle]
  );

  const activeAffirmations = filtered.filter((item) => item.active && !item.manifested);
  const safeActiveIndex = activeAffirmations.length > 0
    ? activeIndex % activeAffirmations.length
    : 0;
  const currentAffirmation = activeAffirmations[safeActiveIndex];
  const lines = currentAffirmation ? affirmationLines(currentAffirmation.text) : [];
  const textLength = currentAffirmation?.text.length ?? 0;
  const currentReps = currentAffirmation ? (reps[currentAffirmation.id] ?? 0) : 0;
  const grouped = filtered.reduce<Record<string, Record<string, AffirmationItem[]>>>((groups, item) => {
    groups[item.category] ??= {};
    const sub = subcategoryKey(item);
    groups[item.category][sub] ??= [];
    groups[item.category][sub].push(item);
    return groups;
  }, {});
  const hasFilters = category !== ALL || subcategory !== ALL || needle !== "";
  const slideshowRunning = autoPlay && !deckHovered && !deckFocused && !speaking;

  useEffect(() => {
    if (!slideshowRunning || activeAffirmations.length < 2) return;

    const timeout = window.setTimeout(() => {
      setDirection(1);
      setMoves((n) => n + 1);
      setActiveIndex((current) => (current + 1) % activeAffirmations.length);
    }, SLIDE_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [activeAffirmations.length, safeActiveIndex, slideshowRunning]);

  // Stop any read-aloud when the card changes or the page unmounts.
  useEffect(() => stopSpeaking, [currentAffirmation?.id]);

  const moveDeck = (step: 1 | -1) => {
    if (activeAffirmations.length === 0) return;
    setDirection(step);
    setMoves((n) => n + 1);
    setSpeaking(false);
    setActiveIndex(
      (safeActiveIndex + step + activeAffirmations.length) % activeAffirmations.length
    );
  };

  const shuffleDeck = () => {
    if (activeAffirmations.length < 2) return;
    const randomIndex = Math.floor(Math.random() * (activeAffirmations.length - 1));
    setDirection(1);
    setMoves((n) => n + 1);
    setSpeaking(false);
    setActiveIndex(randomIndex >= safeActiveIndex ? randomIndex + 1 : randomIndex);
  };

  const resetDeck = () => {
    setActiveIndex(0);
    setMoves((n) => n + 1);
  };

  function readAloud() {
    if (!currentAffirmation) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    if (speak(lines.join(". "), () => setSpeaking(false))) setSpeaking(true);
  }

  function saidIt(event: React.MouseEvent<HTMLButtonElement>) {
    if (!currentAffirmation) return;
    const next = Math.min(REPS_GOAL, currentReps + 1);
    setReps((current) => ({ ...current, [currentAffirmation.id]: next }));
    if (next === REPS_GOAL && currentReps < REPS_GOAL) {
      burstConfetti(cardRef.current ?? event.currentTarget, 36, ["✨", "🌟", "💛", "✦", categoryEmoji(currentAffirmation.category)]);
    } else {
      burstConfetti(event.currentTarget, 8, ["✦", "✨"]);
    }
  }

  // Keyboard: ← → move, S shuffle, P play/pause, R read aloud.
  const keyActions = useRef({ moveDeck, shuffleDeck, readAloud, toggle: () => setAutoPlay((p) => !p) });
  useEffect(() => {
    keyActions.current = { moveDeck, shuffleDeck, readAloud, toggle: () => setAutoPlay((p) => !p) };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, dialog, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
      const actions = keyActions.current;
      if (event.key === "ArrowRight") actions.moveDeck(1);
      else if (event.key === "ArrowLeft") actions.moveDeck(-1);
      else if (event.key.toLowerCase() === "s") actions.shuffleDeck();
      else if (event.key.toLowerCase() === "p") actions.toggle();
      else if (event.key.toLowerCase() === "r") actions.readAloud();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange">Choose what you need today</p>
            <h2 className="font-display text-xl font-bold">Shape your practice</h2>
          </div>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <label className="aff-search relative min-w-[12rem] flex-1 sm:max-w-xs">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">🔎</span>
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  resetDeck();
                }}
                placeholder="Search your affirmations…"
                aria-label="Search affirmations"
                className="brut-border min-h-11 w-full rounded-full bg-surface py-2 pl-9 pr-4 text-base font-medium sm:min-h-10 sm:text-sm"
              />
            </label>
            <span className="rounded-full bg-yellow px-3 py-1 text-xs font-bold text-ink">
              {filtered.length} matching
            </span>
            {hasFilters ? (
              <button
                type="button"
                className="min-h-11 px-2 text-xs font-bold uppercase tracking-wide text-blue hover:underline"
                onClick={() => {
                  setCategory(ALL);
                  setSubcategory(ALL);
                  setQuery("");
                  resetDeck();
                }}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

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
                  resetDeck();
                }}
                className={clsx("aff-cat", selected && "is-active")}
              >
                <span aria-hidden className="aff-cat-emoji">{value === ALL ? "🌈" : categoryEmoji(value)}</span>
                {value === ALL ? "All" : value}
                <span className="aff-cat-count">{value === ALL ? affirmations.length : categoryCounts.get(value)}</span>
              </button>
            );
          })}
        </div>

        {subcategories.length > 1 ? (
          <div className="aff-segment mt-4" role="group" aria-label="Filter by subcategory">
            {[ALL, ...subcategories].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={subcategory === value}
                onClick={() => {
                  setSubcategory(value);
                  resetDeck();
                }}
                className={clsx("aff-segment-btn", subcategory === value && "is-active")}
              >
                {value === ALL ? "All" : subcategoryLabel(value)}
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      <section aria-labelledby="daily-affirmation-heading" className="mb-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-pink">A moment for you</p>
            <h2 id="daily-affirmation-heading" className="font-display text-2xl font-bold sm:text-3xl">
              <span className="home-marker is-always">Daily affirmation</span>
            </h2>
          </div>
          {currentAffirmation ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-ink/70 brut-border">
                {safeActiveIndex + 1} / {activeAffirmations.length}
              </span>
              {activeAffirmations.length > 1 ? (
                <button
                  type="button"
                  aria-pressed={!autoPlay}
                  aria-keyshortcuts="p"
                  className="deck-btn deck-btn-wide !min-h-9"
                  onClick={() => setAutoPlay((playing) => !playing)}
                >
                  {autoPlay ? "⏸ Pause" : "▶ Play"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {!currentAffirmation ? (
          <EmptyState>No active affirmations match these filters.</EmptyState>
        ) : (
          <div>
            <div
              className="deck-stack relative touch-pan-y"
              onMouseEnter={() => setDeckHovered(true)}
              onMouseLeave={() => setDeckHovered(false)}
              onFocusCapture={() => setDeckFocused(true)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setDeckFocused(false);
                }
              }}
              onPointerDown={(event) => {
                if (event.pointerType !== "mouse") swipeStart.current = event.clientX;
              }}
              onPointerUp={(event) => {
                if (swipeStart.current === null) return;
                const dx = event.clientX - swipeStart.current;
                swipeStart.current = null;
                if (Math.abs(dx) > 60) moveDeck(dx < 0 ? 1 : -1);
              }}
            >
              <span aria-hidden className="deck-shadow deck-shadow-2" />
              <span aria-hidden className="deck-shadow deck-shadow-1" />
              <figure
                ref={cardRef}
                key={`${currentAffirmation.id}-${moves}`}
                aria-live="polite"
                className={clsx(
                  "deck-card aff-card relative flex min-h-[18rem] flex-col rounded-[1.75rem] p-6 sm:p-10",
                  moves > 0 && (direction === 1 ? "is-flipping" : "is-flipping-back"),
                  currentReps >= REPS_GOAL && "is-glowing"
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border-2 border-ink bg-orange px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                      <span aria-hidden>{categoryEmoji(currentAffirmation.category)}</span> {currentAffirmation.category}
                    </span>
                    {currentAffirmation.subcategory ? (
                      <span className="rounded-full border-2 border-ink bg-yellow px-3 py-1 text-[11px] font-bold text-ink">
                        {currentAffirmation.subcategory}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2" aria-label={`Said ${currentReps} of ${REPS_GOAL} times`}>
                    <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90" aria-hidden>
                      <circle cx={20} cy={20} r={16} fill="none" strokeWidth={5} className="stroke-ink/10" />
                      <circle
                        cx={20}
                        cy={20}
                        r={16}
                        fill="none"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeDasharray={REP_RING}
                        strokeDashoffset={REP_RING * (1 - currentReps / REPS_GOAL)}
                        className="stroke-pink transition-[stroke-dashoffset] duration-500"
                      />
                    </svg>
                    <span className="text-xs font-bold text-ink/60">
                      {currentReps >= REPS_GOAL ? "Locked in ✨" : `${currentReps}/${REPS_GOAL} said`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-center py-6">
                  <span aria-hidden className="deck-quote">&ldquo;</span>
                  {lines.length > 1 ? (
                    <ul className={clsx("space-y-2.5 font-display font-semibold leading-snug", textLength > 400 ? "text-lg md:text-xl" : "text-xl md:text-2xl")}>
                      {lines.map((line, i) => (
                        <li key={i} className="aff-line flex gap-3" style={{ animationDelay: `${150 + i * 140}ms` }}>
                          <span aria-hidden className="mt-1.5 text-sm text-pink">✦</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <blockquote
                      className={clsx(
                        "aff-line font-display font-bold leading-tight tracking-[-0.02em]",
                        textLength < 90 ? "text-3xl md:text-5xl" : textLength < 200 ? "text-2xl md:text-4xl" : "text-xl md:text-2xl"
                      )}
                      style={{ animationDelay: "150ms" }}
                    >
                      {currentAffirmation.text}
                    </blockquote>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={readAloud} aria-pressed={speaking} aria-keyshortcuts="r" className={clsx("deck-btn deck-btn-wide", speaking && "aff-speaking")}>
                    <span aria-hidden>{speaking ? "◼" : "🔊"}</span> {speaking ? "Stop" : "Read aloud"}
                  </button>
                  <button type="button" onClick={saidIt} disabled={currentReps >= REPS_GOAL} className="deck-say disabled:opacity-60">
                    🗣 I said it
                  </button>
                  <div className="ml-auto">
                    <CelebrateAffirmationModal id={currentAffirmation.id} text={currentAffirmation.text} defaultDate={today} />
                  </div>
                </div>
              </figure>
            </div>

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              {slideshowRunning && activeAffirmations.length > 1 ? (
                <div
                  key={`${currentAffirmation.id}-${moves}`}
                  className="aff-progress h-full rounded-full bg-pink"
                  style={{ animationDuration: `${SLIDE_INTERVAL_MS}ms` }}
                />
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={() => moveDeck(-1)} aria-label="Previous affirmation" className="deck-btn">
                ←
              </button>
              <button type="button" onClick={shuffleDeck} disabled={activeAffirmations.length < 2} aria-keyshortcuts="s" className="deck-btn deck-btn-wide">
                <span aria-hidden className="deck-dice">🎲</span> Shuffle
              </button>
              <button type="button" onClick={() => moveDeck(1)} aria-label="Next affirmation" className="deck-btn">
                →
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] font-semibold text-muted">
              {activeAffirmations.length < 2
                ? "Only one affirmation in this view"
                : speaking
                  ? "Listening… the deck waits for you"
                  : slideshowRunning
                    ? "Turns on its own every 8 seconds"
                    : "Paused"}
              <span className="hidden sm:inline"> · ← → move · S shuffle · P pause · R read aloud · swipe on touch</span>
            </p>
          </div>
        )}
      </section>

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

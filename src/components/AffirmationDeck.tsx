"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { setAffirmationCheckin, type AffirmationSlot } from "@/lib/actions/affirmations";
import { burstConfetti } from "@/lib/confetti";
import { affirmationLines } from "@/lib/affirmationText";

export type DeckAffirmation = { id: number; text: string; category: string };

const SLOT_LABEL: Record<AffirmationSlot, string> = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };

function currentSlot(): AffirmationSlot {
  const hour = new Date().getHours();
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

/** Stable starting card per day, so server and client render the same one. */
function dailyIndex(date: string, length: number) {
  let hash = 0;
  for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return length ? hash % length : 0;
}

export function AffirmationDeck({
  date,
  affirmations,
  checked,
}: {
  date: string;
  affirmations: DeckAffirmation[];
  checked: Record<AffirmationSlot, boolean>;
}) {
  const [index, setIndex] = useState(() => dailyIndex(date, affirmations.length));
  const [flips, setFlips] = useState(0);
  const [glow, setGlow] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (affirmations.length === 0) {
    return (
      <div className="deck-card flex h-full flex-col items-center justify-center rounded-[1.5rem] p-6 text-center">
        <p className="font-display text-2xl font-bold">Your deck is empty</p>
        <p className="mt-2 text-sm font-semibold text-ink/70">Write a thought you want to grow into.</p>
        <Link href="/affirmations" className="home-text-link mt-4 text-sm font-bold">
          Create an affirmation <span aria-hidden>&rarr;</span>
        </Link>
      </div>
    );
  }

  const card = affirmations[index % affirmations.length];

  function go(next: number) {
    setIndex(((next % affirmations.length) + affirmations.length) % affirmations.length);
    setFlips((n) => n + 1);
    setGlow(false);
    setMessage(null);
  }

  function shuffle() {
    if (affirmations.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * affirmations.length);
    go(next);
  }

  function sayIt(event: React.MouseEvent<HTMLButtonElement>) {
    burstConfetti(event.currentTarget, 22, ["✨", "🌟", "💛", "✦"]);
    setGlow(true);
    const slot = currentSlot();
    if (checked[slot]) {
      setMessage("Felt it. Say it again whenever you need it.");
      return;
    }
    setMessage(`${SLOT_LABEL[slot]} check-in logged ✓`);
    startTransition(() => {
      setAffirmationCheckin(date, slot, true);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="deck-stack relative flex-1">
        <span aria-hidden className="deck-shadow deck-shadow-2" />
        <span aria-hidden className="deck-shadow deck-shadow-1" />
        <figure
          key={flips}
          className={clsx("deck-card relative flex h-full min-h-[16rem] flex-col justify-between rounded-[1.5rem] p-6 sm:p-7", flips > 0 && "is-flipping", glow && "is-glowing")}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-full border-2 border-ink bg-surface px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]">
              {card.category}
            </span>
            <span className="text-xs font-bold text-ink/50">
              {(index % affirmations.length) + 1} / {affirmations.length}
            </span>
          </div>
          <blockquote className={clsx("my-5 font-display font-bold leading-snug", card.text.length > 200 ? "text-lg sm:text-xl" : "text-2xl sm:text-[1.7rem]")}>
            <span aria-hidden className="deck-quote">&ldquo;</span>
            {affirmationLines(card.text).map((line, i) => (
              <span key={i} className="aff-line block" style={{ animationDelay: `${100 + i * 110}ms` }}>
                {line}
              </span>
            ))}
          </blockquote>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/55">Read it slowly. Mean it.</p>
        </figure>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => go(index - 1)} aria-label="Previous affirmation" className="deck-btn">
          ←
        </button>
        <button type="button" onClick={shuffle} className="deck-btn deck-btn-wide" aria-label="Shuffle">
          <span aria-hidden className="deck-dice">🎲</span> Shuffle
        </button>
        <button type="button" onClick={() => go(index + 1)} aria-label="Next affirmation" className="deck-btn">
          →
        </button>
        <button type="button" onClick={sayIt} disabled={isPending} className="deck-say ml-auto">
          ✨ I believe it
        </button>
      </div>
      <p role="status" className="mt-2 min-h-5 text-xs font-bold text-pink">
        {message}
      </p>
    </div>
  );
}

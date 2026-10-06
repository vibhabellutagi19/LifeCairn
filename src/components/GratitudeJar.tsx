"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { addGratitude, removeGratitude } from "@/lib/actions/journal";
import { burstConfetti } from "@/lib/confetti";

const NOTE_COLORS = ["bg-yellow", "bg-pink text-white", "bg-green text-white", "bg-blue text-white", "bg-orange text-white"];
const TILTS = ["-3deg", "2deg", "-1deg", "3deg", "-2deg", "1deg"];
const PROMPTS = ["Someone who helped me…", "A small win today…", "Something that made me laugh…", "A thing my body did well…"];

export function GratitudeJar({ date, items }: { date: string; items: string[] }) {
  const [optimisticItems, updateItems] = useOptimistic(
    items,
    (state, action: { type: "add"; text: string } | { type: "remove"; index: number }) =>
      action.type === "add" ? [...state, action.text] : state.filter((_, i) => i !== action.index)
  );
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState("I'm grateful for…");
  const [, startTransition] = useTransition();
  const jarRef = useRef<HTMLDivElement>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    if (jarRef.current) burstConfetti(jarRef.current, 14, ["💛", "✨", "🌸", "✦"]);
    startTransition(async () => {
      updateItems({ type: "add", text: value });
      await addGratitude(date, value);
    });
  }

  function remove(index: number) {
    startTransition(async () => {
      updateItems({ type: "remove", index });
      await removeGratitude(date, index);
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={jarRef} className="jar relative mx-auto w-full max-w-sm">
        <div aria-hidden className="jar-lid" />
        <div className="jar-body flex min-h-48 flex-wrap content-end items-end justify-center gap-1.5 p-4 pt-6">
          {optimisticItems.length === 0 ? (
            <p className="self-center pb-8 text-center text-sm font-semibold text-muted">
              Empty jar. What made you smile today?
            </p>
          ) : (
            optimisticItems.map((item, i) => (
              <span
                key={`${i}-${item}`}
                className={`jar-note group ${NOTE_COLORS[i % NOTE_COLORS.length]}`}
                style={{ "--tilt": TILTS[i % TILTS.length], animationDelay: `${Math.min(i, 8) * 60}ms` } as React.CSSProperties}
              >
                {item}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label={`Remove "${item}"`}
                  className="ml-1 opacity-50 transition-opacity hover:opacity-100 group-hover:opacity-80"
                >
                  ✕
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          maxLength={200}
          placeholder={placeholder}
          aria-label="Add something you're grateful for"
          className="brut-border min-h-11 w-full min-w-0 rounded-md bg-surface px-3 py-2 text-base font-medium sm:text-sm"
        />
        <button type="submit" className="deck-say shrink-0">
          Drop it in
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PROMPTS.map((prompt) => (
          <button key={prompt} type="button" onClick={() => setPlaceholder(prompt)} className="jar-prompt">
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

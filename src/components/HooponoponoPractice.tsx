"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { clsx } from "clsx";
import { logHooponoponoSession, updateHooponoponoNote } from "@/lib/actions/hooponopono";
import { burstConfetti } from "@/lib/confetti";

const PHRASES = [
  { text: "I'm sorry", meaning: "I take responsibility for what's in me" },
  { text: "Please forgive me", meaning: "I release it" },
  { text: "Thank you", meaning: "for the lesson and the cleaning" },
  { text: "I love you", meaning: "to myself, to them, to life" },
];
const PRESETS = [27, 54, 108, 216];
const KEY = "roadmap:hooponopono";

type Progress = {
  day: string;
  count: number;
  intention: string;
  /** Repetitions to aim for; null = open-ended (conversational) session. */
  target: number | null;
};
const EMPTY: Progress = { day: "", count: 0, intention: "", target: 108 };
const SERVER_SNAPSHOT = JSON.stringify(EMPTY);

// Small localStorage-backed store so a half-finished session survives reloads.
let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw() {
  if (memory === null) {
    try {
      memory = localStorage.getItem(KEY) ?? SERVER_SNAPSHOT;
    } catch {
      memory = SERVER_SNAPSHOT;
    }
  }
  return memory;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function write(progress: Progress) {
  memory = JSON.stringify(progress);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((listener) => listener());
}

function parse(raw: string, today: string): Progress {
  try {
    const progress = { ...EMPTY, ...(JSON.parse(raw) as Partial<Progress>) };
    return progress.day === today ? progress : { ...progress, day: today, count: 0 };
  } catch {
    return { ...EMPTY, day: today };
  }
}

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Bead positions around the ring, starting at the top (rounded so server and browser match). */
function beadPositions(total: number) {
  return Array.from({ length: total }, (_, i) => {
    const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
    return { x: round2(100 + 84 * Math.cos(angle)), y: round2(100 + 84 * Math.sin(angle)) };
  });
}

type Finished = { id: number | null; count: number; target: number | null };

export function HooponoponoPractice({ date, recentIntentions }: { date: string; recentIntentions: string[] }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SERVER_SNAPSHOT);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);
  const progress = parse(raw, date);
  const { count, intention, target } = progress;
  const [guiding, setGuiding] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [note, setNote] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [saving, startSaving] = useTransition();
  const ringRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const guideRef = useRef(false);

  // A ring of up to 108 beads; bigger goals (and open sessions) go around in laps.
  const ringSize = target && target <= 108 ? target : 108;
  const lap = Math.floor(count / ringSize);
  const filled = count - lap * ringSize;
  const beads = useMemo(() => beadPositions(ringSize), [ringSize]);
  const markerEvery = ringSize % 27 === 0 && ringSize > 27 ? 27 : 0;
  const beadR = ringSize <= 30 ? 6.5 : ringSize <= 60 ? 4.6 : 3.1;
  const percent = target ? Math.min(100, Math.round((count / target) * 100)) : 0;

  function save(current: Progress) {
    const result: Finished = { id: null, count: current.count, target: current.target };
    setFinished(result);
    setNote("");
    setNoteSaved(false);
    write({ ...current, count: 0 });
    vibrate([60, 40, 60, 40, 120]);
    if (ringRef.current) burstConfetti(ringRef.current, 48, ["🌺", "✨", "💛", "🌸", "✦"]);
    startSaving(async () => {
      const id = await logHooponoponoSession(date, current.count, current.target, current.intention);
      setFinished({ ...result, id });
    });
  }

  /** One full recitation of the four phrases = one bead. Returns false once the goal is reached. */
  function countOne() {
    const current = parse(readRaw(), date);
    const next = current.count + 1;
    setFinished(null);
    if (current.target && next >= current.target) {
      save({ ...current, count: next });
      return false;
    }
    write({ ...current, count: next });
    if (next % 27 === 0) {
      vibrate([30, 30, 30]);
      if (ringRef.current) burstConfetti(ringRef.current, 12, ["🌺", "✦"]);
    } else {
      vibrate(8);
    }
    return true;
  }

  function undo() {
    const current = parse(readRaw(), date);
    write({ ...current, count: Math.max(0, current.count - 1) });
  }

  // Guide mode: the browser speaks the four phrases and counts a bead after each recitation.
  function speakRound() {
    if (!guideRef.current || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(PHRASES.map((p) => p.text).join(". ") + ".");
    utterance.rate = 0.85;
    utterance.onend = () => {
      if (!guideRef.current) return;
      if (countOne()) speakRound();
      else stopGuide();
    };
    window.speechSynthesis.speak(utterance);
  }

  function startGuide() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    guideRef.current = true;
    setGuiding(true);
    speakRound();
  }

  function stopGuide() {
    guideRef.current = false;
    setGuiding(false);
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function setTarget(next: number | null) {
    write({ ...parse(readRaw(), date), target: next });
    setCustomOpen(false);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else panelRef.current?.requestFullscreen().catch(() => {});
  }

  // Keyboard: Space/Enter count, Backspace/Z undo, F zen mode.
  const keyActions = useRef({ countOne, undo, toggleFullscreen, guiding });
  useEffect(() => {
    keyActions.current = { countOne, undo, toggleFullscreen, guiding };
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
      const actions = keyActions.current;
      const key = event.key.toLowerCase();
      if ((key === " " || key === "enter") && !el?.closest("button, a")) {
        event.preventDefault();
        if (!actions.guiding) actions.countOne();
      } else if (key === "backspace" || key === "z") {
        if (!actions.guiding) actions.undo();
      } else if (key === "f") actions.toggleFullscreen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div ref={panelRef} className={clsx("hoo-panel relative overflow-hidden rounded-[2rem] p-5 sm:p-8", isFullscreen && "is-zen")}>
      <span aria-hidden className="hoo-flower hoo-flower-1">🌺</span>
      <span aria-hidden className="hoo-flower hoo-flower-2">🌸</span>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="How many repetitions">
          <span className="mr-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink/60">Goal</span>
          {PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => setTarget(n)} aria-pressed={target === n} className={clsx("hoo-goal", target === n && "is-active")}>
              {n}
            </button>
          ))}
          {target !== null && !PRESETS.includes(target) ? (
            <button type="button" aria-pressed className="hoo-goal is-active">
              {target}
            </button>
          ) : null}
          {customOpen ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const n = Math.round(Number(customValue));
                if (n >= 1 && n <= 10_000) setTarget(n);
              }}
              className="flex items-center gap-1"
            >
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                min={1}
                max={10000}
                value={customValue}
                onChange={(event) => setCustomValue(event.target.value)}
                placeholder="e.g. 33"
                aria-label="Custom number of repetitions"
                className="h-9 w-20 rounded-full border-2 border-ink bg-surface px-3 text-sm font-bold"
              />
              <button type="submit" className="hoo-goal is-active">Set</button>
            </form>
          ) : (
            <button type="button" onClick={() => setCustomOpen(true)} className="hoo-goal">
              Custom…
            </button>
          )}
          <button type="button" onClick={() => setTarget(null)} aria-pressed={target === null} className={clsx("hoo-goal", target === null && "is-active")} title="No fixed number. Finish whenever you feel complete.">
            ∞ Open
          </button>
        </div>
        <button type="button" onClick={toggleFullscreen} aria-keyshortcuts="f" className="hoo-icon-btn" title={isFullscreen ? "Exit zen mode" : "Zen mode (fullscreen)"}>
          {isFullscreen ? "✕" : "⛶"}
        </button>
      </div>

      <div className="relative z-10 mt-6 grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex flex-col items-center">
          <button
            ref={ringRef}
            type="button"
            onClick={() => countOne()}
            disabled={guiding}
            aria-keyshortcuts="Space"
            aria-label={`Count one recitation. ${count}${target ? ` of ${target}` : ""} done.`}
            className="hoo-mala relative"
          >
            <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden>
              <circle cx={100} cy={100} r={84} fill="none" className="hoo-thread" strokeWidth={1.5} />
              {beads.map((bead, i) => {
                const marker = markerEvery > 0 && (i + 1) % markerEvery === 0;
                const done = i < filled;
                const current = i === filled;
                return (
                  <circle
                    key={i}
                    cx={bead.x}
                    cy={bead.y}
                    r={current ? beadR * 1.6 : marker ? beadR * 1.35 : beadR}
                    className={clsx("hoo-bead", done && "is-done", current && "is-current", marker && "is-marker")}
                  />
                );
              })}
              <circle cx={100} cy={7} r={7} className="hoo-guru" />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span key={count} className="hoo-count font-display font-bold tabular-nums">{count}</span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-ink/55">
                {target ? `of ${target}` : "open session"}
                {lap > 0 ? ` · lap ${lap + 1}` : ""}
              </span>
              <span className="mt-3 rounded-full border-2 border-ink bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-wide">
                {guiding ? "Listening…" : count === 0 ? "Tap or press space" : "Tap each time"}
              </span>
            </span>
          </button>
          {target ? (
            <div className="mt-3 h-2 w-56 overflow-hidden rounded-full border-2 border-ink bg-surface">
              <div className="h-full bg-pink transition-[width] duration-300" style={{ width: `${percent}%` }} />
            </div>
          ) : null}
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink">
              {target ? "Say slowly, feel each one" : "Talk to it in your own words, then return to the four phrases"}
            </p>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {PHRASES.map((phrase, i) => (
                <li key={`${phrase.text}-${count}`} className={clsx("hoo-phrase", count > 0 && "is-lit")} style={{ animationDelay: `${i * 160}ms` }}>
                  <span className="hoo-phrase-text font-display font-bold">{phrase.text}</span>
                  <span className="block text-xs font-semibold text-ink/60">{phrase.meaning}</span>
                </li>
              ))}
            </ol>
          </div>

          <label className="hoo-intention block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-ink/60">
              Who or what is this for? <span className="normal-case tracking-normal">(optional)</span>
            </span>
            <input
              value={intention}
              onChange={(event) => write({ ...progress, intention: event.target.value })}
              maxLength={200}
              placeholder="A person, a memory, money, my body…"
              className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-base font-medium sm:text-sm"
            />
          </label>
          {recentIntentions.length > 0 ? (
            <div className="hoo-intention flex flex-wrap gap-1.5">
              {recentIntentions.map((item) => (
                <button key={item} type="button" onClick={() => write({ ...progress, intention: item })} className="jar-prompt">
                  {item}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={guiding ? stopGuide : startGuide} className={clsx("deck-say", guiding && "aff-speaking")}>
              {guiding ? "◼ Stop guide" : "🔊 Guide me"}
            </button>
            {!target || count > 0 ? (
              <button
                type="button"
                onClick={() => {
                  stopGuide();
                  save(parse(readRaw(), date));
                }}
                disabled={count === 0}
                className="deck-btn deck-btn-wide disabled:opacity-40"
                title="Save this session with the count so far"
              >
                ✓ Finish{count > 0 ? ` at ${count}` : ""}
              </button>
            ) : null}
            <button type="button" onClick={undo} disabled={count === 0 || guiding} aria-keyshortcuts="z" className="deck-btn deck-btn-wide disabled:opacity-40">
              − Undo
            </button>
            <button
              type="button"
              onClick={() => {
                stopGuide();
                write({ ...progress, count: 0 });
              }}
              disabled={count === 0}
              className="deck-btn deck-btn-wide disabled:opacity-40"
            >
              ↺ Restart
            </button>
          </div>

          {finished ? (
            <form
              className="hoo-finished rounded-2xl border-2 border-ink bg-surface/90 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (finished.id === null) return;
                const id = finished.id;
                startSaving(async () => {
                  await updateHooponoponoNote(id, note);
                  setNoteSaved(true);
                });
              }}
            >
              <p className="font-display text-lg font-bold">
                🌺 {finished.count} {finished.count === 1 ? "repetition" : "repetitions"} saved. Breathe.
              </p>
              {noteSaved ? (
                <p className="mt-1 text-sm font-semibold text-green">Reflection saved to your history.</p>
              ) : (
                <>
                  <label htmlFor="hoo-note" className="mt-2 block text-xs font-semibold text-ink/60">
                    Anything that came up? What did you say, what shifted? (optional)
                  </label>
                  <textarea
                    id="hoo-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="brut-border mt-1.5 w-full rounded-md bg-surface px-3 py-2 text-base font-medium sm:text-sm"
                  />
                  <div className="mt-2 flex items-center gap-3">
                    <button type="submit" disabled={!note.trim() || finished.id === null || saving} className="deck-say disabled:opacity-50">
                      {saving ? "Saving…" : "Save reflection"}
                    </button>
                    <button type="button" onClick={() => setFinished(null)} className="text-xs font-bold text-muted underline decoration-2 underline-offset-4">
                      Skip
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : null}

          <p className="hidden text-[11px] font-semibold text-ink/45 sm:block">
            <kbd>Space</kbd> count · <kbd>Z</kbd> undo · <kbd>F</kbd> zen mode
          </p>
        </div>
      </div>
    </div>
  );
}

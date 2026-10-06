"use client";

import { useEffect, useState } from "react";
import { clsx } from "clsx";

type Step = { label: string; secs: number; scale: number };
const PATTERNS: { key: string; name: string; hint: string; steps: Step[] }[] = [
  {
    key: "box",
    name: "Box",
    hint: "4 · 4 · 4 · 4, steady and grounding",
    steps: [
      { label: "Breathe in", secs: 4, scale: 1 },
      { label: "Hold", secs: 4, scale: 1 },
      { label: "Breathe out", secs: 4, scale: 0.55 },
      { label: "Hold", secs: 4, scale: 0.55 },
    ],
  },
  {
    key: "478",
    name: "4-7-8",
    hint: "In 4 · hold 7 · out 8, for calming down",
    steps: [
      { label: "Breathe in", secs: 4, scale: 1 },
      { label: "Hold", secs: 7, scale: 1 },
      { label: "Breathe out", secs: 8, scale: 0.55 },
    ],
  },
  {
    key: "coherent",
    name: "Coherent",
    hint: "In 5 · out 5, for balance",
    steps: [
      { label: "Breathe in", secs: 5, scale: 1 },
      { label: "Breathe out", secs: 5, scale: 0.55 },
    ],
  },
];

type Run = { step: number; left: number; cycles: number };

export function BreathingOrb() {
  const [patternKey, setPatternKey] = useState(PATTERNS[0].key);
  const [run, setRun] = useState<Run | null>(null);
  const pattern = PATTERNS.find((p) => p.key === patternKey) ?? PATTERNS[0];
  const step = run ? pattern.steps[run.step] : null;
  const running = run !== null;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setRun((current) => {
        if (!current) return current;
        if (current.left > 1) return { ...current, left: current.left - 1 };
        const nextStep = (current.step + 1) % pattern.steps.length;
        return { step: nextStep, left: pattern.steps[nextStep].secs, cycles: current.cycles + (nextStep === 0 ? 1 : 0) };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running, pattern]);

  function start() {
    setRun({ step: 0, left: pattern.steps[0].secs, cycles: 0 });
  }

  return (
    <div className="flex h-full flex-col items-center">
      <div className="flex flex-wrap justify-center gap-1.5" role="group" aria-label="Breathing pattern">
        {PATTERNS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setPatternKey(p.key);
              setRun(null);
            }}
            aria-pressed={p.key === patternKey}
            className={clsx("breath-chip", p.key === patternKey && "is-active")}
          >
            {p.name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-muted">{pattern.hint}</p>

      <div className="relative my-6 flex h-56 w-56 items-center justify-center">
        <span aria-hidden className={clsx("breath-ring", run && "is-running")} />
        <div
          className={clsx("breath-orb", !run && "is-idle")}
          style={step ? { transform: `scale(${step.scale})`, transitionDuration: `${step.secs}s` } : undefined}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center" aria-live="polite">
          <p className="font-display text-2xl font-bold text-white drop-shadow">{step ? step.label : "Ready?"}</p>
          {run ? <p className="font-display text-4xl font-bold tabular-nums text-white drop-shadow">{run.left}</p> : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" onClick={run ? () => setRun(null) : start} className="deck-say">
          {run ? "◼ Stop" : "▶ Begin"}
        </button>
        {run ? (
          <span className="text-xs font-bold text-muted">
            {run.cycles} {run.cycles === 1 ? "round" : "rounds"}
          </span>
        ) : null}
      </div>
    </div>
  );
}

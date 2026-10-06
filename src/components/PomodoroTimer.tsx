"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { clsx } from "clsx";
import { CatSvg } from "@/components/HomeCat";
import { Card, Select } from "@/components/ui";
import { burstConfetti } from "@/lib/confetti";
import { logPomodoroSession, savePomodoroSettings } from "@/lib/actions/pomodoro";
import { todayISO } from "@/lib/dates";

type Mode = "focus" | "short" | "long";
type Durations = Record<Mode, number>;
type State = {
  mode: Mode;
  /** Epoch ms when the running timer ends; null while paused/idle. */
  endsAt: number | null;
  /** Ms left while paused; null means a fresh, untouched timer. */
  remaining: number | null;
  /** Length of the phase in progress, so editing durations mid-session doesn't skew it. */
  phaseMs: number | null;
  taskId: string;
  taskTitle: string;
  notify: boolean;
};

const MODE_ORDER: Mode[] = ["focus", "short", "long"];
const MODES: Record<Mode, { label: string; emoji: string; color: string; max: number }> = {
  focus: { label: "Focus", emoji: "🍅", color: "var(--orange)", max: 180 },
  short: { label: "Short break", emoji: "🍵", color: "var(--green)", max: 60 },
  long: { label: "Long break", emoji: "🛋️", color: "var(--blue)", max: 90 },
};
const PRESETS: { label: string; minutes: Durations }[] = [
  { label: "Classic", minutes: { focus: 25, short: 5, long: 15 } },
  { label: "Deep work", minutes: { focus: 50, short: 10, long: 30 } },
  { label: "Quick", minutes: { focus: 15, short: 3, long: 10 } },
];
const FOCUS_TIPS = [
  "Close the tabs you don't need.",
  "Phone face down, out of reach.",
  "A thought popped up? Jot it down, come back.",
  "Just the next small step.",
  "Breathe. You're doing the thing.",
  "Done is better than perfect.",
];
const BREAK_TIPS = [
  "Stand up and stretch your back.",
  "Refill your water bottle 💧",
  "Look at something far away for 20 seconds.",
  "Roll your shoulders. Unclench your jaw.",
  "Step outside for a breath of fresh air.",
  "No scrolling. Let your brain rest.",
];

const R = 54;
const RING = 2 * Math.PI * R;
const KEY = "roadmap:pomodoro";
const FRESH: State = {
  mode: "focus",
  endsAt: null,
  remaining: null,
  phaseMs: null,
  taskId: "",
  taskTitle: "",
  notify: false,
};
const SERVER_SNAPSHOT = JSON.stringify(FRESH);

// Tiny external store so the timer survives navigation and syncs across tabs.
let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string {
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
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    memory = event.newValue;
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function parse(raw: string): State {
  try {
    return { ...FRESH, ...(JSON.parse(raw) as Partial<State>) };
  } catch {
    return FRESH;
  }
}

function subscribeFullscreen(listener: () => void) {
  document.addEventListener("fullscreenchange", listener);
  return () => document.removeEventListener("fullscreenchange", listener);
}

// Plain helpers kept outside the component so they can read the clock / touch globals.
const nowMs = () => Date.now();
const readState = () => parse(readRaw());

function writeState(next: State) {
  memory = JSON.stringify(next);
  try {
    localStorage.setItem(KEY, memory);
  } catch {}
  listeners.forEach((listener) => listener());
}

function setDocumentTitle(title: string) {
  document.title = title;
}

function toggleTimer(ms: Durations) {
  const s = readState();
  if (s.endsAt !== null) {
    writeState({ ...s, endsAt: null, remaining: Math.max(0, s.endsAt - nowMs()) });
  } else {
    const fresh = s.remaining === null;
    writeState({
      ...s,
      endsAt: nowMs() + (s.remaining ?? ms[s.mode]),
      phaseMs: fresh ? ms[s.mode] : (s.phaseMs ?? ms[s.mode]),
    });
  }
}

function resetTimer() {
  writeState({ ...readState(), endsAt: null, remaining: null, phaseMs: null });
}

function switchMode(mode: Mode) {
  writeState({ ...readState(), mode, endsAt: null, remaining: null, phaseMs: null });
}

/** The break after the Nth focus session of the day: every 4th earns a long one. */
const breakAfter = (sessionsToday: number): Mode => (sessionsToday > 0 && sessionsToday % 4 === 0 ? "long" : "short");

// One shared AudioContext. Browsers keep a new context "suspended" until the page has had a
// click or key press, so it is unlocked on the first gesture and reused. The end-of-timer chime
// is then scheduled on the audio clock, which keeps ticking in background tabs where setInterval
// is throttled to about once a minute.
let audioCtx: AudioContext | null = null;
let scheduled: { endsAt: number; stop: () => void } | null = null;

function getAudio() {
  try {
    audioCtx ??= new AudioContext();
  } catch {
    return null;
  }
  return audioCtx;
}

async function unlockAudio() {
  const ctx = getAudio();
  if (!ctx) return false;
  if (ctx.state !== "running") await ctx.resume().catch(() => {});
  return ctx.state === "running";
}

/** Plays the three-note chime `delay` seconds from now; returns a function that cancels it. */
function playChime(delay = 0) {
  const ctx = getAudio();
  if (!ctx) return () => {};
  const nodes: OscillatorNode[] = [];
  [660, 880, 1100, 880, 1100].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t = ctx.currentTime + delay + i * 0.22;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    osc.start(t);
    osc.stop(t + 0.36);
    nodes.push(osc);
  });
  return () => nodes.forEach((osc) => { try { osc.stop(); } catch {} });
}

function scheduleChime(endsAt: number) {
  if (scheduled?.endsAt === endsAt) return;
  cancelChime();
  if (audioCtx?.state !== "running") return;
  scheduled = { endsAt, stop: playChime(Math.max(0, (endsAt - nowMs()) / 1000)) };
}

function cancelChime() {
  scheduled?.stop();
  scheduled = null;
}

/** Finishes the current phase: saves a focus session and lines up the next phase. */
function completePhase(s: State, ms: Durations, sessionsToday: number) {
  const finishedFocus = s.mode === "focus";
  const mode: Mode = finishedFocus ? breakAfter(sessionsToday + 1) : "focus";
  if (finishedFocus) {
    const taskId = Number(s.taskId) || null;
    logPomodoroSession(todayISO(), (s.phaseMs ?? ms.focus) / 60_000, taskId, s.taskTitle || null).catch(() => {});
  }
  writeState({ ...s, mode, endsAt: null, remaining: null, phaseMs: null });
  // The chime was already queued on the audio clock when the timer started; only play it now
  // if that never happened (audio was still locked), so it never doubles up.
  const alreadyQueued = scheduled?.endsAt === s.endsAt && audioCtx?.state === "running";
  scheduled = null;
  if (!alreadyQueued) playChime();
  if (s.notify && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(finishedFocus ? "🍅 Pomodoro done!" : "☕ Break's over", {
        body: finishedFocus ? `Nice work. Time for a ${MODES[mode].label.toLowerCase()}.` : "Back to focus when you're ready.",
        silent: false,
        requireInteraction: true,
      });
    } catch {}
  }
}

/** Jumps to the next phase without saving it as a finished pomodoro. */
function skipPhase(sessionsToday: number) {
  const s = readState();
  const mode: Mode = s.mode === "focus" ? breakAfter(sessionsToday + 1) : "focus";
  writeState({ ...s, mode, endsAt: null, remaining: null, phaseMs: null });
}

function enableNotifications() {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then((permission) => {
    if (permission === "granted") writeState({ ...readState(), notify: true });
  });
}

/** Rounded so server and browser trig output serialise identically (avoids hydration mismatches). */
const polar = (radius: number, angle: number, axis: "x" | "y") =>
  Math.round((70 + radius * (axis === "x" ? Math.cos(angle) : Math.sin(angle))) * 100) / 100;

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export type PomodoroTask = { id: number; title: string; projectName: string };
export type PomodoroTodaySession = { id: number; minutes: number; taskTitle: string | null; completedAt: string };

export function PomodoroTimer({
  tasks,
  durations,
  todaySessions,
}: {
  tasks: PomodoroTask[];
  /** Minutes per mode, from saved settings. */
  durations: Durations;
  todaySessions: PomodoroTodaySession[];
}) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => SERVER_SNAPSHOT);
  const isFullscreen = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);
  const state = parse(raw);
  const [now, setNow] = useState(nowMs);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Durations>(durations);
  const [saving, startSaving] = useTransition();
  const ringRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const ms: Durations = {
    focus: durations.focus * 60_000,
    short: durations.short * 60_000,
    long: durations.long * 60_000,
  };
  const sessionsToday = todaySessions.length;
  // Latest values for the interval / keyboard handlers, which outlive a render.
  const live = useRef({ ms, sessionsToday });
  useEffect(() => {
    live.current = { ms, sessionsToday };
  });

  const config = MODES[state.mode];
  const running = state.endsAt !== null;
  const fresh = !running && state.remaining === null;
  const total = fresh ? ms[state.mode] : (state.phaseMs ?? ms[state.mode]);
  const remaining = running ? Math.max(0, state.endsAt! - now) : (state.remaining ?? ms[state.mode]);
  const progress = Math.min(1, Math.max(0, 1 - remaining / total));
  const isBreak = state.mode !== "focus";
  const urgent = running && remaining <= 10_000;
  const task = tasks.find((t) => String(t.id) === state.taskId);
  const tips = isBreak ? BREAK_TIPS : FOCUS_TIPS;
  const tipIndex = Math.floor((total - remaining) / 90_000) % tips.length;
  const headAngle = -Math.PI / 2 + (1 - progress) * 2 * Math.PI;
  const setCount = state.mode === "long" && sessionsToday > 0 && sessionsToday % 4 === 0 ? 4 : sessionsToday % 4;
  const focusedMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);
  const clock = formatClock(remaining);

  // Unlock audio on the first click or key press anywhere on the page.
  const [audioReady, setAudioReady] = useState(false);
  useEffect(() => {
    const unlock = () => {
      unlockAudio().then((ok) => {
        if (!ok) return;
        setAudioReady(true);
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      });
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  // Queue the chime on the audio clock while a timer runs; cancel it on pause / reset / skip.
  const endsAt = state.endsAt;
  useEffect(() => {
    if (endsAt === null) {
      cancelChime();
      return;
    }
    scheduleChime(endsAt);
  }, [endsAt, audioReady]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      const t = nowMs();
      setNow(t);
      const current = readState();
      if (current.endsAt === null || t < current.endsAt) return;
      completePhase(current, live.current.ms, live.current.sessionsToday);
      if (ringRef.current) burstConfetti(ringRef.current, 32);
    }, 250);
    return () => window.clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const previous = document.title;
    setDocumentTitle(`${formatClock(remaining)} · ${config.emoji} ${config.label}`);
    return () => setDocumentTitle(previous);
  }, [running, remaining, config.label, config.emoji]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else panelRef.current?.requestFullscreen().catch(() => {});
  }

  // Keyboard: Space start/pause, R reset, 1/2/3 modes, F fullscreen.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]") || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === " ") {
        event.preventDefault();
        toggleTimer(live.current.ms);
      } else if (key === "r") resetTimer();
      else if (key === "1" || key === "2" || key === "3") switchMode(MODE_ORDER[Number(key) - 1]);
      else if (key === "f") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else panelRef.current?.requestFullscreen().catch(() => {});
        return;
      } else return;
      setNow(nowMs());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const act = (fn: () => void) => () => {
    fn();
    setNow(nowMs());
  };

  function openSettings() {
    setDraft(durations);
    setEditing((open) => !open);
  }

  function saveSettings() {
    startSaving(async () => {
      const saved = await savePomodoroSettings(draft.focus, draft.short, draft.long);
      if (saved) setEditing(false);
    });
  }

  return (
    <div className="space-y-6">
      <div
        ref={panelRef}
        data-mode={state.mode}
        style={{ "--mode": config.color } as React.CSSProperties}
        className={clsx("pomo-panel relative overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8", running && "is-running")}
      >
        <div aria-hidden className="pomo-blob pomo-blob-one" />
        <div aria-hidden className="pomo-blob pomo-blob-two" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
          <div className="pomo-tabs" role="group" aria-label="Timer mode" style={{ "--tab": MODE_ORDER.indexOf(state.mode) } as React.CSSProperties}>
            <span aria-hidden className="pomo-tab-pill" />
            {MODE_ORDER.map((mode, index) => (
              <button
                key={mode}
                type="button"
                onClick={act(() => switchMode(mode))}
                aria-pressed={state.mode === mode}
                aria-keyshortcuts={String(index + 1)}
                className={clsx("pomo-tab", state.mode === mode && "is-active")}
              >
                <span aria-hidden>{MODES[mode].emoji}</span>
                <span className="hidden sm:inline">{MODES[mode].label}</span>
                <span className="opacity-60">{durations[mode]}m</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openSettings}
              aria-expanded={editing}
              aria-controls="pomodoro-settings"
              className={clsx("pomo-icon-btn", editing && "is-on")}
              title="Edit durations"
            >
              <span aria-hidden className="pomo-gear">⚙</span>
            </button>
            <button
              type="button"
              onClick={() => unlockAudio().then(() => playChime())}
              className="pomo-icon-btn"
              title="Test the alarm sound"
              aria-label="Test the alarm sound"
            >
              🔊
            </button>
            <button
              type="button"
              onClick={state.notify ? () => writeState({ ...state, notify: false }) : enableNotifications}
              aria-pressed={state.notify}
              className="pomo-icon-btn"
              title={state.notify ? "Notifications on" : "Notify me when time is up"}
            >
              {state.notify ? "🔔" : "🔕"}
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-keyshortcuts="f"
              className="pomo-icon-btn"
              title={isFullscreen ? "Exit zen mode" : "Zen mode (fullscreen)"}
            >
              {isFullscreen ? "✕" : "⛶"}
            </button>
          </div>
        </div>

        {editing ? (
          <form
            id="pomodoro-settings"
            onSubmit={(event) => {
              event.preventDefault();
              saveSettings();
            }}
            className="pomo-settings relative z-10 mt-5 rounded-2xl border-2 border-white/20 bg-white/[0.07] p-4"
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-display text-lg font-bold">Timer lengths</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const active = MODE_ORDER.every((mode) => draft[mode] === preset.minutes[mode]);
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setDraft(preset.minutes)}
                      className={clsx("pomo-chip", active && "is-active")}
                    >
                      {preset.label} {preset.minutes.focus}/{preset.minutes.short}/{preset.minutes.long}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODE_ORDER.map((mode) => (
                <div key={mode} className="rounded-xl border-2 border-white/15 bg-ink/40 p-3" style={{ "--mode": MODES[mode].color } as React.CSSProperties}>
                  <label htmlFor={`pomo-${mode}`} className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--mode)" }}>
                    {MODES[mode].emoji} {MODES[mode].label}
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Less ${MODES[mode].label}`}
                      onClick={() => setDraft((d) => ({ ...d, [mode]: Math.max(1, d[mode] - (d[mode] > 10 ? 5 : 1)) }))}
                      className="pomo-step"
                    >
                      −
                    </button>
                    <input
                      id={`pomo-${mode}`}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={MODES[mode].max}
                      value={draft[mode]}
                      onChange={(event) => setDraft((d) => ({ ...d, [mode]: Number(event.target.value) }))}
                      className="pomo-number"
                    />
                    <button
                      type="button"
                      aria-label={`More ${MODES[mode].label}`}
                      onClick={() => setDraft((d) => ({ ...d, [mode]: Math.min(MODES[mode].max, d[mode] + (d[mode] >= 10 ? 5 : 1)) }))}
                      className="pomo-step"
                    >
                      +
                    </button>
                    <span className="text-xs font-bold text-white/50">min</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={saving} className="pomo-primary">
                {saving ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="pomo-secondary">
                Cancel
              </button>
              <p className="text-xs font-semibold text-white/50">A running or paused timer keeps its length until you reset it.</p>
            </div>
          </form>
        ) : null}

        <div className="relative z-10 mt-6 grid items-center gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div ref={ringRef} className={clsx("pomo-ring relative mx-auto", urgent && "is-urgent")}>
            <svg viewBox="0 0 140 140" className="h-full w-full" aria-hidden>
              {Array.from({ length: 60 }, (_, i) => {
                const a = (i / 60) * 2 * Math.PI - Math.PI / 2;
                const inner = i % 5 === 0 ? 61 : 63;
                const lit = i / 60 < 1 - progress;
                return (
                  <line
                    key={i}
                    x1={polar(inner, a, "x")}
                    y1={polar(inner, a, "y")}
                    x2={polar(66, a, "x")}
                    y2={polar(66, a, "y")}
                    strokeWidth={i % 5 === 0 ? 1.6 : 1}
                    strokeLinecap="round"
                    className="transition-[stroke] duration-500"
                    style={{ stroke: lit ? "var(--mode)" : "rgb(255 255 255 / 0.18)" }}
                  />
                );
              })}
              <circle cx={70} cy={70} r={R} fill="none" strokeWidth={9} stroke="rgb(255 255 255 / 0.08)" />
              <circle
                cx={70}
                cy={70}
                r={R}
                fill="none"
                strokeWidth={9}
                strokeLinecap="round"
                strokeDasharray={RING}
                strokeDashoffset={RING * progress}
                transform="rotate(-90 70 70)"
                className="pomo-arc"
              />
              <circle cx={polar(R, headAngle, "x")} cy={polar(R, headAngle, "y")} r={6.5} className="pomo-head" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span aria-hidden className={clsx("text-3xl sm:text-4xl", running && "pomodoro-bounce")}>{config.emoji}</span>
              <p role="timer" aria-label={`${clock} left`} className="pomo-clock font-display font-bold tabular-nums">
                {clock.split("").map((ch, i) => (
                  <span key={`${i}-${ch}`} className={ch === ":" ? "pomo-colon" : "pomo-digit"}>
                    {ch}
                  </span>
                ))}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
                {running ? (isBreak ? "Recharging" : "In the zone") : fresh ? config.label : "Paused"}
              </p>
            </div>
            <div aria-hidden className="pomo-cat">
              <CatSvg phase={running && isBreak ? "napping" : "idle"} />
              {running && isBreak ? (
                <span className="pomo-zzz">
                  <span>z</span>
                  <span>z</span>
                  <span>Z</span>
                </span>
              ) : null}
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <label htmlFor="pomodoro-task" className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.18em] text-white/60">
                Focusing on
              </label>
              <Select
                id="pomodoro-task"
                value={task ? state.taskId : ""}
                onChange={(event) => {
                  const picked = tasks.find((t) => String(t.id) === event.target.value);
                  writeState({ ...state, taskId: event.target.value, taskTitle: picked?.title ?? "" });
                }}
                className="text-ink"
              >
                <option value="">Anything that matters</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} · {t.projectName}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={act(() => toggleTimer(ms))} aria-keyshortcuts="Space" className="pomo-primary">
                {running ? "⏸ Pause" : fresh ? "▶ Start" : "▶ Resume"}
              </button>
              <button type="button" onClick={act(resetTimer)} disabled={fresh} aria-keyshortcuts="r" className="pomo-secondary">
                ↺ Reset
              </button>
              <button type="button" onClick={act(() => skipPhase(sessionsToday))} className="pomo-secondary" title="Skip to the next phase">
                ⏭ Skip
              </button>
            </div>

            <div key={`${state.mode}-${tipIndex}`} className="pomo-tip rounded-2xl border-2 border-white/15 bg-white/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--mode)" }}>
                {isBreak ? "Break idea" : "Focus tip"}
              </p>
              <p className="mt-1 font-display text-lg font-bold leading-snug">
                {!fresh ? tips[tipIndex] : isBreak ? "Your break is ready. You earned it." : "Press Start (or Space) when you're ready."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5" aria-label={`${setCount} of 4 pomodoros in this set`}>
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} aria-hidden className={clsx("pomo-set-dot", i < setCount && "is-filled")} />
                ))}
              </div>
              <span className="text-xs font-semibold text-white/60">4 in a set earns a long break</span>
            </div>

            <p className="hidden text-[11px] font-semibold text-white/40 sm:block">
              <kbd>Space</kbd> start / pause · <kbd>R</kbd> reset · <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> modes · <kbd>F</kbd> zen mode
            </p>
          </div>
        </div>
      </div>

      <Card className="border-t-[8px] border-t-orange">
        <div className="mb-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange">Today&rsquo;s harvest</p>
          <h2 className="font-display text-2xl font-bold">
            {sessionsToday} {sessionsToday === 1 ? "pomodoro" : "pomodoros"} · {focusedMinutes} min focused
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-x-5 gap-y-3" aria-label="Pomodoros grown today">
          {Array.from({ length: Math.ceil((sessionsToday + 1) / 4) }, (_, setIndex) => (
            <div key={setIndex} className="flex items-end gap-1 rounded-xl border-2 border-dashed border-ink/15 bg-orange/5 px-2 py-1.5">
              {Array.from({ length: 4 }, (_, i) => {
                const n = setIndex * 4 + i;
                const grown = n < sessionsToday;
                const growing = n === sessionsToday && running && !isBreak;
                return (
                  <span
                    key={i}
                    aria-hidden
                    className={clsx("pomo-plant", grown && "is-grown")}
                    style={growing ? { transform: `scale(${0.55 + 0.45 * progress})` } : undefined}
                  >
                    {grown ? "🍅" : growing ? "🌱" : "·"}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        {sessionsToday === 0 ? (
          <p className="mt-4 text-sm font-semibold text-muted">Finish a focus session to grow your first tomato.</p>
        ) : null}
      </Card>
    </div>
  );
}

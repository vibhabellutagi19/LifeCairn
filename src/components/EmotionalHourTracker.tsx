"use client";

import { type FormEvent, useState, useTransition } from "react";
import { clsx } from "clsx";
import {
  clearEmotionalCheckin,
  createCustomEmotion,
  saveEmotionalTrackingWindow,
  setEmotionalCheckin,
} from "@/lib/actions/emotions";
import {
  customEmotionKey,
  EMOTIONS,
  formatHour,
  type EmotionCategory,
  type EmotionOption,
} from "@/lib/emotions";
import { burstConfetti } from "@/lib/confetti";

export type EmotionalCheckinEntry = {
  hour: number;
  emotion: string;
};

export type CustomEmotionDefinition = {
  id: number;
  name: string;
  emoji: string;
  category: EmotionCategory;
};

function compactHour(hour: number) {
  if (hour === 0) return "12a";
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return "12p";
  return `${hour - 12}p`;
}

const DONUT_R = 48;
const DONUT_C = 2 * Math.PI * DONUT_R;
const VALENCE: Record<EmotionCategory, number> = { positive: 1, missing: 0.7, negative: -1 };

/** Tile colour for an hour, following the sky from night through dawn, day and dusk. */
function skyFor(hour: number): { bg: string; dark: boolean } {
  if (hour < 5 || hour >= 21) return { bg: "#262b52", dark: true };
  if (hour < 8) return { bg: "#ffd9cc", dark: false };
  if (hour < 12) return { bg: "#d9edff", dark: false };
  if (hour < 16) return { bg: "#c4e4ff", dark: false };
  if (hour < 19) return { bg: "#ffe3a3", dark: false };
  return { bg: "#f4b8cf", dark: false };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Smooth Catmull-Rom curve through the points, as an SVG path. */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: round2(p1.x + (p2.x - p0.x) / 6), y: round2(p1.y + (p2.y - p0.y) / 6) };
    const c2 = { x: round2(p2.x - (p3.x - p1.x) / 6), y: round2(p2.y - (p3.y - p1.y) / 6) };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function clampHour(hour: number, startHour: number, endHour: number) {
  return Math.min(Math.max(hour, startHour), endHour);
}

export function EmotionalHourTracker({
  date,
  entries: initialEntries,
  defaultHour,
  trackingWindow,
  customEmotions: initialCustomEmotions,
}: {
  date: string;
  entries: EmotionalCheckinEntry[];
  defaultHour: number;
  trackingWindow: { startHour: number; endHour: number };
  customEmotions: CustomEmotionDefinition[];
}) {
  const [startHour, setStartHour] = useState(trackingWindow.startHour);
  const [endHour, setEndHour] = useState(trackingWindow.endHour);
  const [draftStartHour, setDraftStartHour] = useState(trackingWindow.startHour);
  const [draftEndHour, setDraftEndHour] = useState(trackingWindow.endHour);
  const [selectedHour, setSelectedHour] = useState(
    clampHour(defaultHour, trackingWindow.startHour, trackingWindow.endHour)
  );
  const [entries, setEntries] = useState(initialEntries);
  const [customEmotions, setCustomEmotions] = useState(initialCustomEmotions);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showWindow, setShowWindow] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmoji, setCustomEmoji] = useState("");
  const [customCategory, setCustomCategory] = useState<EmotionCategory>("positive");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const emotionOptions: EmotionOption[] = [
    ...EMOTIONS,
    ...customEmotions.map((emotion) => ({
      key: customEmotionKey(emotion.id),
      label: emotion.name,
      emoji: emotion.emoji,
      category: emotion.category,
    })),
  ];
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
  const selectedEntry = entries.find((entry) => entry.hour === selectedHour);
  const visibleEntries = entries.filter((entry) => entry.hour >= startHour && entry.hour <= endHour);
  const categorizedEntries = visibleEntries
    .map((entry) => emotionOptions.find((emotion) => emotion.key === entry.emotion))
    .filter((emotion): emotion is EmotionOption => Boolean(emotion));
  const positiveCount = categorizedEntries.filter((emotion) => emotion.category === "positive").length;
  const negativeCount = categorizedEntries.filter((emotion) => emotion.category === "negative").length;
  const categorizedCount = positiveCount + negativeCount;
  const positivePercent = categorizedCount > 0 ? Math.round((positiveCount / categorizedCount) * 100) : 0;
  const negativePercent = categorizedCount > 0 ? 100 - positivePercent : 0;
  const emotionTally = new Map<string, number>();
  for (const entry of visibleEntries) {
    emotionTally.set(entry.emotion, (emotionTally.get(entry.emotion) ?? 0) + 1);
  }
  const repeatedGroups = [...emotionTally.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ option: emotionOptions.find((emotion) => emotion.key === key), count }))
    .sort((a, b) => b.count - a.count);
  const repeatedCount = repeatedGroups.reduce((sum, group) => sum + group.count, 0);
  const repeatedPercent = visibleEntries.length > 0 ? Math.round((repeatedCount / visibleEntries.length) * 100) : 0;
  // Missing = feelings the user created as "missing" (what they want more of).
  const missingEmotions = emotionOptions.filter((emotion) => emotion.category === "missing");
  const missingFelt = missingEmotions.filter((emotion) => emotionTally.has(emotion.key)).length;
  const missingCount = categorizedEntries.filter((emotion) => emotion.category === "missing").length;

  // Donut: share of the day's hours per category; the uncoloured rest is unlogged.
  let donutOffset = 0;
  const donutSegments = [
    { key: "positive", count: positiveCount, stroke: "stroke-green" },
    { key: "negative", count: negativeCount, stroke: "stroke-orange" },
    { key: "missing", count: missingCount, stroke: "stroke-pink" },
  ].map((segment) => {
    const length = round2((segment.count / Math.max(hours.length, 1)) * DONUT_C);
    const result = { ...segment, length, offset: donutOffset };
    donutOffset = round2(donutOffset + length);
    return result;
  });

  // Mood wave: one point per logged hour, higher = lighter feelings.
  const wavePoints = hours.flatMap((hour, index) => {
    const entry = entries.find((item) => item.hour === hour);
    const option = emotionOptions.find((item) => item.key === entry?.emotion);
    if (!option) return [];
    return [{
      hour,
      emoji: option.emoji,
      label: option.label,
      x: round2(((index + 0.5) / hours.length) * 100),
      y: round2(50 - VALENCE[option.category] * 28),
    }];
  });
  const wavePath = smoothPath(wavePoints);

  function chooseEmotion(emotion: string, source?: Element) {
    const option = emotionOptions.find((item) => item.key === emotion);
    if (source && option && selectedEntry?.emotion !== emotion) burstConfetti(source, 10, [option.emoji, "✦"]);
    const previousEntries = entries;
    const nextEntries = [
      ...entries.filter((entry) => entry.hour !== selectedHour),
      { hour: selectedHour, emotion },
    ].sort((a, b) => a.hour - b.hour);
    setEntries(nextEntries);
    setMessage(null);

    startTransition(async () => {
      try {
        await setEmotionalCheckin(date, selectedHour, emotion);
      } catch {
        setEntries(previousEntries);
        setMessage("That feeling could not be saved. Please try again.");
      }
    });
  }

  function clearSelectedHour() {
    const previousEntries = entries;
    setEntries(entries.filter((entry) => entry.hour !== selectedHour));
    setMessage(null);

    startTransition(async () => {
      try {
        await clearEmotionalCheckin(date, selectedHour);
      } catch {
        setEntries(previousEntries);
        setMessage("That check-in could not be cleared. Please try again.");
      }
    });
  }

  function saveWindow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draftStartHour >= draftEndHour) {
      setMessage("Your end time needs to be later than your start time.");
      return;
    }

    const previousStart = startHour;
    const previousEnd = endHour;
    setStartHour(draftStartHour);
    setEndHour(draftEndHour);
    setSelectedHour((hour) => clampHour(hour, draftStartHour, draftEndHour));
    setMessage("Day preset saved.");

    startTransition(async () => {
      try {
        const saved = await saveEmotionalTrackingWindow(draftStartHour, draftEndHour);
        if (!saved) throw new Error("Invalid window");
      } catch {
        setStartHour(previousStart);
        setEndHour(previousEnd);
        setSelectedHour((hour) => clampHour(hour, previousStart, previousEnd));
        setMessage("Your day preset could not be saved. Please try again.");
      }
    });
  }

  function addCustomEmotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customName.trim()) {
      setMessage("Give your emotion a name first.");
      return;
    }
    setMessage(null);

    startTransition(async () => {
      try {
        const created = await createCustomEmotion(customName, customEmoji, customCategory);
        if (!created) throw new Error("Emotion not created");
        setCustomEmotions((current) => {
          if (current.some((emotion) => emotion.id === created.id)) return current;
          return [...current, {
            id: created.id,
            name: created.name,
            emoji: created.emoji,
            category: created.category,
          }];
        });
        setCustomName("");
        setCustomEmoji("");
        setShowCustomForm(false);
        setMessage(`${created.name} was added to your emotions.`);
      } catch {
        setMessage("That emotion could not be added. Try a different name.");
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setShowWindow((open) => !open)}
          aria-expanded={showWindow}
          className="mood-window-toggle inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-ink/15 bg-surface px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-muted hover:border-ink hover:text-ink sm:min-h-0"
        >
          <span aria-hidden className="mood-gear">⚙</span> Day window · {formatHour(startHour)} – {formatHour(endHour)}
        </button>
      </div>
      {showWindow ? (
      <form onSubmit={saveWindow} className="mood-slide-in mb-5 rounded-xl border-2 border-ink/15 bg-background/70 p-3 sm:p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto min-w-[12rem]">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink">Your day preset</p>
            <p className="mt-1 text-sm font-semibold text-muted">Only these hours appear in your emotional day.</p>
          </div>
          <label className="min-w-[8.5rem] flex-1 sm:max-w-44">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Start time</span>
            <select
              value={draftStartHour}
              onChange={(event) => setDraftStartHour(Number(event.target.value))}
              className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-sm font-bold"
            >
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{formatHour(hour)}</option>)}
            </select>
          </label>
          <label className="min-w-[8.5rem] flex-1 sm:max-w-44">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">End time</span>
            <select
              value={draftEndHour}
              onChange={(event) => setDraftEndHour(Number(event.target.value))}
              className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-sm font-bold"
            >
              {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{formatHour(hour)}</option>)}
            </select>
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="brut-border brut-shadow-sm brut-press min-h-11 rounded-md bg-ink px-4 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:opacity-60"
          >
            Save preset
          </button>
        </div>
      </form>
      ) : null}

      <div className="mb-6 grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="climate-donut relative mx-auto h-44 w-44">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx={60} cy={60} r={DONUT_R} fill="none" strokeWidth={16} className="stroke-ink/10" />
            {donutSegments.map((segment) =>
              segment.length > 0 ? (
                <circle
                  key={segment.key}
                  cx={60}
                  cy={60}
                  r={DONUT_R}
                  fill="none"
                  strokeWidth={16}
                  strokeDasharray={`${segment.length} ${DONUT_C - segment.length}`}
                  strokeDashoffset={-segment.offset}
                  className={clsx("climate-segment", segment.stroke)}
                />
              ) : null
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <p className="font-display text-3xl font-bold leading-none">
              {visibleEntries.length}
              <span className="text-lg text-muted">/{hours.length}</span>
            </p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">hours noticed</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <div className="climate-tile">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green">● Positive</p>
            <p className="font-display text-3xl font-bold">{positivePercent}%</p>
            <p className="text-xs font-bold text-muted">{positiveCount} {positiveCount === 1 ? "hour" : "hours"}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-green transition-[width] duration-700" style={{ width: `${positivePercent}%` }} />
            </div>
          </div>
          <div className="climate-tile">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange">● Negative</p>
            <p className="font-display text-3xl font-bold">{negativePercent}%</p>
            <p className="text-xs font-bold text-muted">{negativeCount} {negativeCount === 1 ? "hour" : "hours"}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
              <div className="h-full bg-orange transition-[width] duration-700" style={{ width: `${negativePercent}%` }} />
            </div>
          </div>
          <div className="climate-tile">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue">↻ Repeated</p>
            <p className="font-display text-3xl font-bold">{repeatedPercent}%</p>
            <p className="line-clamp-2 text-xs font-semibold text-muted">
              {repeatedGroups.length === 0
                ? "No feeling has repeated yet"
                : repeatedGroups.slice(0, 3).map((group) => `${group.option?.emoji ?? ""} ×${group.count}`).join("  ")}
            </p>
          </div>
          <div className="climate-tile">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-pink">✦ Missing</p>
            <p className="font-display text-3xl font-bold">
              {missingEmotions.length === 0 ? "–" : missingFelt}
              {missingEmotions.length > 0 ? <span className="text-lg text-muted">/{missingEmotions.length}</span> : null}
            </p>
            <p className="line-clamp-2 text-xs font-semibold text-muted">
              {missingEmotions.length === 0
                ? "Add feelings you want more of"
                : missingFelt === 0
                  ? "Wanted feelings not felt yet"
                  : "wanted feelings felt today"}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Your sky today</p>
          <button
            type="button"
            onClick={() => setSelectedHour(clampHour(defaultHour, startHour, endHour))}
            className="-my-3 py-3 text-xs font-bold text-pink underline decoration-2 underline-offset-4"
          >
            Jump to now
          </button>
        </div>
        <div className="sky-scroll -mx-1 overflow-x-auto px-1 pb-2">
          <div className="relative" style={{ minWidth: `${hours.length * 3.25}rem` }}>
            <div className="sky-wave relative mb-8 h-28 rounded-xl border-2 border-ink/10 bg-background/60">
              <span aria-hidden className="absolute left-2 top-1 text-[9px] font-bold uppercase tracking-wide text-green">lighter</span>
              <span aria-hidden className="absolute bottom-1 left-2 text-[9px] font-bold uppercase tracking-wide text-orange">heavier</span>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                <line x1={0} y1={50} x2={100} y2={50} className="stroke-ink/15" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
                {wavePath ? (
                  <>
                    <path d={`${wavePath} L ${wavePoints[wavePoints.length - 1].x} 100 L ${wavePoints[0].x} 100 Z`} className="sky-wave-fill" />
                    <path d={wavePath} fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="sky-wave-line" />
                  </>
                ) : null}
              </svg>
              {wavePoints.map((point) => (
                <button
                  key={point.hour}
                  type="button"
                  onClick={() => setSelectedHour(point.hour)}
                  aria-label={`${formatHour(point.hour)}: ${point.label}`}
                  className={clsx("sky-wave-dot", point.hour === selectedHour && "is-selected")}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  {point.emoji}
                </button>
              ))}
              {wavePoints.length === 0 ? (
                <p className="sticky left-0 flex h-full w-[min(100%,calc(100vw-5rem))] items-center justify-center px-4 text-center text-xs font-semibold text-muted">
                  Your mood wave draws itself as you check in.
                </p>
              ) : null}
            </div>

            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${hours.length}, minmax(0, 1fr))` }} role="list" aria-label="Hourly emotional check-ins">
              {hours.map((hour) => {
                const entry = entries.find((item) => item.hour === hour);
                const emotion = emotionOptions.find((item) => item.key === entry?.emotion);
                const isSelected = selectedHour === hour;
                const isCurrent = defaultHour === hour;
                const sky = skyFor(hour);

                return (
                  <button
                    key={hour}
                    type="button"
                    onClick={() => setSelectedHour(hour)}
                    aria-pressed={isSelected}
                    aria-label={`${formatHour(hour)}${emotion ? `, ${emotion.label}` : ", not checked in"}${isCurrent ? ", current hour" : ""}`}
                    className={clsx(
                      "sky-tile mood-tile relative min-h-16 min-w-0 rounded-lg border-2 px-1 py-1.5 text-center",
                      isSelected ? "is-selected border-ink" : "border-ink/20",
                      emotion && `has-${emotion.category}`
                    )}
                    style={{ background: isSelected ? "var(--ink)" : sky.bg, color: isSelected || sky.dark ? "#fff" : "var(--ink)" }}
                  >
                    {isCurrent ? (
                      <span aria-hidden className="sky-now">{hour >= 6 && hour < 19 ? "☀️" : "🌙"}</span>
                    ) : null}
                    <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">{compactHour(hour)}</span>
                    <span key={emotion?.key ?? "none"} className={clsx("mt-0.5 block min-h-6 text-lg", emotion && "mood-tile-emoji")} aria-hidden>
                      {emotion?.emoji ?? ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-2 border-ink/15 bg-background/70 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedHour((hour) => Math.max(startHour, hour - 1))}
                disabled={selectedHour <= startHour}
                aria-label="Previous hour"
                className="hour-step"
              >
                ‹
              </button>
              <p key={selectedHour} className="hour-label text-[11px] font-bold uppercase tracking-[0.18em] text-pink">{formatHour(selectedHour)}</p>
              <button
                type="button"
                onClick={() => setSelectedHour((hour) => Math.min(endHour, hour + 1))}
                disabled={selectedHour >= endHour}
                aria-label="Next hour"
                className="hour-step"
              >
                ›
              </button>
            </div>
            <h3 className="font-display text-xl font-bold">What are you feeling?</h3>
          </div>
          <div className="flex items-center gap-3">
            {isPending ? <span className="text-xs font-bold text-muted">Saving…</span> : null}
            {selectedEntry ? (
              <button
                type="button"
                onClick={clearSelectedHour}
                disabled={isPending}
                className="min-h-11 text-xs font-bold text-muted underline decoration-2 underline-offset-4 disabled:opacity-50 sm:min-h-0"
              >
                Clear hour
              </button>
            ) : null}
          </div>
        </div>

        {(["positive", "negative"] as const).map((category) => (
          <div key={category} className="mb-5 last:mb-0">
            <div className="mb-2 flex items-center gap-2">
              <span className={clsx("h-2.5 w-2.5 rounded-full", category === "positive" ? "bg-green" : "bg-orange")} />
              <p className="text-xs font-bold uppercase tracking-[0.16em]">
                {category === "positive" ? "Positive emotions" : "Negative emotions"}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="group" aria-label={`${category} emotions at ${formatHour(selectedHour)}`}>
              {emotionOptions.filter((emotion) => emotion.category === category).map((emotion) => {
                const isActive = selectedEntry?.emotion === emotion.key;
                return (
                  <button
                    key={emotion.key}
                    type="button"
                    disabled={isPending}
                    onClick={(event) => chooseEmotion(emotion.key, event.currentTarget)}
                    aria-pressed={isActive}
                    className={clsx(
                      "brut-border brut-shadow-sm brut-press min-h-14 rounded-md px-2 py-2 text-sm font-bold disabled:opacity-60",
                      isActive
                        ? category === "positive" ? "bg-green text-white" : "bg-orange text-white"
                        : "bg-surface hover:bg-yellow/60"
                    )}
                  >
                    <span aria-hidden className="mr-1.5 text-base">{emotion.emoji}</span>
                    {emotion.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="mb-5 mt-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted" />
            <p className="text-xs font-bold uppercase tracking-[0.16em]">Missing emotions</p>
          </div>
          {missingEmotions.length === 0 ? (
            <p className="text-sm font-semibold text-muted">Create the feelings you are missing for your manifestation.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" role="group" aria-label={`missing emotions at ${formatHour(selectedHour)}`}>
              {missingEmotions.map((emotion) => {
                const isActive = selectedEntry?.emotion === emotion.key;
                return (
                  <button
                    key={emotion.key}
                    type="button"
                    disabled={isPending}
                    onClick={(event) => chooseEmotion(emotion.key, event.currentTarget)}
                    aria-pressed={isActive}
                    className={clsx(
                      "brut-border brut-shadow-sm brut-press min-h-14 rounded-md border-dashed px-2 py-2 text-sm font-bold disabled:opacity-60",
                      isActive ? "bg-pink text-white" : "bg-surface hover:bg-yellow/60"
                    )}
                  >
                    <span aria-hidden className="mr-1.5 text-base">{emotion.emoji}</span>
                    {emotion.label}
                  </button>
                );
              })}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setCustomCategory("missing");
              setShowCustomForm(true);
            }}
            className="home-text-link mt-3 min-h-11 text-sm font-bold sm:min-h-0"
          >
            + Add a missing feeling
          </button>
        </div>

        <div className="mt-5 border-t-2 border-dashed border-ink/20 pt-4">
          {!showCustomForm ? (
            <button
              type="button"
              onClick={() => setShowCustomForm(true)}
              className="home-text-link min-h-11 text-sm font-bold sm:min-h-0"
            >
              + Add your own emotion
            </button>
          ) : (
            <form onSubmit={addCustomEmotion} className="grid gap-3 rounded-xl bg-surface p-3 sm:grid-cols-[5rem_minmax(0,1fr)_10rem_auto] sm:items-end">
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Emoji</span>
                <input
                  value={customEmoji}
                  onChange={(event) => setCustomEmoji(event.target.value)}
                  maxLength={8}
                  placeholder="◌"
                  aria-label="Emotion emoji"
                  className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-base"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Emotion name</span>
                <input
                  value={customName}
                  onChange={(event) => setCustomName(event.target.value)}
                  maxLength={60}
                  placeholder="Hopeful, lonely, grateful…"
                  className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-base font-medium sm:text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-muted">Category</span>
                <select
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value as EmotionCategory)}
                  className="brut-border min-h-11 w-full rounded-md bg-surface px-3 py-2 text-sm font-bold"
                >
                  <option value="positive">Positive</option>
                  <option value="negative">Negative</option>
                  <option value="missing">Missing</option>
                </select>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  className="brut-border min-h-11 rounded-md bg-surface px-3 py-2 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="brut-border brut-shadow-sm brut-press min-h-11 rounded-md bg-pink px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Add
                </button>
              </div>
            </form>
          )}
        </div>

        {message ? <p role="status" className="mt-3 text-sm font-bold text-muted">{message}</p> : null}
      </div>
    </div>
  );
}

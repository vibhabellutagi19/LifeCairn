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

  function chooseEmotion(emotion: string) {
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
      <form onSubmit={saveWindow} className="mb-5 rounded-xl border-2 border-ink/15 bg-background/70 p-3 sm:p-4">
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

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-ink/15 bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-green">Positive</p>
              <p className="font-display text-3xl font-bold">{positivePercent}%</p>
            </div>
            <p className="text-sm font-bold text-muted">{positiveCount} {positiveCount === 1 ? "hour" : "hours"}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full bg-green transition-[width]" style={{ width: `${positivePercent}%` }} />
          </div>
        </div>
        <div className="rounded-xl border-2 border-ink/15 bg-surface p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange">Negative</p>
              <p className="font-display text-3xl font-bold">{negativePercent}%</p>
            </div>
            <p className="text-sm font-bold text-muted">{negativeCount} {negativeCount === 1 ? "hour" : "hours"}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full bg-orange transition-[width]" style={{ width: `${negativePercent}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">Your emotional timeline</p>
          <p className="text-xs font-bold text-muted">{visibleEntries.length}/{hours.length} hours noticed</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-12" role="list" aria-label="Hourly emotional check-ins">
          {hours.map((hour) => {
            const entry = entries.find((item) => item.hour === hour);
            const emotion = emotionOptions.find((item) => item.key === entry?.emotion);
            const isSelected = selectedHour === hour;
            const isCurrent = defaultHour === hour;

            return (
              <button
                key={hour}
                type="button"
                onClick={() => setSelectedHour(hour)}
                aria-pressed={isSelected}
                aria-label={`${formatHour(hour)}${emotion ? `, ${emotion.label}` : ", not checked in"}${isCurrent ? ", current hour" : ""}`}
                className={clsx(
                  "brut-border min-h-14 min-w-0 rounded-md px-1 py-1.5 text-center transition-colors",
                  isSelected
                    ? "bg-ink text-white"
                    : entry
                      ? "bg-yellow/55 hover:bg-yellow"
                      : "bg-surface hover:bg-background"
                )}
              >
                <span className="block text-[9px] font-bold uppercase tracking-wide opacity-65">{compactHour(hour)}</span>
                <span className="mt-0.5 block min-h-5 text-base" aria-hidden>{emotion?.emoji ?? (isCurrent ? "•" : "")}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border-2 border-ink/15 bg-background/70 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-pink">{formatHour(selectedHour)}</p>
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
                    onClick={() => chooseEmotion(emotion.key)}
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

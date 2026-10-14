import Link from "next/link";
import { AffirmationCheckin } from "@/components/AffirmationCheckin";
import type { CustomEmotionDefinition, EmotionalCheckinEntry } from "@/components/EmotionalHourTracker";
import { Badge, Card } from "@/components/ui";
import type { AffirmationSlot } from "@/lib/actions/affirmations";
import { customEmotionKey, EMOTIONS, formatHour } from "@/lib/emotions";

export function ManifestationSection({
  showManifestation = true,
  showJournal = true,
  date,
  journalContent,
  activeAffirmationCount,
  affirmationCheckins,
  affirmationStreak,
  emotionalCheckins,
  customEmotions,
}: {
  /** Emotional weather and affirmations. */
  showManifestation?: boolean;
  /** The journal card. */
  showJournal?: boolean;
  date: string;
  journalContent?: string | null;
  activeAffirmationCount: number;
  affirmationCheckins: Record<AffirmationSlot, boolean>;
  affirmationStreak: number;
  emotionalCheckins: EmotionalCheckinEntry[];
  customEmotions: CustomEmotionDefinition[];
}) {
  const affirmationCheckinCount = Object.values(affirmationCheckins).filter(Boolean).length;

  const emotionLookup = new Map<string, { label: string; emoji: string }>([
    ...EMOTIONS.map((e) => [e.key, { label: e.label, emoji: e.emoji }] as const),
    ...customEmotions.map((e) => [customEmotionKey(e.id), { label: e.name, emoji: e.emoji }] as const),
  ]);
  const weather = emotionalCheckins
    .map((entry) => ({ hour: entry.hour, ...emotionLookup.get(entry.emotion) }))
    .filter((entry): entry is { hour: number; label: string; emoji: string } => Boolean(entry.label));
  const latest = weather[weather.length - 1];
  const tally = new Map<string, { label: string; emoji: string; count: number }>();
  for (const { label, emoji } of weather) {
    tally.set(label, { label, emoji, count: (tally.get(label)?.count ?? 0) + 1 });
  }
  const top = [...tally.values()].sort((a, b) => b.count - a.count)[0];

  return (
    <section aria-labelledby="manifestation-heading" className="home-scroll mt-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink">Mind · feeling · intention</p>
          <h2 id="manifestation-heading" className="font-display text-3xl font-bold sm:text-4xl"><span className="home-marker">{showManifestation ? "Manifestation" : "Journal"}</span></h2>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-relaxed text-muted">
            Notice what you feel, choose what you reinforce, and leave yourself something honest.
          </p>
        </div>
        {showManifestation ? (
          <Badge color="pink">{emotionalCheckins.length} emotional {emotionalCheckins.length === 1 ? "check-in" : "check-ins"}</Badge>
        ) : null}
      </div>

      {showManifestation ? (
      <Card className="home-panel border-t-[8px] border-t-pink">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink">Every hour</p>
            <h2 className="font-display text-2xl font-bold">Emotional weather</h2>
            <p className="mt-1 text-sm font-semibold text-muted">Today’s highlights.</p>
          </div>
          <span aria-hidden className="home-emoji flex h-11 w-11 items-center justify-center rounded-full bg-pink/15 text-xl">◌</span>
        </div>
        {weather.length === 0 ? (
          <p className="text-sm font-semibold text-muted">No check-ins yet today.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {latest ? (
              <Badge color="pink">
                Now {latest.emoji} {latest.label} · {formatHour(latest.hour)}
              </Badge>
            ) : null}
            {top && top.count > 1 ? (
              <Badge color="muted">
                Most often {top.emoji} {top.label} ×{top.count}
              </Badge>
            ) : null}
          </div>
        )}
        <Link href="/manifestation" className="home-text-link mt-4 text-sm font-bold">
          Open emotional weather <span aria-hidden>&rarr;</span>
        </Link>
      </Card>
      ) : null}

      <div className={`${showManifestation ? "mt-6" : ""} grid items-stretch gap-6 ${showManifestation && showJournal ? "lg:grid-cols-2" : ""}`}>
        {showJournal ? (
        <Card className="home-panel home-lift flex h-full flex-col border-t-[8px] border-t-blue">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue">Reflect</p>
              <h2 className="font-display text-2xl font-bold">Journal</h2>
            </div>
            <span aria-hidden className="home-emoji flex h-10 w-10 items-center justify-center rounded-full bg-blue/10 text-lg">✎</span>
          </div>
          {journalContent ? (
            <div className="mb-4 flex flex-1 flex-col rounded-xl border-2 border-ink/15 bg-blue/5 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue">From today</p>
              <p className="mt-2 line-clamp-5 text-sm font-medium leading-relaxed text-ink/75">{journalContent}</p>
            </div>
          ) : (
            <div className="mb-4 flex flex-1 flex-col justify-center rounded-xl border-2 border-dashed border-ink/20 bg-blue/5 p-4">
              <p className="font-display text-lg font-bold">What keeps returning to your mind?</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">Follow the feeling. Write without trying to make it tidy.</p>
            </div>
          )}
          <Link
            href={`/journal/${date}`}
            className="brut-border brut-shadow-sm brut-press mt-auto inline-flex min-h-11 w-full items-center justify-center rounded-md bg-blue px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
          >
            {journalContent ? "Continue journaling" : "Open today’s journal"}
          </Link>
        </Card>
        ) : null}

        {showManifestation ? (
        <Card className="home-panel home-lift flex h-full flex-col border-t-[8px] border-t-yellow">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Reinforce</p>
              <h2 className="font-display text-2xl font-bold">Affirmations</h2>
            </div>
            <Badge color={affirmationCheckinCount === 3 ? "green" : "yellow"}>{affirmationCheckinCount}/3 today</Badge>
          </div>
          {activeAffirmationCount > 0 ? (
            <div className="mb-4 flex flex-1 flex-col justify-center rounded-xl border-2 border-ink/15 bg-yellow/20 p-4">
              <p className="text-sm font-semibold leading-relaxed text-muted">
                {activeAffirmationCount} {activeAffirmationCount === 1 ? "thought" : "thoughts"} in your practice
                {affirmationStreak > 0 ? ` · ${affirmationStreak} day streak` : ""}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-ink">Check in</p>
              <div className="mt-2">
                <AffirmationCheckin date={date} checked={affirmationCheckins} />
              </div>
            </div>
          ) : (
            <div className="mb-4 flex flex-1 flex-col justify-center rounded-xl border-2 border-dashed border-ink/20 bg-yellow/20 p-4">
              <p className="font-display text-lg font-bold">Choose a thought to grow</p>
              <p className="mt-1 text-sm font-semibold leading-relaxed text-muted">Create an affirmation that feels believable and alive.</p>
            </div>
          )}
          <Link href="/affirmations" className="home-text-link mt-auto text-sm font-bold">
            {activeAffirmationCount > 0 ? "Open affirmation practice" : "Create an affirmation"} <span aria-hidden>&rarr;</span>
          </Link>
        </Card>
        ) : null}
      </div>
    </section>
  );
}

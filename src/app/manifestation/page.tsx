import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  affirmations,
  customEmotions,
  emotionalCheckins,
  emotionalTrackingSettings,
  hooponoponoRounds,
  journalEntries,
} from "@/db/schema";
import { Card } from "@/components/ui";
import { MoodSkyHero, type MoodEntry } from "@/components/MoodSkyHero";
import { AffirmationDeck } from "@/components/AffirmationDeck";
import { AffirmationCheckin } from "@/components/AffirmationCheckin";
import { BreathingOrb } from "@/components/BreathingOrb";
import { GratitudeJar } from "@/components/GratitudeJar";
import { EmotionalHourTracker } from "@/components/EmotionalHourTracker";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { customEmotionKey, EMOTIONS } from "@/lib/emotions";
import { shiftDateISO, todayISO } from "@/lib/dates";
import { formatDateLong } from "@/lib/format";

export const dynamic = "force-dynamic";

function SectionHeading({ eyebrow, title, color, children }: { eyebrow: string; title: string; color: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className={`text-[11px] font-bold uppercase tracking-[0.18em] ${color}`}>{eyebrow}</p>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">
          <span className="home-marker">{title}</span>
        </h2>
      </div>
      {children}
    </div>
  );
}

export default async function ManifestationPage() {
  const today = todayISO();
  const [journal, checkins, activeAffirmations, emotions, trackingSettings, customEmotionRows, manifestedCount, rounds] = await Promise.all([
    db.query.journalEntries.findFirst({ where: eq(journalEntries.date, today) }),
    db.select().from(affirmationCheckins),
    db
      .select({ id: affirmations.id, text: affirmations.text, category: affirmations.category })
      .from(affirmations)
      .where(eq(affirmations.active, true))
      .orderBy(affirmations.sortOrder, affirmations.id),
    db
      .select({ hour: emotionalCheckins.hour, emotion: emotionalCheckins.emotion })
      .from(emotionalCheckins)
      .where(eq(emotionalCheckins.date, today))
      .orderBy(emotionalCheckins.hour),
    db.query.emotionalTrackingSettings.findFirst({
      where: eq(emotionalTrackingSettings.profileKey, "default"),
    }),
    db
      .select({
        id: customEmotions.id,
        name: customEmotions.name,
        emoji: customEmotions.emoji,
        category: customEmotions.category,
      })
      .from(customEmotions)
      .where(eq(customEmotions.active, true))
      .orderBy(customEmotions.sortOrder, customEmotions.id),
    db.$count(affirmationManifestations),
    db
      .select({ date: hooponoponoRounds.date, repetitions: hooponoponoRounds.repetitions })
      .from(hooponoponoRounds)
      .orderBy(desc(hooponoponoRounds.completedAt)),
  ]);
  const affirmationStats = computeAffirmationStats(checkins, today);
  const affirmationsDone = Object.values(affirmationStats.checkedToday).filter(Boolean).length;

  const emotionLookup = new Map<string, Omit<MoodEntry, "hour">>([
    ...EMOTIONS.map((e) => [e.key, { emoji: e.emoji, label: e.label, category: e.category }] as const),
    ...customEmotionRows.map((e) => [customEmotionKey(e.id), { emoji: e.emoji, label: e.name, category: e.category }] as const),
  ]);
  const moodEntries: MoodEntry[] = emotions.flatMap((entry) => {
    const option = emotionLookup.get(entry.emotion);
    return option ? [{ hour: entry.hour, ...option }] : [];
  });
  const roundDates = new Set(rounds.map((round) => round.date));
  let hooStreak = 0;
  for (let day = roundDates.has(today) ? today : shiftDateISO(today, -1); roundDates.has(day); day = shiftDateISO(day, -1)) {
    hooStreak++;
  }
  const todaysRounds = rounds.filter((round) => round.date === today);
  const roundsToday = todaysRounds.length;
  const repsToday = todaysRounds.reduce((sum, round) => sum + round.repetitions, 0);

  const gratitudeItems = (journal?.gratitude ?? "").split("\n").map((line) => line.trim()).filter(Boolean);

  return (
    <div className="mx-auto max-w-[1500px]">
      <MoodSkyHero
        dateLabel={formatDateLong(today)}
        entries={moodEntries}
        affirmationsDone={affirmationsDone}
        affirmationStreak={affirmationStats.currentStreak}
        manifestedCount={manifestedCount}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Affirmation deck">
          <SectionHeading eyebrow="Reinforce" title="Affirmation deck" color="text-pink">
            <Link href="/affirmations" className="home-text-link text-sm font-bold">
              Manage <span aria-hidden>&rarr;</span>
            </Link>
          </SectionHeading>
          <Card className="h-[calc(100%-4.5rem)] border-t-[8px] border-t-pink">
            <AffirmationDeck date={today} affirmations={activeAffirmations} checked={affirmationStats.checkedToday} />
          </Card>
        </section>
        <section aria-label="Breathing exercise">
          <SectionHeading eyebrow="Reset" title="Breathe" color="text-blue" />
          <Card className="h-[calc(100%-4.5rem)] border-t-[8px] border-t-blue">
            <BreathingOrb />
          </Card>
        </section>
      </div>

      <section aria-label="Emotional weather" className="mt-8">
        <SectionHeading eyebrow="Every hour" title="Emotional weather" color="text-orange">
          <p className="text-sm font-semibold text-muted">A quick check-in, not a judgment. Tap an hour and name the feeling.</p>
        </SectionHeading>
        <Card className="border-t-[8px] border-t-orange">
          <EmotionalHourTracker
            date={today}
            entries={emotions}
            defaultHour={new Date().getHours()}
            trackingWindow={{
              startHour: trackingSettings?.startHour ?? 7,
              endHour: trackingSettings?.endHour ?? 22,
            }}
            customEmotions={customEmotionRows}
          />
        </Card>
      </section>

      <Link href="/hooponopono" className="hoo-teaser group mt-8 flex flex-col items-start gap-4 rounded-[1.5rem] p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <span aria-hidden className="hoo-teaser-flower text-5xl">🌺</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-pink">Clean · release · love</p>
          <p className="font-display text-2xl font-bold">Hoʻoponopono</p>
          <p className="text-sm font-semibold text-ink/65">
            {roundsToday > 0
              ? `${roundsToday} ${roundsToday === 1 ? "session" : "sessions"} today · ${repsToday} said`
              : "I'm sorry · Please forgive me · Thank you · I love you"}
            {hooStreak > 0 ? ` · ${hooStreak}🔥` : ""}
          </p>
        </div>
        <span className="deck-say w-full sm:w-auto">Open practice →</span>
      </Link>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section aria-label="Gratitude jar">
          <SectionHeading eyebrow="Appreciate" title="Gratitude jar" color="text-yellow" />
          <Card className="h-[calc(100%-4.5rem)] border-t-[8px] border-t-yellow">
            <GratitudeJar date={today} items={gratitudeItems} />
          </Card>
        </section>
        <section aria-label="Reflect">
          <SectionHeading eyebrow="Reflect" title="Journal & check-ins" color="text-green" />
          <div className="flex h-[calc(100%-4.5rem)] flex-col gap-6">
            <Card className="home-lift flex flex-1 flex-col border-t-[8px] border-t-green">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-bold">Today&rsquo;s journal</p>
                <span aria-hidden className="home-emoji flex h-10 w-10 items-center justify-center rounded-full bg-green/10 text-lg">✎</span>
              </div>
              {journal?.content ? (
                <p className="line-clamp-4 flex-1 text-sm font-medium leading-relaxed text-ink/75">{journal.content}</p>
              ) : (
                <p className="flex-1 text-sm font-semibold leading-relaxed text-muted">
                  What keeps returning to your mind? Follow the feeling. Write without trying to make it tidy.
                </p>
              )}
              <Link
                href={`/journal/${today}`}
                className="brut-border brut-shadow-sm brut-press mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-green px-4 py-2 text-sm font-bold uppercase tracking-wide text-white"
              >
                {journal?.content ? "Continue journaling" : "Open today’s journal"}
              </Link>
            </Card>
            <Card className="border-t-[8px] border-t-pink">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-display text-xl font-bold">Affirmation check-ins</p>
                <span className="text-xs font-bold text-muted">{affirmationsDone}/3 today</span>
              </div>
              <AffirmationCheckin date={today} checked={affirmationStats.checkedToday} />
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

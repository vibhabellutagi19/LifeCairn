import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmations,
  customEmotions,
  emotionalCheckins,
  emotionalTrackingSettings,
  journalEntries,
} from "@/db/schema";
import { ManifestationSection } from "@/components/ManifestationSection";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function ManifestationPage() {
  const today = todayISO();
  const [journal, checkins, activeAffirmationCount, emotions, trackingSettings, customEmotionRows] = await Promise.all([
    db.query.journalEntries.findFirst({ where: eq(journalEntries.date, today) }),
    db.select().from(affirmationCheckins),
    db.$count(affirmations, eq(affirmations.active, true)),
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
  ]);
  const affirmationStats = computeAffirmationStats(checkins, today);

  return (
    <div className="mx-auto max-w-[1500px]">
      <ManifestationSection
        date={today}
        journalContent={journal?.content}
        activeAffirmationCount={activeAffirmationCount}
        affirmationCheckins={affirmationStats.checkedToday}
        affirmationStreak={affirmationStats.currentStreak}
        emotionalCheckins={emotions}
        trackingWindow={{
          startHour: trackingSettings?.startHour ?? 7,
          endHour: trackingSettings?.endHour ?? 22,
        }}
        customEmotions={customEmotionRows}
        defaultHour={new Date().getHours()}
        standalone
      />
    </div>
  );
}

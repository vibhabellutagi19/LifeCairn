import { clsx } from "clsx";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  affirmations,
} from "@/db/schema";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AffirmationCheckin } from "@/components/AffirmationCheckin";
import { AffirmationWorkspace } from "@/components/AffirmationWorkspace";
import { NewAffirmationModal } from "@/components/NewAffirmationModal";
import { ManifestationHistory } from "@/components/ManifestationHistory";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function AffirmationsPage() {
  const today = todayISO();

  const [all, checkins, celebrations] = await Promise.all([
    db
      .select()
      .from(affirmations)
      .orderBy(affirmations.category, affirmations.subcategory, affirmations.sortOrder, affirmations.id),
    db.select().from(affirmationCheckins),
    db
      .select()
      .from(affirmationManifestations)
      .orderBy(desc(affirmationManifestations.manifestedOn), desc(affirmationManifestations.id)),
  ]);

  const stats = computeAffirmationStats(checkins, today);
  const manifestedIds = new Set(
    celebrations
      .map((celebration) => celebration.affirmationId)
      .filter((id): id is number => id !== null)
  );

  return (
    <div>
      <PageHeader
        title="Affirmations"
        subtitle="Read slowly, speak clearly, and repeat what you want to reinforce."
        action={<NewAffirmationModal />}
      />

      <div className="mb-6">
        <Card className="bg-yellow/40">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold">Daily practice</h2>
              <p className="text-sm font-medium text-ink/80">
                Say your active affirmations out loud, then check in each session.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge color="orange">🔥 {stats.currentStreak}</Badge>
              <Badge color="green">⭐ {stats.score}</Badge>
            </div>
          </div>
          <AffirmationCheckin date={today} checked={stats.checkedToday} />
          <div className="mt-4 flex items-center gap-1">
            {stats.last7.map((d) => (
              <span
                key={d.date}
                title={d.date}
                className={clsx(
                  "h-2.5 w-2.5 rounded-full border border-ink/40",
                  d.done ? "bg-orange" : "bg-transparent"
                )}
              />
            ))}
            <span className="ml-2 text-xs font-semibold text-muted">last 7 days</span>
          </div>
        </Card>
      </div>

      <AffirmationWorkspace
        today={today}
        affirmations={all.map((affirmation) => ({
          id: affirmation.id,
          text: affirmation.text,
          category: affirmation.category,
          subcategory: affirmation.subcategory,
          active: affirmation.active,
          manifested: manifestedIds.has(affirmation.id),
        }))}
      />

      <ManifestationHistory celebrations={celebrations} />
    </div>
  );
}

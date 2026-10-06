import { clsx } from "clsx";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  affirmations,
} from "@/db/schema";
import { AffirmationCheckin } from "@/components/AffirmationCheckin";
import { AffirmationWorkspace } from "@/components/AffirmationWorkspace";
import { NewAffirmationModal } from "@/components/NewAffirmationModal";
import { ManifestationHistory } from "@/components/ManifestationHistory";
import { computeAffirmationStats } from "@/lib/affirmationStats";
import { categoryEmoji } from "@/lib/affirmationSubcategories";
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

  const slotsDone = Object.values(stats.checkedToday).filter(Boolean).length;
  const activeByCategory = new Map<string, number>();
  for (const affirmation of all) {
    if (!affirmation.active || manifestedIds.has(affirmation.id)) continue;
    activeByCategory.set(affirmation.category, (activeByCategory.get(affirmation.category) ?? 0) + 1);
  }
  const categoryMix = [...activeByCategory.entries()].sort((a, b) => b[1] - a[1]);
  const mixMax = Math.max(1, ...categoryMix.map(([, count]) => count));
  const activeTotal = categoryMix.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="mx-auto max-w-[1500px]">
      <section className="aff-hero relative mb-8 overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8 lg:p-10">
        <span aria-hidden className="aff-hero-ring aff-hero-ring-1" />
        <span aria-hidden className="aff-hero-ring aff-hero-ring-2" />
        <span aria-hidden className="mood-star mood-star-1">✦</span>
        <span aria-hidden className="mood-star mood-star-3">✧</span>

        <div className="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border-2 border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
              <span aria-hidden className="mood-twinkle">✦</span> {activeTotal} thoughts in your practice
            </p>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
              Affirmations
              <span className="mood-gradient-text block">say it like it&rsquo;s true.</span>
            </h1>
            <p className="mt-4 max-w-lg text-sm font-semibold text-white/65 sm:text-base">
              Read slowly, speak clearly, and repeat what you want to reinforce. Three check-ins a day keeps the streak alive.
            </p>
            <div className="mt-6">
              <NewAffirmationModal />
            </div>
          </div>

          <div className="rounded-[1.5rem] border-2 border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-yellow">Daily practice</p>
                <p className="font-display text-2xl font-bold">
                  {slotsDone === 3 ? "All three done 🎉" : `${slotsDone}/3 check-ins`}
                </p>
              </div>
              <div className="flex gap-2 text-center">
                <div className="aff-stat">
                  <p className="font-display text-2xl font-bold">{stats.currentStreak}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">🔥 streak</p>
                </div>
                <div className="aff-stat">
                  <p className="font-display text-2xl font-bold">{stats.score}</p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/60">⭐ days</p>
                </div>
              </div>
            </div>
            <div className="text-ink">
              <AffirmationCheckin date={today} checked={stats.checkedToday} />
            </div>
            <div className="mt-4 flex items-end justify-between gap-1">
              {stats.last7.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1" title={d.date}>
                  <span className={clsx("aff-day-dot", d.done && "is-done", d.date === today && "is-today")} />
                  <span className="text-[10px] font-bold uppercase text-white/50">
                    {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "narrow" })}
                  </span>
                </div>
              ))}
            </div>
            {categoryMix.length > 0 ? (
              <div className="mt-5 space-y-1.5 border-t-2 border-white/10 pt-4">
                {categoryMix.map(([name, count], i) => (
                  <div key={name} className="flex items-center gap-2 text-xs font-bold">
                    <span aria-hidden className="w-5 text-center">{categoryEmoji(name)}</span>
                    <span className="w-24 truncate text-white/75">{name}</span>
                    <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span
                        className="progress-fill block h-full rounded-full bg-yellow"
                        style={{ width: `${(count / mixMax) * 100}%`, animationDelay: `${300 + i * 90}ms` }}
                      />
                    </span>
                    <span className="w-6 text-right text-white/60">{count}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

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

import type { EmotionCategory } from "@/lib/emotions";
import { formatHour } from "@/lib/emotions";

export type MoodEntry = { hour: number; emoji: string; label: string; category: EmotionCategory };

/** The page's hero: a morphing orb tinted by today's feelings, with each check-in orbiting it. */
export function MoodSkyHero({
  dateLabel,
  entries,
  affirmationsDone,
  affirmationStreak,
  manifestedCount,
}: {
  dateLabel: string;
  entries: MoodEntry[];
  affirmationsDone: number;
  affirmationStreak: number;
  manifestedCount: number;
}) {
  const counts = { positive: 0, negative: 0, missing: 0 };
  for (const entry of entries) counts[entry.category]++;
  const total = entries.length;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const pos = pct(counts.positive);
  const neg = pct(counts.negative);

  const tally = new Map<string, { emoji: string; label: string; count: number }>();
  for (const entry of entries) {
    const current = tally.get(entry.label);
    tally.set(entry.label, { emoji: entry.emoji, label: entry.label, count: (current?.count ?? 0) + 1 });
  }
  const dominant = [...tally.values()].sort((a, b) => b.count - a.count)[0];
  const latest = entries[entries.length - 1];
  const orbiters = entries.slice(-10);

  const weather =
    total === 0
      ? { icon: "🌤️", text: "Clear skies, nothing logged yet" }
      : pos >= 70
        ? { icon: "☀️", text: "Sunny inside" }
        : neg >= 60
          ? { icon: "🌧️", text: "A rainy one. Be gentle with yourself" }
          : { icon: "⛅", text: "Mixed skies, and that's human" };

  return (
    <section className="mood-hero relative overflow-hidden rounded-[2rem] bg-ink p-5 text-white sm:p-8 lg:p-10">
      <div aria-hidden className="mood-star mood-star-1">✦</div>
      <div aria-hidden className="mood-star mood-star-2">✧</div>
      <div aria-hidden className="mood-star mood-star-3">✦</div>
      <div aria-hidden className="mood-star mood-star-4">·</div>

      <div className="relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border-2 border-white/25 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em]">
            <span aria-hidden className="mood-twinkle">✦</span> Mind · feeling · intention
          </p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[0.95] tracking-[-0.04em] sm:text-6xl">
            Manifestation
            <span className="mood-gradient-text block">starts with noticing.</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm font-semibold text-white/65 sm:text-base">
            {dateLabel}. Name what you feel, reinforce what you choose, and be grateful out loud.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            <span className="mood-chip">
              <span aria-hidden>{weather.icon}</span> {weather.text}
            </span>
            <span className="mood-chip">
              <span aria-hidden>✨</span> {affirmationsDone}/3 affirmations
              {affirmationStreak > 0 ? ` · ${affirmationStreak}🔥` : ""}
            </span>
            <span className="mood-chip">
              <span aria-hidden>🌟</span> {manifestedCount} manifested
            </span>
          </div>
        </div>

        <div className="mood-orb-wrap relative mx-auto aspect-square w-full max-w-[22rem]">
          <div
            className="mood-orb absolute inset-[16%]"
            style={
              {
                "--pos": `${total ? pos : 34}%`,
                "--neg": `${total ? pos + neg : 67}%`,
              } as React.CSSProperties
            }
          />
          <div className="absolute inset-[16%] flex flex-col items-center justify-center p-6 text-center">
            <span aria-hidden className="mood-orb-emoji text-5xl">{dominant?.emoji ?? "🌤️"}</span>
            <p className="mt-2 font-display text-lg font-bold leading-tight">
              {dominant ? `Mostly ${dominant.label.toLowerCase()}` : "How's your sky?"}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/75">
              {latest ? `Last: ${latest.emoji} at ${formatHour(latest.hour)}` : "Check in below"}
            </p>
          </div>

          <div aria-hidden className="mood-orbit absolute inset-0">
            {orbiters.map((entry, i) => {
              const angle = (360 / Math.max(orbiters.length, 1)) * i;
              return (
                <span key={`${entry.hour}-${entry.label}`} className="mood-orbiter" style={{ transform: `rotate(${angle}deg) translateY(-44cqw)` }}>
                  <span className="inline-block" style={{ transform: `rotate(${-angle}deg)` }}>
                    <span className="mood-counter">
                      <span className="mood-bob" style={{ animationDelay: `${i * -0.7}s` }}>
                        {entry.emoji}
                      </span>
                    </span>
                  </span>
                </span>
              );
            })}
          </div>

          {total > 0 ? (
            <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 gap-3 rounded-full border-2 border-white/20 bg-ink/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide">
              <span className="text-green">+{pos}%</span>
              <span className="text-orange">−{neg}%</span>
              {counts.missing ? <span className="text-pink">✦{pct(counts.missing)}%</span> : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

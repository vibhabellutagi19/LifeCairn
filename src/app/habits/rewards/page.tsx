import { RewardShop, type TrophyEntry } from "@/components/RewardShop";
import { loadHabits } from "@/lib/habitData";
import { periodLabel } from "@/lib/habitRewards";
import { currentMonthKey, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function HabitRewardsPage() {
  const today = todayISO();
  const { habits, claims } = await loadHabits(today);
  const active = habits.filter((h) => h.active && (!h.endDate || h.endDate >= today));

  const trophies: TrophyEntry[] = claims
    .toSorted((a, b) => b.claimedAt.getTime() - a.claimedAt.getTime())
    .flatMap((claim) => {
      const habit = habits.find((h) => h.rewards.some((r) => r.id === claim.rewardId));
      const reward = habit?.rewards.find((r) => r.id === claim.rewardId);
      if (!habit || !reward) return [];
      return [
        {
          id: claim.id,
          rewardId: reward.id,
          period: claim.period,
          title: reward.title,
          emoji: reward.emoji,
          habitTitle: habit.title,
          label: periodLabel(claim.period),
          claimedOn: claim.claimedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        },
      ];
    });

  return <RewardShop habits={active} monthKey={currentMonthKey()} today={today} trophies={trophies} />;
}

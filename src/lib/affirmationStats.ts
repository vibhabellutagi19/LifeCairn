import { computeHabitStats, type HabitStats } from "@/lib/habitStats";
import type { AffirmationSlot } from "@/lib/actions/affirmations";

const SLOTS_PER_DAY = 3;

export function computeAffirmationStats(
  checkins: { date: string; slot: AffirmationSlot }[],
  today: string
): HabitStats & { checkedToday: Record<AffirmationSlot, boolean> } {
  const slotsByDate = new Map<string, Set<AffirmationSlot>>();
  for (const c of checkins) {
    const set = slotsByDate.get(c.date) ?? new Set<AffirmationSlot>();
    set.add(c.slot);
    slotsByDate.set(c.date, set);
  }

  const fullyDoneDates = [...slotsByDate.entries()]
    .filter(([, slots]) => slots.size >= SLOTS_PER_DAY)
    .map(([date]) => date);

  const stats = computeHabitStats(fullyDoneDates, today);
  const todaySlots = slotsByDate.get(today) ?? new Set<AffirmationSlot>();

  return {
    ...stats,
    checkedToday: {
      morning: todaySlots.has("morning"),
      afternoon: todaySlots.has("afternoon"),
      evening: todaySlots.has("evening"),
    },
  };
}

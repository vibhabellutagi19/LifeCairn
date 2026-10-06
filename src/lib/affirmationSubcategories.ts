export const AFFIRMATION_CATEGORIES = [
  "General",
  "Career",
  "Money",
  "Health",
  "Relationship",
] as const;

export const AFFIRMATION_SUBCATEGORIES = ["Maintenance", "Goals", "Actions"] as const;

const CATEGORY_EMOJI: Record<string, string> = {
  General: "✨",
  Career: "💼",
  Money: "💰",
  Health: "🌿",
  Relationship: "💞",
};

export function categoryEmoji(category: string) {
  return CATEGORY_EMOJI[category] ?? "🌟";
}

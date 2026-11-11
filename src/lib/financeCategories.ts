export const EXPENSE_CATEGORIES = [
  "Housing",
  "Food",
  "Transport",
  "Health",
  "Shopping",
  "Travel",
  "Subscriptions",
  "Family",
  "Taxes",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return EXPENSE_CATEGORIES.includes(value as ExpenseCategory);
}

// Words that imply a category without being one. Matched against the
// expense description only to guess; they are never removed from it.
const CATEGORY_HINTS: Record<string, ExpenseCategory> = {
  groceries: "Food", grocery: "Food", lidl: "Food", aldi: "Food", coffee: "Food", lunch: "Food",
  dinner: "Food", breakfast: "Food", restaurant: "Food", cafe: "Food", bakery: "Food",
  uber: "Transport", taxi: "Transport", bus: "Transport", train: "Transport", metro: "Transport",
  fuel: "Transport", petrol: "Transport", parking: "Transport",
  rent: "Housing", electricity: "Housing", internet: "Housing",
  doctor: "Health", pharmacy: "Health", medicine: "Health", gym: "Health",
  netflix: "Subscriptions", spotify: "Subscriptions", subscription: "Subscriptions",
  flight: "Travel", hotel: "Travel", airbnb: "Travel",
  amazon: "Shopping", clothes: "Shopping",
  tax: "Taxes",
};

/** A category implied by a word in the text ("Lidl groceries" → Food), or null. */
export function guessCategory(text: string): ExpenseCategory | null {
  for (const word of text.toLowerCase().split(/[^a-z]+/)) {
    if (word && CATEGORY_HINTS[word]) return CATEGORY_HINTS[word];
  }
  return null;
}

// Comma-separated input -> unique, lowercase, trimmed tags.
export function parseTags(raw: string): string[] {
  const tags = raw
    .split(",")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 10);
}

// Category colours. Only five categories get a hue: that is as many as stay
// distinguishable from each other in every pairing, including for colour-blind
// readers (checked with the dataviz palette validator). The rest share one
// neutral and are grouped as "Other" in charts; their tiles still name them.
const HUES: Partial<Record<ExpenseCategory, string>> = {
  Housing: "#2a78d6",
  Food: "#eda100",
  Transport: "#1baf7a",
  Travel: "#e87ba4",
  Shopping: "#008300",
};
export const OTHER_CATEGORY_COLOR = "#6f685d";

export function categoryColor(category: string) {
  return (isExpenseCategory(category) && HUES[category]) || OTHER_CATEGORY_COLOR;
}

/** True when the category has its own colour (and its own slice in charts). */
export function hasOwnColor(category: string) {
  return isExpenseCategory(category) && HUES[category] !== undefined;
}

/** A merchant you've logged before, with the category you used most recently. */
export type Merchant = { source: string; category: string };

/** The merchant typed so far, matched case-insensitively. */
export function matchMerchant(merchants: Merchant[], source: string) {
  const key = source.trim().toLowerCase();
  if (!key) return null;
  return merchants.find((m) => m.source.toLowerCase() === key) ?? null;
}

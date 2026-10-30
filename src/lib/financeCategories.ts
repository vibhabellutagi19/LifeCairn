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

// Comma-separated input -> unique, lowercase, trimmed tags.
export function parseTags(raw: string): string[] {
  const tags = raw
    .split(",")
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, 10);
}

// CSS colors (theme vars) shared by the breakdown charts; used via inline styles.
const mix = (color: string, amount: number) => `color-mix(in srgb, ${color} ${amount}%, white)`;

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Housing: "var(--blue)",
  Food: "var(--orange)",
  Transport: "var(--yellow)",
  Health: "var(--green)",
  Shopping: "var(--pink)",
  Travel: mix("var(--blue)", 50),
  Subscriptions: "var(--ink)",
  Family: mix("var(--green)", 50),
  Taxes: "var(--muted)",
  Other: mix("var(--pink)", 45),
};

export function categoryColor(category: string) {
  return isExpenseCategory(category) ? CATEGORY_COLORS[category] : CATEGORY_COLORS.Other;
}

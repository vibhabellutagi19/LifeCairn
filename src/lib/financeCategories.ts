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

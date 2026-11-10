import { EXPENSE_CATEGORIES, parseTags, type ExpenseCategory } from "@/lib/financeCategories";

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

export type ParsedEntry = {
  amount: number;
  source: string;
  category: ExpenseCategory | null;
  /** True when the category came from a hint word rather than being typed. */
  guessed: boolean;
  tags: string[];
  /** 0 = today, -1 = yesterday. */
  dayOffset: number;
};

export type ParseResult = { ok: true; entry: ParsedEntry } | { ok: false; error: string };

function parseAmount(token: string): number | null {
  const cleaned = token.replace(/^[€₹$]|[€₹$]$/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 && n < 10_000_000 ? n : null;
}

function asCategory(word: string): ExpenseCategory | null {
  const lower = word.toLowerCase();
  return EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === lower) ?? null;
}

/**
 * "12.50 Lidl food #goa-trip yesterday" → amount 12.5, source "Lidl",
 * category Food, tags [goa-trip], dayOffset -1. The amount may come first or
 * last; an exact category name is taken out of the description.
 */
export function parseEntry(text: string, kind: "expense" | "income"): ParseResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const amountIndex = tokens.findIndex((t) => parseAmount(t) !== null);
  if (amountIndex === -1) {
    return { ok: false, error: "I couldn't find an amount." };
  }
  const amount = parseAmount(tokens[amountIndex])!;
  let words = tokens.filter((_, i) => i !== amountIndex);

  const tags = kind === "expense" ? parseTags(words.filter((w) => w.startsWith("#")).map((w) => w.slice(1)).join(",")) : [];
  words = words.filter((w) => !w.startsWith("#"));

  let dayOffset = 0;
  words = words.filter((w) => {
    const lower = w.toLowerCase();
    if (lower === "yesterday" || lower === "yday") {
      dayOffset = -1;
      return false;
    }
    if (lower === "today") return false;
    return true;
  });

  let category: ExpenseCategory | null = null;
  let guessed = false;
  if (kind === "expense") {
    // An explicit category name (last one wins) is removed from the description,
    // unless it is the only word, in which case it is both.
    for (let i = words.length - 1; i >= 0; i--) {
      const match = asCategory(words[i]);
      if (match) {
        category = match;
        if (words.length > 1) words = words.filter((_, j) => j !== i);
        break;
      }
    }
    if (!category) {
      const hint = words.map((w) => CATEGORY_HINTS[w.toLowerCase()]).find(Boolean);
      if (hint) {
        category = hint;
        guessed = true;
      }
    }
  }

  const source = words.join(" ").slice(0, 200);
  if (!source) {
    return { ok: false, error: kind === "expense" ? "What was it for?" : "Where did it come from?" };
  }
  return { ok: true, entry: { amount, source, category, guessed, tags, dayOffset } };
}

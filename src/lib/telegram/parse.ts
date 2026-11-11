import { EXPENSE_CATEGORIES, guessCategory, parseTags, type ExpenseCategory } from "@/lib/financeCategories";
import { todayISO } from "@/lib/dates";

export type ParsedEntry = {
  amount: number;
  source: string;
  category: ExpenseCategory | null;
  /** True when the category came from a hint word rather than being typed. */
  guessed: boolean;
  tags: string[];
  /** yyyy-MM-dd. Today unless the message names a date. */
  date: string;
};

export type ParseResult = { ok: true; entry: ParsedEntry } | { ok: false; error: string };

/* ------------------------------------------------------------------ */
/* Dates. All arithmetic is on UTC midnights of yyyy-MM-dd strings.    */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;

function toUTC(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** yyyy-MM-dd for a real calendar date, else null (rejects 31/02 etc.). */
function isoIfValid(y: number, m: number, d: number) {
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const iso = fromUTC(Date.UTC(y, m - 1, d));
  return iso === `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` ? iso : null;
}

// "sun" alone is left out on purpose: it is too often part of a description.
const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

/**
 * A date word, or null if the token isn't one:
 * today · yesterday/yday · 3d (days ago) · mon…sunday (most recent, today
 * included) · 3/11 (day/month; last year if that date is still ahead) ·
 * 3/11/2026 or 3/11/26 · 2026-11-03.
 */
export function parseDateToken(token: string, today: string): string | null {
  const t = token.toLowerCase();
  const now = toUTC(today);
  if (t === "today") return today;
  if (t === "yesterday" || t === "yday") return fromUTC(now - DAY_MS);

  const daysAgo = t.match(/^(\d{1,3})d$/);
  if (daysAgo) {
    const n = Number(daysAgo[1]);
    return n <= 366 ? fromUTC(now - n * DAY_MS) : null;
  }

  if (t in WEEKDAYS) {
    const back = (new Date(now).getUTCDay() - WEEKDAYS[t] + 7) % 7;
    return fromUTC(now - back * DAY_MS);
  }

  const iso = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) return isoIfValid(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    if (dmy[3]) {
      const y = Number(dmy[3]);
      return isoIfValid(y < 100 ? 2000 + y : y, m, d);
    }
    const thisYear = Number(today.slice(0, 4));
    const candidate = isoIfValid(thisYear, m, d);
    if (!candidate) return null;
    // No year given and the date is still ahead: it means last year.
    return candidate > today ? isoIfValid(thisYear - 1, m, d) : candidate;
  }
  return null;
}

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
 * category Food, tags [goa-trip], date yesterday. The amount may come first or
 * last; an exact category name is taken out of the description.
 */
export function parseEntry(text: string, kind: "expense" | "income", today: string = todayISO()): ParseResult {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  const amountIndex = tokens.findIndex((t) => parseAmount(t) !== null);
  if (amountIndex === -1) {
    return { ok: false, error: "I couldn't find an amount." };
  }
  const amount = parseAmount(tokens[amountIndex])!;
  let words = tokens.filter((_, i) => i !== amountIndex);

  const tags = kind === "expense" ? parseTags(words.filter((w) => w.startsWith("#")).map((w) => w.slice(1)).join(",")) : [];
  words = words.filter((w) => !w.startsWith("#"));

  // A date word anywhere in the message (the last one wins) is taken out of the description.
  let date = today;
  words = words.filter((w) => {
    const parsed = parseDateToken(w, today);
    if (parsed === null) return true;
    date = parsed;
    return false;
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
      const hint = guessCategory(words.join(" "));
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
  return { ok: true, entry: { amount, source, category, guessed, tags, date } };
}

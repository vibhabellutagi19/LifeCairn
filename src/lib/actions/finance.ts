"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeBudgets,
  financeEntries,
  financeRecurring,
  financeSnapshotItems,
  financeSnapshots,
  financeTargets,
  userSettings,
} from "@/db/schema";
import { EXPENSE_CATEGORIES, isExpenseCategory, parseTags } from "@/lib/financeCategories";
import { requireUserId } from "@/lib/auth";
import { isCurrency } from "@/lib/format";
import { monthRangeISO } from "@/lib/dates";
import { isDepositType, isInterestPayout } from "@/lib/deposits";
import type { HistoryImportPayload } from "@/lib/snapshotImport";

function revalidateAll() {
  revalidatePath("/finance");
  revalidatePath("/finance/wealth");
  revalidatePath("/finance/reports");
  revalidatePath("/");
  revalidatePath("/review");
}

const SAVING_TYPES = ["fd", "rd", "mutual_fund", "cash", "bank", "stocks", "other"] as const;

function isSavingType(value: string): value is (typeof SAVING_TYPES)[number] {
  return SAVING_TYPES.includes(value as (typeof SAVING_TYPES)[number]);
}

const NO_TERMS = {
  depositAmount: null,
  interestRate: null,
  depositStart: null,
  depositMaturity: null,
  interestPayout: null,
};

/**
 * Deposit terms from a form: all blank clears them, otherwise every field must
 * be valid. Non-deposit types never keep terms. Returns null when invalid.
 */
function depositTermsFromForm(formData: FormData, type: string) {
  if (!isDepositType(type)) return NO_TERMS;
  const field = (name: string) => String(formData.get(name) || "").replaceAll(",", "").trim();
  const amountRaw = field("depositAmount");
  const rateRaw = field("interestRate");
  const start = field("depositStart");
  const maturity = field("depositMaturity");
  if (!amountRaw && !rateRaw && !start && !maturity) return NO_TERMS;

  const amount = Number(amountRaw);
  const rate = Number(rateRaw);
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(rate) || rate <= 0 || rate > 30) return null;
  if (!isDate(start) || !isDate(maturity) || maturity <= start) return null;
  const payoutRaw = field("interestPayout") || "maturity";
  const payout = type === "rd" ? "maturity" : payoutRaw;
  if (!isInterestPayout(payout)) return null;
  return {
    depositAmount: amount.toFixed(2),
    interestRate: rate.toFixed(2),
    depositStart: start,
    depositMaturity: maturity,
    interestPayout: payout,
  };
}

export async function createSaving(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const typeRaw = String(formData.get("type") || "other");
  if (!isSavingType(typeRaw)) return;
  const balanceRaw = String(formData.get("balance") || "").replaceAll(",", "").trim();
  const balance = Number(balanceRaw);
  if (!balanceRaw || !Number.isFinite(balance) || balance < 0) return;
  const currency = String(formData.get("currency") || "INR");
  if (!isCurrency(currency)) return;
  const terms = depositTermsFromForm(formData, typeRaw);
  if (!terms) {
    return {
      ok: false as const,
      error: "Deposit terms: fill in every field (rate up to 30%, maturity after start), or leave them all blank.",
    };
  }

  await db.insert(financeAccounts).values({
    userId,
    name,
    type: typeRaw,
    balance: balance.toFixed(2),
    currency,
    ...terms,
  });
  revalidateAll();
}

export async function updateSaving(id: number, formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const typeRaw = String(formData.get("type") || "other");
  if (!isSavingType(typeRaw)) return;
  const balance = Number(String(formData.get("balance") || "").replaceAll(",", "").trim());
  if (!Number.isFinite(balance) || balance < 0) return;
  const currency = String(formData.get("currency") || "INR");
  if (!isCurrency(currency)) return;
  await db
    .update(financeAccounts)
    .set({
      name,
      type: typeRaw,
      balance: balance.toFixed(2),
      currency,
      // Terms only make sense on a deposit; moving away from FD/RD drops them.
      ...(isDepositType(typeRaw) ? {} : NO_TERMS),
      updatedAt: new Date(),
    })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)));
  revalidateAll();
}

/** Save (or clear, when all blank) the rate, dates and payout of an FD/RD. */
export async function updateDepositTerms(id: number, formData: FormData) {
  const userId = await requireUserId();
  const account = await db.query.financeAccounts.findFirst({
    where: and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)),
  });
  if (!account || !isDepositType(account.type)) return { ok: false as const, error: "Not a deposit." };
  // The form can also switch the deposit between FD and RD.
  const kindRaw = String(formData.get("depositKind") || account.type);
  const kind = isDepositType(kindRaw) ? kindRaw : account.type;
  const terms = depositTermsFromForm(formData, kind);
  if (!terms) {
    return {
      ok: false as const,
      error: "Fill in every field: an amount, a rate up to 30%, and a maturity date after the start.",
    };
  }
  await db
    .update(financeAccounts)
    .set({ ...terms, type: kind, updatedAt: new Date() })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)));
  revalidateAll();
  return { ok: true as const };
}

export async function deleteSaving(id: number) {
  const userId = await requireUserId();
  await db
    .delete(financeAccounts)
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)));
  revalidateAll();
}

function amountFromForm(formData: FormData, field: string) {
  const raw = String(formData.get(field) || "").replaceAll(",", "").trim();
  const amount = Number(raw);
  if (!raw || !Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid amount for ${field}`);
  }
  return amount.toFixed(2);
}

export async function saveMonthlyFinanceSnapshot(month: string, formData: FormData) {
  const userId = await requireUserId();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return;

  const snapshotDate = String(formData.get("snapshotDate") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate) || !snapshotDate.startsWith(month)) return;

  const accounts = await db
    .select()
    .from(financeAccounts)
    .where(eq(financeAccounts.userId, userId))
    .orderBy(financeAccounts.id);
  if (accounts.length === 0) return;

  const values = accounts.map((account, index) => ({
    userId,
    accountId: account.id,
    accountName: account.name,
    accountType: account.type,
    investedAmount: amountFromForm(formData, `invested-${account.id}`),
    currentValue: amountFromForm(formData, `current-${account.id}`),
    currency: account.currency,
    sortOrder: index,
  }));

  await db.transaction(async (tx) => {
    const existing = await tx.query.financeSnapshots.findFirst({
      where: and(eq(financeSnapshots.userId, userId), eq(financeSnapshots.month, month)),
    });

    let snapshotId: number;
    if (existing) {
      snapshotId = existing.id;
      await tx
        .update(financeSnapshots)
        .set({ snapshotDate, updatedAt: new Date() })
        .where(and(eq(financeSnapshots.id, existing.id), eq(financeSnapshots.userId, userId)));
      await tx
        .delete(financeSnapshotItems)
        .where(
          and(
            eq(financeSnapshotItems.snapshotId, existing.id),
            eq(financeSnapshotItems.userId, userId)
          )
        );
    } else {
      const [snapshot] = await tx
        .insert(financeSnapshots)
        .values({ userId, month, snapshotDate })
        .returning({ id: financeSnapshots.id });
      snapshotId = snapshot.id;
    }

    await tx.insert(financeSnapshotItems).values(
      values.map((value) => ({ ...value, snapshotId }))
    );

    const [latest] = await tx
      .select({ month: financeSnapshots.month })
      .from(financeSnapshots)
      .where(eq(financeSnapshots.userId, userId))
      .orderBy(desc(financeSnapshots.month))
      .limit(1);

    if (latest?.month === month) {
      for (const value of values) {
        await tx
          .update(financeAccounts)
          .set({ balance: value.currentValue, updatedAt: new Date(`${snapshotDate}T00:00:00`) })
          .where(
            and(eq(financeAccounts.id, value.accountId), eq(financeAccounts.userId, userId))
          );
      }
    }
  });

  revalidateAll();
}

/**
 * Import past monthly snapshots (pasted from a spreadsheet). For each month,
 * the imported savings' values are replaced and any other savings already in
 * that month's snapshot are left as they are.
 */
export async function importSnapshotHistory(payload: HistoryImportPayload) {
  const userId = await requireUserId();
  const accounts = await db
    .select()
    .from(financeAccounts)
    .where(eq(financeAccounts.userId, userId))
    .orderBy(financeAccounts.id);
  const byId = new Map(accounts.map((account, index) => [account.id, { account, index }]));

  const months = Array.isArray(payload?.months) ? payload.months : [];
  if (months.length === 0 || months.length > 120) return { ok: false as const, error: "Nothing to import." };
  for (const m of months) {
    const items = Array.isArray(m.items) ? m.items : [];
    const validMonth = typeof m.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m.month);
    const validDate =
      typeof m.snapshotDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m.snapshotDate) && m.snapshotDate.startsWith(m.month);
    if (!validMonth || !validDate || items.length === 0) {
      return { ok: false as const, error: `Month ${String(m.month)} isn't valid.` };
    }
    const seen = new Set<number>();
    for (const item of items) {
      if (!byId.has(item.accountId) || seen.has(item.accountId)) {
        return { ok: false as const, error: `A saving in ${m.month} is unknown or listed twice.` };
      }
      seen.add(item.accountId);
      for (const n of [item.invested, item.current]) {
        if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n >= 1e12) {
          return { ok: false as const, error: `An amount in ${m.month} isn't valid.` };
        }
      }
    }
  }

  await db.transaction(async (tx) => {
    for (const m of months) {
      const existing = await tx.query.financeSnapshots.findFirst({
        where: and(eq(financeSnapshots.userId, userId), eq(financeSnapshots.month, m.month)),
      });
      let snapshotId: number;
      if (existing) {
        snapshotId = existing.id;
        await tx
          .update(financeSnapshots)
          .set({ snapshotDate: m.snapshotDate, updatedAt: new Date() })
          .where(and(eq(financeSnapshots.id, existing.id), eq(financeSnapshots.userId, userId)));
        await tx.delete(financeSnapshotItems).where(
          and(
            eq(financeSnapshotItems.snapshotId, existing.id),
            eq(financeSnapshotItems.userId, userId),
            inArray(
              financeSnapshotItems.accountId,
              m.items.map((item) => item.accountId)
            )
          )
        );
      } else {
        const [created] = await tx
          .insert(financeSnapshots)
          .values({ userId, month: m.month, snapshotDate: m.snapshotDate })
          .returning({ id: financeSnapshots.id });
        snapshotId = created.id;
      }
      await tx.insert(financeSnapshotItems).values(
        m.items.map((item) => {
          const { account, index } = byId.get(item.accountId)!;
          return {
            userId,
            snapshotId,
            accountId: account.id,
            accountName: account.name,
            accountType: account.type,
            investedAmount: item.invested.toFixed(2),
            currentValue: item.current.toFixed(2),
            currency: account.currency,
            sortOrder: index,
          };
        })
      );
    }

    // As with a saved snapshot: if an imported month is now the latest one,
    // the savings' current balances follow it.
    const [latest] = await tx
      .select({ month: financeSnapshots.month })
      .from(financeSnapshots)
      .where(eq(financeSnapshots.userId, userId))
      .orderBy(desc(financeSnapshots.month))
      .limit(1);
    const latestImported = months.find((m) => m.month === latest?.month);
    if (latestImported) {
      for (const item of latestImported.items) {
        await tx
          .update(financeAccounts)
          .set({ balance: item.current.toFixed(2), updatedAt: new Date(`${latestImported.snapshotDate}T00:00:00`) })
          .where(and(eq(financeAccounts.id, item.accountId), eq(financeAccounts.userId, userId)));
      }
    }
  });

  revalidateAll();
  return { ok: true as const, months: months.length };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Amount typed in a form: "1,234.50" or "12,5" (decimal comma) → number, or null. */
function parseAmount(raw: unknown) {
  let text = String(raw ?? "").trim().replace(/[€₹\s]/g, "");
  // A single comma followed by 1–2 digits is a decimal comma (12,5 → 12.5); otherwise commas group thousands.
  text = /^\d+,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replaceAll(",", "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const n = Number(text);
  return n > 0 && n < 1e10 ? n : null;
}

const isISODate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function createFinanceEntry(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const source = String(formData.get("source") || "").trim().slice(0, 200);
  if (!source) return { ok: false, error: "Say what it was." };
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, error: "That amount doesn't look right. Use a number like 12.50." };
  const typeRaw = String(formData.get("type") || "income");
  if (typeRaw !== "income" && typeRaw !== "expense") return { ok: false, error: "Unknown entry type." };
  const type: "income" | "expense" = typeRaw;
  const date = String(formData.get("date") || "");
  if (!isISODate(date)) return { ok: false, error: "Pick a date." };
  const categoryRaw = String(formData.get("category") || "Other");
  const category = type === "expense" && isExpenseCategory(categoryRaw) ? categoryRaw : "Other";
  const notes = String(formData.get("notes") || "").trim();
  const tags = type === "expense" ? parseTags(String(formData.get("tags") || "")) : [];

  await db.insert(financeEntries).values({
    userId,
    source,
    amount: amount.toFixed(2),
    type,
    date,
    category,
    notes: notes || null,
    tags,
  });
  revalidateAll();
  return { ok: true };
}

export type BulkExpenseRow = {
  date: string;
  source: string;
  amount: string;
  category: string;
  tags: string;
  notes: string;
};

// Inserts every valid row in one statement; returns how many were saved.
export async function createFinanceEntries(rows: BulkExpenseRow[]) {
  const userId = await requireUserId();
  const values = rows.slice(0, 200).flatMap((row) => {
    const source = String(row.source || "").trim();
    const amount = Number(String(row.amount || "").replaceAll(",", "").trim());
    const date = String(row.date || "");
    if (!source || !Number.isFinite(amount) || amount <= 0) return [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const categoryRaw = String(row.category || "Other");
    const notes = String(row.notes || "").trim();
    return [
      {
        userId,
        source: source.slice(0, 200),
        amount: amount.toFixed(2),
        type: "expense" as const,
        date,
        category: isExpenseCategory(categoryRaw) ? categoryRaw : "Other",
        notes: notes || null,
        tags: parseTags(String(row.tags || "")),
      },
    ];
  });
  if (values.length === 0) return 0;
  await db.insert(financeEntries).values(values);
  revalidateAll();
  return values.length;
}

export async function updateFinanceEntry(id: number, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const source = String(formData.get("source") || "").trim().slice(0, 200);
  if (!source) return { ok: false, error: "Say what it was." };
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, error: "That amount doesn't look right. Use a number like 12.50." };
  const date = String(formData.get("date") || "");
  if (!isISODate(date)) return { ok: false, error: "Pick a date." };
  const notes = String(formData.get("notes") || "").trim();

  const existing = await db.query.financeEntries.findFirst({
    where: and(eq(financeEntries.id, id), eq(financeEntries.userId, userId)),
  });
  if (!existing) return { ok: false, error: "That entry no longer exists." };
  const categoryRaw = String(formData.get("category") || "Other");
  const category =
    existing.type === "expense" && isExpenseCategory(categoryRaw) ? categoryRaw : "Other";

  await db
    .update(financeEntries)
    .set({
      source,
      amount: amount.toFixed(2),
      date,
      category,
      notes: notes || null,
      tags: existing.type === "expense" ? parseTags(String(formData.get("tags") || "")) : [],
    })
    .where(and(eq(financeEntries.id, id), eq(financeEntries.userId, userId)));
  revalidateAll();
  return { ok: true };
}

export async function deleteFinanceEntry(id: number) {
  const userId = await requireUserId();
  await db
    .delete(financeEntries)
    .where(and(eq(financeEntries.id, id), eq(financeEntries.userId, userId)));
  revalidateAll();
}

/** Income target for a month; a blank amount removes it. */
export async function setMonthlyTarget(month: string, formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false, error: "Unknown month." };
  const raw = String(formData.get("targetAmount") || "").trim();
  if (!raw) {
    await db
      .delete(financeTargets)
      .where(and(eq(financeTargets.userId, userId), eq(financeTargets.month, month)));
    revalidateAll();
    return { ok: true };
  }
  const amount = parseAmount(raw);
  if (amount === null) return { ok: false, error: "Use a number like 4000." };
  await db
    .insert(financeTargets)
    .values({ userId, month, targetAmount: amount.toFixed(2) })
    .onConflictDoUpdate({
      target: [financeTargets.userId, financeTargets.month],
      set: { targetAmount: amount.toFixed(2) },
    });
  revalidateAll();
  return { ok: true };
}

/** Monthly limits per category from `budget-<Category>` fields; blank removes one. */
export async function saveBudgets(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const set: { category: string; amount: string }[] = [];
  const cleared: string[] = [];
  for (const category of EXPENSE_CATEGORIES) {
    const raw = String(formData.get(`budget-${category}`) ?? "").trim();
    if (!raw) {
      cleared.push(category);
      continue;
    }
    const amount = parseAmount(raw);
    if (amount === null) return { ok: false, error: `The ${category} budget doesn't look like a number.` };
    set.push({ category, amount: amount.toFixed(2) });
  }
  await db.transaction(async (tx) => {
    if (cleared.length > 0) {
      await tx
        .delete(financeBudgets)
        .where(and(eq(financeBudgets.userId, userId), inArray(financeBudgets.category, cleared)));
    }
    for (const { category, amount } of set) {
      await tx
        .insert(financeBudgets)
        .values({ userId, category, amount })
        .onConflictDoUpdate({
          target: [financeBudgets.userId, financeBudgets.category],
          set: { amount, updatedAt: new Date() },
        });
    }
  });
  revalidateAll();
  return { ok: true };
}

/** A regular income or expense (rent, salary, Netflix) to add each month in one tap. */
export async function createRecurring(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const typeRaw = String(formData.get("type") || "expense");
  if (typeRaw !== "income" && typeRaw !== "expense") return { ok: false, error: "Unknown entry type." };
  const source = String(formData.get("source") || "").trim().slice(0, 200);
  if (!source) return { ok: false, error: "Give it a name, like Rent." };
  const amount = parseAmount(formData.get("amount"));
  if (amount === null) return { ok: false, error: "That amount doesn't look right." };
  const day = Number(formData.get("dayOfMonth") || 1);
  if (!Number.isInteger(day) || day < 1 || day > 28) return { ok: false, error: "Pick a day from 1 to 28." };
  const categoryRaw = String(formData.get("category") || "Other");
  await db.insert(financeRecurring).values({
    userId,
    type: typeRaw,
    source,
    amount: amount.toFixed(2),
    category: typeRaw === "expense" && isExpenseCategory(categoryRaw) ? categoryRaw : "Other",
    tags: typeRaw === "expense" ? parseTags(String(formData.get("tags") || "")) : [],
    dayOfMonth: day,
  });
  revalidateAll();
  return { ok: true };
}

export async function deleteRecurring(id: number) {
  const userId = await requireUserId();
  await db
    .delete(financeRecurring)
    .where(and(eq(financeRecurring.id, id), eq(financeRecurring.userId, userId)));
  revalidateAll();
}

/**
 * Add the given recurring items to a month, dated on their day of the month.
 * Items already added that month are skipped. Returns how many were added.
 */
export async function addRecurringForMonth(month: string, ids: number[]): Promise<number> {
  const userId = await requireUserId();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || ids.length === 0) return 0;
  const items = await db
    .select()
    .from(financeRecurring)
    .where(and(eq(financeRecurring.userId, userId), inArray(financeRecurring.id, ids.slice(0, 100))));
  if (items.length === 0) return 0;
  const already = await db
    .select({ recurringId: financeEntries.recurringId })
    .from(financeEntries)
    .where(
      and(
        eq(financeEntries.userId, userId),
        inArray(
          financeEntries.recurringId,
          items.map((item) => item.id)
        ),
        gte(financeEntries.date, monthRangeISO(month).start),
        lte(financeEntries.date, monthRangeISO(month).end)
      )
    );
  const done = new Set(already.map((row) => row.recurringId));
  const values = items
    .filter((item) => !done.has(item.id))
    .map((item) => ({
      userId,
      type: item.type,
      source: item.source,
      category: item.category,
      amount: item.amount,
      tags: item.tags,
      date: `${month}-${String(item.dayOfMonth).padStart(2, "0")}`,
      recurringId: item.id,
    }));
  if (values.length > 0) {
    await db.insert(financeEntries).values(values);
    revalidateAll();
  }
  return values.length;
}

/** ₹ per € for showing INR and EUR savings as one total; blank removes it. */
export async function setEurToInr(formData: FormData): Promise<ActionResult> {
  const userId = await requireUserId();
  const raw = String(formData.get("eurToInr") || "").trim();
  let rate: string | null = null;
  if (raw) {
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return { ok: false, error: "Use a rate like 104.5." };
    rate = n.toFixed(4);
  }
  await db
    .insert(userSettings)
    .values({ userId, eurToInr: rate })
    .onConflictDoUpdate({ target: userSettings.userId, set: { eurToInr: rate, updatedAt: new Date() } });
  revalidateAll();
  return { ok: true };
}

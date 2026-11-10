"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  financeAccounts,
  financeEntries,
  financeSnapshotItems,
  financeSnapshots,
  financeTargets,
} from "@/db/schema";
import { isExpenseCategory, parseTags } from "@/lib/financeCategories";
import { requireUserId } from "@/lib/auth";
import { isCurrency } from "@/lib/format";

function revalidateAll() {
  revalidatePath("/finance");
  revalidatePath("/finance/wealth");
  revalidatePath("/");
  revalidatePath("/review");
}

const SAVING_TYPES = ["fd", "mutual_fund", "cash", "bank", "stocks", "other"] as const;

function isSavingType(value: string): value is (typeof SAVING_TYPES)[number] {
  return SAVING_TYPES.includes(value as (typeof SAVING_TYPES)[number]);
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

  await db.insert(financeAccounts).values({
    userId,
    name,
    type: typeRaw,
    balance: balance.toFixed(2),
    currency,
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
    .set({ name, type: typeRaw, balance: balance.toFixed(2), currency, updatedAt: new Date() })
    .where(and(eq(financeAccounts.id, id), eq(financeAccounts.userId, userId)));
  revalidateAll();
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

export async function createFinanceEntry(formData: FormData) {
  const userId = await requireUserId();
  const source = String(formData.get("source") || "").trim();
  const amountRaw = String(formData.get("amount") || "").replaceAll(",", "").trim();
  const amount = Number(amountRaw);
  if (!source || !amountRaw || !Number.isFinite(amount) || amount <= 0) return;
  const typeRaw = String(formData.get("type") || "income");
  if (typeRaw !== "income" && typeRaw !== "expense") return;
  const type: "income" | "expense" = typeRaw;
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
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

export async function updateFinanceEntry(id: number, formData: FormData) {
  const userId = await requireUserId();
  const source = String(formData.get("source") || "").trim();
  const amount = Number(String(formData.get("amount") || "").replaceAll(",", "").trim());
  if (!source || !Number.isFinite(amount) || amount <= 0) return;
  const date = String(formData.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const notes = String(formData.get("notes") || "").trim();

  const existing = await db.query.financeEntries.findFirst({
    where: and(eq(financeEntries.id, id), eq(financeEntries.userId, userId)),
  });
  if (!existing) return;
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
}

export async function deleteFinanceEntry(id: number) {
  const userId = await requireUserId();
  await db
    .delete(financeEntries)
    .where(and(eq(financeEntries.id, id), eq(financeEntries.userId, userId)));
  revalidateAll();
}

export async function setMonthlyTarget(month: string, formData: FormData) {
  const userId = await requireUserId();
  const targetAmount = String(formData.get("targetAmount") || "").trim();
  if (!targetAmount) return;

  const existing = await db.query.financeTargets.findFirst({
    where: and(eq(financeTargets.userId, userId), eq(financeTargets.month, month)),
  });
  if (existing) {
    await db
      .update(financeTargets)
      .set({ targetAmount })
      .where(and(eq(financeTargets.userId, userId), eq(financeTargets.month, month)));
  } else {
    await db.insert(financeTargets).values({ userId, month, targetAmount });
  }
  revalidateAll();
}

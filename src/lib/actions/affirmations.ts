"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  affirmations,
} from "@/db/schema";
import { requireUserId } from "@/lib/auth";

export type AffirmationSlot = "morning" | "afternoon" | "evening";

function revalidateAll() {
  revalidatePath("/affirmations");
  revalidatePath("/");
  revalidatePath("/review");
}

export async function createAffirmation(formData: FormData) {
  const userId = await requireUserId();
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  const category = String(formData.get("category") || "General").trim();
  const subcategory = String(formData.get("subcategory") || "").trim();

  await db.insert(affirmations).values({
    userId,
    text,
    category: category || "General",
    subcategory: subcategory || null,
  });
  revalidateAll();
}

export async function updateAffirmation(id: number, formData: FormData) {
  const userId = await requireUserId();
  if (!Number.isInteger(id) || id <= 0) return;
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  const category = String(formData.get("category") || "General").trim();
  const subcategory = String(formData.get("subcategory") || "").trim();

  await db
    .update(affirmations)
    .set({
      text,
      category: category || "General",
      subcategory: subcategory || null,
    })
    .where(and(eq(affirmations.id, id), eq(affirmations.userId, userId)));
  revalidateAll();
}

export async function celebrateAffirmation(id: number, formData: FormData) {
  const userId = await requireUserId();
  if (!Number.isInteger(id) || id <= 0) return;
  const manifestedOn = String(formData.get("manifestedOn") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifestedOn)) return;
  const reflection = String(formData.get("reflection") || "").trim();

  await db.transaction(async (tx) => {
    const affirmation = await tx.query.affirmations.findFirst({
      where: and(eq(affirmations.id, id), eq(affirmations.userId, userId)),
    });
    if (!affirmation) return;

    await tx
      .insert(affirmationManifestations)
      .values({
        userId,
        affirmationId: affirmation.id,
        affirmationText: affirmation.text,
        category: affirmation.category,
        subcategory: affirmation.subcategory,
        manifestedOn,
        reflection: reflection || null,
      })
      .onConflictDoNothing({ target: affirmationManifestations.affirmationId });

    await tx
      .update(affirmations)
      .set({ active: false })
      .where(and(eq(affirmations.id, id), eq(affirmations.userId, userId)));
  });

  revalidateAll();
}

export async function setAffirmationSubcategory(id: number, subcategory: string) {
  const userId = await requireUserId();
  await db
    .update(affirmations)
    .set({ subcategory: subcategory.trim() || null })
    .where(and(eq(affirmations.id, id), eq(affirmations.userId, userId)));
  revalidateAll();
}

export async function deleteAffirmation(id: number) {
  const userId = await requireUserId();
  await db.delete(affirmations).where(and(eq(affirmations.id, id), eq(affirmations.userId, userId)));
  revalidateAll();
}

export async function toggleAffirmationActive(id: number, active: boolean) {
  const userId = await requireUserId();
  await db
    .update(affirmations)
    .set({ active })
    .where(and(eq(affirmations.id, id), eq(affirmations.userId, userId)));
  revalidateAll();
}

export async function setAffirmationCheckin(
  date: string,
  slot: AffirmationSlot,
  checked: boolean
) {
  const userId = await requireUserId();
  if (checked) {
    await db
      .insert(affirmationCheckins)
      .values({ userId, date, slot })
      .onConflictDoNothing({
        target: [affirmationCheckins.userId, affirmationCheckins.date, affirmationCheckins.slot],
      });
  } else {
    await db
      .delete(affirmationCheckins)
      .where(
        and(
          eq(affirmationCheckins.userId, userId),
          eq(affirmationCheckins.date, date),
          eq(affirmationCheckins.slot, slot)
        )
      );
  }
  revalidateAll();
}

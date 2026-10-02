"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  affirmationCheckins,
  affirmationManifestations,
  affirmations,
} from "@/db/schema";

export type AffirmationSlot = "morning" | "afternoon" | "evening";

function revalidateAll() {
  revalidatePath("/affirmations");
  revalidatePath("/");
  revalidatePath("/review");
}

export async function createAffirmation(formData: FormData) {
  const text = String(formData.get("text") || "").trim();
  if (!text) return;
  const category = String(formData.get("category") || "General").trim();
  const subcategory = String(formData.get("subcategory") || "").trim();

  await db.insert(affirmations).values({
    text,
    category: category || "General",
    subcategory: subcategory || null,
  });
  revalidateAll();
}

export async function updateAffirmation(id: number, formData: FormData) {
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
    .where(eq(affirmations.id, id));
  revalidateAll();
}

export async function celebrateAffirmation(id: number, formData: FormData) {
  if (!Number.isInteger(id) || id <= 0) return;
  const manifestedOn = String(formData.get("manifestedOn") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifestedOn)) return;
  const reflection = String(formData.get("reflection") || "").trim();

  await db.transaction(async (tx) => {
    const affirmation = await tx.query.affirmations.findFirst({
      where: eq(affirmations.id, id),
    });
    if (!affirmation) return;

    await tx
      .insert(affirmationManifestations)
      .values({
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
      .where(eq(affirmations.id, id));
  });

  revalidateAll();
}

export async function setAffirmationSubcategory(id: number, subcategory: string) {
  await db
    .update(affirmations)
    .set({ subcategory: subcategory.trim() || null })
    .where(eq(affirmations.id, id));
  revalidateAll();
}

export async function deleteAffirmation(id: number) {
  await db.delete(affirmations).where(eq(affirmations.id, id));
  revalidateAll();
}

export async function toggleAffirmationActive(id: number, active: boolean) {
  await db.update(affirmations).set({ active }).where(eq(affirmations.id, id));
  revalidateAll();
}

export async function setAffirmationCheckin(
  date: string,
  slot: AffirmationSlot,
  checked: boolean
) {
  if (checked) {
    await db
      .insert(affirmationCheckins)
      .values({ date, slot })
      .onConflictDoNothing({ target: [affirmationCheckins.date, affirmationCheckins.slot] });
  } else {
    await db
      .delete(affirmationCheckins)
      .where(and(eq(affirmationCheckins.date, date), eq(affirmationCheckins.slot, slot)));
  }
  revalidateAll();
}

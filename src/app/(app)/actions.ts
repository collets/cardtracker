"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { alerts, userPreferences, watches } from "@/db/schema";
import { requireUser } from "@/lib/auth/guards";
import { runMarketScanner } from "@/lib/scanner/service";
import { createTelegramLink, disconnectTelegram } from "@/lib/telegram/service";
import { createWatch, removeWatch, updateWatch } from "@/lib/watches/service";
import { watchInputFromForm } from "@/lib/watches/validation";
import { z } from "zod";
import {
  CARD_CONDITIONS,
  EU_EEA_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
} from "@/lib/constants";

const preferencesSchema = z.object({
  sellerCountries: z.array(z.enum(EU_EEA_COUNTRY_CODES)).min(1),
  languages: z.array(z.enum(SUPPORTED_LANGUAGE_CODES)).min(1),
  conditions: z.array(z.enum(CARD_CONDITIONS)).min(1),
  requireZero: z.boolean(),
});

export async function addWatchAction(formData: FormData) {
  const user = await requireUser();
  const input = watchInputFromForm(formData);
  await createWatch(user.id, input);
  redirect("/dashboard?created=1");
}

export async function removeWatchAction(formData: FormData) {
  const user = await requireUser();
  await removeWatch(user.id, String(formData.get("watchId") ?? ""));
  revalidatePath("/dashboard");
}

export async function updateWatchAction(formData: FormData) {
  const user = await requireUser();
  const watchId = String(formData.get("watchId") ?? "");
  const input = watchInputFromForm(formData);
  await updateWatch(user.id, watchId, input);
  revalidatePath(`/watches/${watchId}`);
  revalidatePath("/dashboard");
}

export async function scanWatchAction(formData: FormData) {
  const user = await requireUser();
  const watchId = String(formData.get("watchId") ?? "");
  const [watch] = await getDb()
    .select({ blueprintId: watches.blueprintId })
    .from(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, user.id)))
    .limit(1);
  if (!watch) throw new Error("Watch not found");
  await runMarketScanner({ explicitBlueprintId: watch.blueprintId });
  revalidatePath("/dashboard");
  revalidatePath("/alerts");
}

export async function markAlertReadAction(formData: FormData) {
  const user = await requireUser();
  const alertId = String(formData.get("alertId") ?? "");
  await getDb()
    .update(alerts)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(alerts.id, alertId),
        sql`exists (select 1 from ${watches} where ${watches.id} = ${alerts.watchId} and ${watches.userId} = ${user.id})`,
      ),
    );
  revalidatePath("/alerts");
}

export async function savePreferencesAction(formData: FormData) {
  const user = await requireUser();
  const preferences = preferencesSchema.parse({
    sellerCountries: formData.getAll("sellerCountries").map(String),
    languages: formData.getAll("languages").map(String),
    conditions: formData.getAll("conditions").map(String),
    requireZero: formData.get("requireZero") === "on",
  });
  await getDb()
    .insert(userPreferences)
    .values({
      userId: user.id,
      ...preferences,
    })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: {
        ...preferences,
        updatedAt: new Date(),
      },
    });
  revalidatePath("/settings");
}

export async function createTelegramLinkAction() {
  const user = await requireUser();
  const url = await createTelegramLink(user.id);
  redirect(url);
}

export async function disconnectTelegramAction() {
  const user = await requireUser();
  await disconnectTelegram(user.id);
  revalidatePath("/settings");
}

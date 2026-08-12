"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { alerts, userPreferences, watches } from "@/db/schema";
import { actionResult } from "@/lib/actions/server";
import { ALERT_FEEDBACK_OUTCOMES } from "@/lib/alerts/feedback-options";
import { saveAlertFeedback } from "@/lib/alerts/service";
import { requireUser } from "@/lib/auth/guards";
import { UserFacingError } from "@/lib/errors";
import { runMarketScanner, scanUserWatchlist } from "@/lib/scanner/service";
import { createTelegramLink, disconnectTelegram } from "@/lib/telegram/service";
import {
  createWatch,
  createWatches,
  removeWatch,
  updateWatch,
} from "@/lib/watches/service";
import {
  watchInputFromForm,
  watchInputsFromBulkForm,
} from "@/lib/watches/validation";
import { z } from "zod";
import {
  CARD_CONDITIONS,
  DEFAULT_CONDITIONS,
  DEFAULT_LANGUAGES,
  EU_EEA_COUNTRY_CODES,
  SUPPORTED_LANGUAGE_CODES,
} from "@/lib/constants";

const preferencesSchema = z.object({
  sellerCountries: z.array(z.enum(EU_EEA_COUNTRY_CODES)).min(1),
  languages: z.array(z.enum(SUPPORTED_LANGUAGE_CODES)).min(1),
  conditions: z.array(z.enum(CARD_CONDITIONS)).min(1),
  requireZero: z.boolean(),
});

const watchIdSchema = z.uuid("Invalid watch identifier");
const alertIdSchema = z.uuid("Invalid alert identifier");
const alertFeedbackOutcomeSchema = z.enum(ALERT_FEEDBACK_OUTCOMES, {
  error: "Choose a valid feedback option",
});

export async function addWatchAction(formData: FormData) {
  const user = await requireUser();
  const input = watchInputFromForm(formData);
  await createWatch(user.id, input);
  redirect("/dashboard?created=1");
}

export async function removeWatchAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const watchId = watchIdSchema.parse(formData.get("watchId"));
      await removeWatch(user.id, watchId);
      revalidatePath("/dashboard");
    },
    "Watch removed",
    "The watch could not be removed. Please retry.",
  );
}

export async function updateWatchAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const watchId = watchIdSchema.parse(formData.get("watchId"));
      const input = watchInputFromForm(formData);
      await updateWatch(user.id, watchId, input);
      revalidatePath(`/watches/${watchId}`);
      revalidatePath("/dashboard");
    },
    "Watch filters saved",
    "The watch filters could not be saved. Please retry.",
  );
}

export async function scanWatchAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const watchId = watchIdSchema.parse(formData.get("watchId"));
      const [watch] = await getDb()
        .select({ blueprintId: watches.blueprintId })
        .from(watches)
        .where(and(eq(watches.id, watchId), eq(watches.userId, user.id)))
        .limit(1);
      if (!watch) throw new UserFacingError("Watch not found");
      await runMarketScanner({ explicitBlueprintId: watch.blueprintId });
      revalidatePath("/dashboard");
      revalidatePath("/alerts");
    },
    "Market scan completed",
    "The market scan could not be completed. Please retry.",
  );
}

export async function scanAllWatchesAction() {
  const user = await requireUser();
  return actionResult(
    async () => {
      const result = await scanUserWatchlist(user.id);
      if (!result) throw new UserFacingError("No active watches to scan");

      revalidatePath("/dashboard");
      revalidatePath("/alerts");
      if (result.failures > 0) {
        throw new UserFacingError(
          result.successes > 0
            ? `Refreshed ${result.successes} watched card${result.successes === 1 ? "" : "s"}; ${result.failures} failed. Please retry.`
            : `The watchlist scan failed for ${result.failures} card${result.failures === 1 ? "" : "s"}. Please retry.`,
        );
      }
      return { scannedCount: result.successes };
    },
    ({ scannedCount }) =>
      `Refreshed prices for ${scannedCount} watched card${scannedCount === 1 ? "" : "s"}`,
    "The watchlist could not be scanned. Please retry.",
  );
}

export async function markAlertReadAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const alertId = alertIdSchema.parse(formData.get("alertId"));
      const [updated] = await getDb()
        .update(alerts)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(alerts.id, alertId),
            sql`exists (select 1 from ${watches} where ${watches.id} = ${alerts.watchId} and ${watches.userId} = ${user.id})`,
          ),
        )
        .returning({ id: alerts.id });
      if (!updated) throw new UserFacingError("Alert not found");
      revalidatePath("/alerts");
    },
    "Alert marked as read",
    "The alert could not be updated. Please retry.",
  );
}

export async function saveAlertFeedbackAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const alertId = alertIdSchema.parse(formData.get("alertId"));
      const outcome = alertFeedbackOutcomeSchema.parse(formData.get("outcome"));
      await saveAlertFeedback(user.id, alertId, outcome);
      revalidatePath("/alerts");
      revalidatePath("/dashboard");
      return outcome;
    },
    "Thanks — your feedback was saved",
    "Your feedback could not be saved. Please retry.",
  );
}

export async function savePreferencesAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
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
    },
    "Marketplace defaults saved",
    "The marketplace defaults could not be saved. Please retry.",
  );
}

export async function quickAddWatchAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const blueprintId = z.coerce
        .number()
        .int()
        .positive()
        .parse(formData.get("blueprintId"));
      const [preferences] = await getDb()
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);
      const defaults = new FormData();
      defaults.set("blueprintId", String(blueprintId));
      for (const language of preferences?.languages ?? DEFAULT_LANGUAGES) {
        defaults.append("languages", language);
      }
      for (const condition of preferences?.conditions ?? DEFAULT_CONDITIONS) {
        defaults.append("conditions", condition);
      }
      if (preferences?.requireZero) defaults.set("requireZero", "on");
      await createWatch(user.id, watchInputFromForm(defaults));
      revalidatePath("/dashboard");
      return blueprintId;
    },
    "Card added to your watchlist",
    "The card could not be added to your watchlist. Please retry.",
  );
}

export async function bulkAddWatchesAction(formData: FormData) {
  const user = await requireUser();
  return actionResult(
    async () => {
      const inputs = watchInputsFromBulkForm(formData);
      const created = await createWatches(user.id, inputs);
      revalidatePath("/dashboard");
      return { createdCount: created.length };
    },
    ({ createdCount }) =>
      `${createdCount} card${createdCount === 1 ? "" : "s"} added to your watchlist`,
    "The selected cards could not be added to your watchlist. Please retry.",
  );
}

export async function disconnectTelegramAction() {
  const user = await requireUser();
  return actionResult(
    async () => {
      await disconnectTelegram(user.id);
      revalidatePath("/settings");
    },
    "Telegram disconnected",
    "Telegram could not be disconnected. Please retry.",
  );
}

export async function createTelegramLinkAction() {
  const user = await requireUser();
  const url = await createTelegramLink(user.id);
  redirect(url);
}

import "server-only";

import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { alertFeedback, alerts, watches } from "@/db/schema";
import type { AlertFeedbackOutcome } from "@/lib/alerts/feedback-options";
import { UserFacingError } from "@/lib/errors";

export async function saveAlertFeedback(
  userId: string,
  alertId: string,
  outcome: AlertFeedbackOutcome,
) {
  await getDb().transaction(async (tx) => {
    const [ownedAlert] = await tx
      .select({ id: alerts.id, readAt: alerts.readAt })
      .from(alerts)
      .innerJoin(watches, eq(watches.id, alerts.watchId))
      .where(and(eq(alerts.id, alertId), eq(watches.userId, userId)))
      .limit(1);
    if (!ownedAlert) throw new UserFacingError("Alert not found");

    const now = new Date();
    await tx
      .insert(alertFeedback)
      .values({ alertId, outcome, updatedAt: now })
      .onConflictDoUpdate({
        target: alertFeedback.alertId,
        set: { outcome, updatedAt: now },
      });

    if (!ownedAlert.readAt) {
      await tx
        .update(alerts)
        .set({ readAt: now })
        .where(eq(alerts.id, alertId));
    }
  });
}

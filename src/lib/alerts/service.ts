import "server-only";

import { and, eq, sql } from "drizzle-orm";
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

export async function archiveAlert(userId: string, alertId: string) {
  const now = new Date();
  const [archived] = await getDb()
    .update(alerts)
    .set({ state: "dismissed", archivedAt: now, readAt: now })
    .where(
      and(
        eq(alerts.id, alertId),
        sql`exists (select 1 from ${watches} where ${watches.id} = ${alerts.watchId} and ${watches.userId} = ${userId})`,
      ),
    )
    .returning({ id: alerts.id });
  if (!archived) throw new UserFacingError("Alert not found");
}

export async function restoreAlertToInbox(userId: string, alertId: string) {
  const [restored] = await getDb()
    .update(alerts)
    .set({ state: "active", archivedAt: null, readAt: null, missCount: 0 })
    .where(
      and(
        eq(alerts.id, alertId),
        eq(alerts.state, "dismissed"),
        sql`exists (select 1 from ${watches} where ${watches.id} = ${alerts.watchId} and ${watches.userId} = ${userId})`,
      ),
    )
    .returning({ id: alerts.id });
  if (!restored) throw new UserFacingError("Archived alert not found");
}

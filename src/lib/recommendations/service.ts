import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  blueprintScanState,
  thresholdRecommendations,
  watches,
} from "@/db/schema";
import { UserFacingError } from "@/lib/errors";

export async function applyThresholdRecommendation(
  userId: string,
  recommendationId: string,
) {
  const updated = await getDb().transaction(async (tx) => {
    // Claim the pending recommendation before touching the watch. The
    // conditional update serializes apply/dismiss races without holding a
    // separate application lock.
    const [recommendation] = await tx
      .update(thresholdRecommendations)
      .set({ status: "applied", resolvedAt: new Date() })
      .where(
        and(
          eq(thresholdRecommendations.id, recommendationId),
          eq(thresholdRecommendations.status, "pending"),
          sql`exists (
            select 1 from ${watches}
            where ${watches.id} = ${thresholdRecommendations.watchId}
              and ${watches.userId} = ${userId}
          )`,
        ),
      )
      .returning();

    if (!recommendation) {
      throw new UserFacingError("Threshold suggestion not found");
    }

    const [updatedWatch] = await tx
      .update(watches)
      .set({
        discountPercent: recommendation.proposedDiscountPercent,
        minSavingsCents: recommendation.proposedMinSavingsCents,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(watches.id, recommendation.watchId),
          eq(watches.userId, userId),
          eq(watches.discountPercent, recommendation.currentDiscountPercent),
          eq(watches.minSavingsCents, recommendation.currentMinSavingsCents),
        ),
      )
      .returning({ id: watches.id, blueprintId: watches.blueprintId });

    if (!updatedWatch) {
      await tx
        .update(thresholdRecommendations)
        .set({ status: "stale", resolvedAt: new Date() })
        .where(
          and(
            eq(thresholdRecommendations.id, recommendationId),
            eq(thresholdRecommendations.status, "applied"),
          ),
        );
      return null;
    }
    await tx
      .update(blueprintScanState)
      .set({ nextScanAt: new Date() })
      .where(eq(blueprintScanState.blueprintId, updatedWatch.blueprintId));

    return updatedWatch;
  });

  if (!updated) {
    throw new UserFacingError(
      "The watch thresholds changed after this suggestion was created",
    );
  }
  return updated;
}

export async function dismissThresholdRecommendation(
  userId: string,
  recommendationId: string,
) {
  const [dismissed] = await getDb()
    .update(thresholdRecommendations)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(
      and(
        eq(thresholdRecommendations.id, recommendationId),
        eq(thresholdRecommendations.status, "pending"),
        sql`exists (
          select 1 from ${watches}
          where ${watches.id} = ${thresholdRecommendations.watchId}
            and ${watches.userId} = ${userId}
        )`,
      ),
    )
    .returning({ id: thresholdRecommendations.id });
  if (!dismissed) throw new UserFacingError("Threshold suggestion not found");
}

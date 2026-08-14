import "server-only";

import { cache } from "react";
import { and, count, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { alerts, thresholdRecommendations, watches } from "@/db/schema";
import type { AttentionCounts } from "@/lib/attention/types";

export const getAttentionCounts = cache(
  async (userId: string): Promise<AttentionCounts> => {
    const [dealRows, recommendationRows] = await Promise.all([
      getDb()
        .select({ value: count() })
        .from(alerts)
        .innerJoin(watches, eq(watches.id, alerts.watchId))
        .where(
          and(
            eq(watches.userId, userId),
            eq(alerts.state, "active"),
            isNull(alerts.readAt),
          ),
        ),
      getDb()
        .select({ value: count() })
        .from(thresholdRecommendations)
        .innerJoin(watches, eq(watches.id, thresholdRecommendations.watchId))
        .where(
          and(
            eq(watches.userId, userId),
            eq(thresholdRecommendations.status, "pending"),
          ),
        ),
    ]);
    const unreadDeals = dealRows[0]?.value ?? 0;
    const pendingRecommendations = recommendationRows[0]?.value ?? 0;

    return {
      unreadDeals,
      pendingRecommendations,
      total: unreadDeals + pendingRecommendations,
    };
  },
);

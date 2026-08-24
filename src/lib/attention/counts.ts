import "server-only";

import { cache } from "react";
import { getSql } from "@/db";
import { observeCancellableDatabaseOperation } from "@/lib/db/observability";
import type { AttentionCounts } from "@/lib/attention/types";

export const getAttentionCounts = cache(
  async (userId: string): Promise<AttentionCounts> => {
    const [counts] = await observeCancellableDatabaseOperation(
      "attention.counts",
      getSql()<
        Array<{
          unreadDeals: number;
          pendingRecommendations: number;
        }>
      >`
        select
          (
            select count(*)::integer
            from alerts alert_record
            inner join watches watch_record
              on watch_record.id = alert_record.watch_id
            where watch_record.user_id = ${userId}
              and alert_record.state = 'active'
              and alert_record.read_at is null
          ) as "unreadDeals",
          (
            select count(*)::integer
            from threshold_recommendations recommendation
            inner join watches watch_record
              on watch_record.id = recommendation.watch_id
            where watch_record.user_id = ${userId}
              and recommendation.status = 'pending'
          ) as "pendingRecommendations"
      `,
    );
    const unreadDeals = counts?.unreadDeals ?? 0;
    const pendingRecommendations = counts?.pendingRecommendations ?? 0;

    return {
      unreadDeals,
      pendingRecommendations,
      total: unreadDeals + pendingRecommendations,
    };
  },
);

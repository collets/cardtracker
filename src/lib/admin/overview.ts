import "server-only";

import { count, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import {
  alertFeedback,
  alerts,
  blueprints,
  guestAccessLinks,
  invitations,
  scanRuns,
  telegramChannels,
  users,
  watches,
} from "@/db/schema";
import { observeDatabaseOperation } from "@/lib/db/observability";

export const ADMIN_RUNS_PER_PAGE = 20;

type LoadAdminOverviewOptions = {
  requestedPage: number;
  runWhere?: SQL;
};

export async function loadAdminOverview({
  requestedPage,
  runWhere,
}: LoadAdminOverviewOptions) {
  return getDb().transaction(async (tx) => {
    await observeDatabaseOperation("admin.read-only-transaction", () =>
      tx.execute(sql`set transaction read only`),
    );
    await observeDatabaseOperation("admin.configure-timeouts", () =>
      tx.execute(sql`
        select
          set_config('statement_timeout', '10s', true),
          set_config('lock_timeout', '3s', true),
          set_config('idle_in_transaction_session_timeout', '15s', true)
      `),
    );

    const userRows = await observeDatabaseOperation("admin.users", () =>
      tx
        .select({
          id: users.id,
          email: users.email,
          role: users.role,
          watchQuota: users.watchQuota,
          disabled: users.disabled,
          telegramChatId: telegramChannels.chatId,
          telegramDiagnosticsEnabled: telegramChannels.diagnosticsEnabled,
        })
        .from(users)
        .leftJoin(telegramChannels, eq(telegramChannels.userId, users.id))
        .where(eq(users.kind, "member"))
        .orderBy(users.email),
    );

    const inviteRows = await observeDatabaseOperation("admin.invitations", () =>
      tx
        .select({
          id: invitations.id,
          email: invitations.email,
          acceptedAt: invitations.acceptedAt,
        })
        .from(invitations)
        .orderBy(desc(invitations.createdAt)),
    );

    const [stats] = await observeDatabaseOperation(
      "admin.statistics",
      async () =>
        tx.execute<{
          catalogCount: number;
          watchCount: number;
          uniqueCount: number;
          alertCount: number;
        }>(sql`
          select
            (select count(*)::integer from ${blueprints}) as "catalogCount",
            (
              select count(*)::integer from ${watches}
              where ${watches.active} = true
            ) as "watchCount",
            (
              select count(distinct ${watches.blueprintId})::integer
              from ${watches}
              where ${watches.active} = true
            ) as "uniqueCount",
            (select count(*)::integer from ${alerts}) as "alertCount"
        `),
    );

    const feedbackRows = await observeDatabaseOperation(
      "admin.alert-feedback",
      () =>
        tx
          .select({ outcome: alertFeedback.outcome, value: count() })
          .from(alertFeedback)
          .groupBy(alertFeedback.outcome),
    );

    const guestLinkRows = await observeDatabaseOperation(
      "admin.guest-links",
      () =>
        tx
          .select({
            id: guestAccessLinks.id,
            maxUses: guestAccessLinks.maxUses,
            usedCount: guestAccessLinks.usedCount,
            expiresAt: guestAccessLinks.expiresAt,
            revokedAt: guestAccessLinks.revokedAt,
          })
          .from(guestAccessLinks)
          .orderBy(desc(guestAccessLinks.createdAt))
          .limit(10),
    );

    const [runCount] = await observeDatabaseOperation("admin.run-count", () =>
      tx.select({ value: count() }).from(scanRuns).where(runWhere),
    );
    const runTotal = runCount?.value ?? 0;
    const runPageCount = Math.max(1, Math.ceil(runTotal / ADMIN_RUNS_PER_PAGE));
    const resolvedRunPage = Math.min(requestedPage, runPageCount);

    const runRows = await observeDatabaseOperation("admin.recent-runs", () =>
      tx
        .select({
          id: scanRuns.id,
          kind: scanRuns.kind,
          status: scanRuns.status,
          startedAt: scanRuns.startedAt,
          claimedCount: scanRuns.claimedCount,
          failureCount: scanRuns.failureCount,
          error: scanRuns.error,
        })
        .from(scanRuns)
        .where(runWhere)
        .orderBy(desc(scanRuns.startedAt))
        .limit(ADMIN_RUNS_PER_PAGE)
        .offset((resolvedRunPage - 1) * ADMIN_RUNS_PER_PAGE),
    );

    return {
      userRows,
      inviteRows,
      runRows,
      catalogCount: stats?.catalogCount ?? 0,
      watchCount: stats?.watchCount ?? 0,
      uniqueCount: stats?.uniqueCount ?? 0,
      alertCount: stats?.alertCount ?? 0,
      feedbackRows,
      guestLinkRows,
      runTotal,
      runPageCount,
      resolvedRunPage,
    };
  });
}

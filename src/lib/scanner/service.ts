import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  alerts,
  blueprints,
  blueprintScanState,
  guestAccessRedemptions,
  notificationDeliveries,
  priceObservations,
  scanRuns,
  telegramLinkTokens,
  userPreferences,
  users,
  watches,
  watchMetrics,
} from "@/db/schema";
import { CardTraderClient } from "@/lib/cardtrader/client";
import type { MarketListing } from "@/lib/cardtrader/types";
import { PRICE_HISTORY_RETENTION_DAYS } from "@/lib/constants";
import { shouldCreateAlertEvent } from "@/lib/alerts/lifecycle";
import { evaluateDeal } from "@/lib/deals/evaluate";
import type { WatchFilters } from "@/lib/deals/types";
import { getServerEnv } from "@/lib/env";
import { boundedErrorMessage } from "@/lib/errors";
import {
  fetchMarketplacePlan,
  planMarketplaceFetches,
  type BlueprintMarketplaceProductClient,
  type MarketplaceProductClient,
} from "@/lib/scanner/marketplace";
import {
  dispatchPendingNotifications,
  queueTelegramDelivery,
} from "@/lib/telegram/service";

const BLUEPRINT_PROCESS_CONCURRENCY = 5;
const MILLISECONDS_PER_MINUTE = 60_000;
const MILLISECONDS_PER_DAY = 24 * 60 * MILLISECONDS_PER_MINUTE;
// The scheduler invokes the route every minute. Individual blueprints remain
// due only every five minutes, which absorbs invocation drift without making
// extra CardTrader calls for work that is not due.
export const WATCH_SCAN_INTERVAL_MS = 5 * MILLISECONDS_PER_MINUTE;
// Keep a claimed blueprint unavailable longer than the route's 240-second
// maximum duration. This prevents a late invocation from being claimed again
// while its predecessor is still finalizing persistence.
export const WATCH_SCAN_LEASE_MS = WATCH_SCAN_INTERVAL_MS;
const BASELINE_LOOKBACK_MS = 7 * MILLISECONDS_PER_DAY;

function hourBucket(date: Date) {
  const value = new Date(date);
  value.setUTCMinutes(0, 0, 0);
  return value;
}

export async function claimDueBlueprints(
  limit = getServerEnv().SCAN_BATCH_SIZE,
  onlyBlueprintId?: number,
): Promise<number[]> {
  const rows = await getSql()<Array<{ blueprint_id: number }>>`
    with candidates as (
      select state.blueprint_id
      from blueprint_scan_state state
      where state.next_scan_at <= now()
        and (state.lease_until is null or state.lease_until < now())
        and (${onlyBlueprintId ?? null}::integer is null or state.blueprint_id = ${onlyBlueprintId ?? null})
        and exists (
          select 1 from watches watch
          inner join users account on account.id = watch.user_id
          left join guest_access_redemptions guest on guest.user_id = account.id
          where watch.blueprint_id = state.blueprint_id
            and watch.active = true
            and (account.kind = 'member' or guest.expires_at > now())
        )
      order by state.blueprint_id
      limit ${limit}
      for update of state skip locked
    )
    update blueprint_scan_state state
    set lease_until = now() + ${WATCH_SCAN_LEASE_MS} * interval '1 millisecond'
    from candidates
    where state.blueprint_id = candidates.blueprint_id
    returning state.blueprint_id
  `;
  return rows.map((row) => row.blueprint_id);
}

async function deactivateExpiredGuestWatches() {
  await getDb()
    .update(watches)
    .set({ active: false, updatedAt: new Date() })
    .where(
      and(
        eq(watches.active, true),
        sql`exists (
          select 1
            from ${users} account
            inner join ${guestAccessRedemptions} guest on guest.user_id = account.id
            where account.id = ${watches.userId}
            and account.kind = 'guest'
            and guest.expires_at <= now()
        )`,
      ),
    );
}

async function recordBlueprintFailure(blueprintId: number, error: unknown) {
  await getDb()
    .update(blueprintScanState)
    .set({
      leaseUntil: null,
      failureCount: sql`${blueprintScanState.failureCount} + 1`,
      lastError: boundedErrorMessage(error, "Unknown scan error"),
      nextScanAt: new Date(Date.now() + WATCH_SCAN_INTERVAL_MS),
    })
    .where(eq(blueprintScanState.blueprintId, blueprintId));
}

async function processBlueprintListings(
  blueprintId: number,
  listings: MarketListing[],
): Promise<{ watches: number; alerts: number }> {
  try {
    const watchRows = await getDb()
      .select({ watch: watches, preferences: userPreferences })
      .from(watches)
      .leftJoin(userPreferences, eq(userPreferences.userId, watches.userId))
      .where(
        and(eq(watches.blueprintId, blueprintId), eq(watches.active, true)),
      );
    const now = new Date();
    let createdAlerts = 0;

    for (const row of watchRows) {
      const watch = row.watch;
      const since = new Date(now.getTime() - BASELINE_LOOKBACK_MS);
      const history = await getDb()
        .select({ value: priceObservations.currentBaselineCents })
        .from(priceObservations)
        .where(
          and(
            eq(priceObservations.watchId, watch.id),
            gt(priceObservations.bucketAt, since),
          ),
        )
        .orderBy(asc(priceObservations.bucketAt));

      const filters: WatchFilters = {
        languages: watch.languages,
        conditions: watch.conditions,
        foil: watch.foil,
        graded: watch.graded,
        requireZero: watch.requireZero,
        sellerCountries:
          watch.sellerCountries ?? row.preferences?.sellerCountries ?? [],
        discountPercent: watch.discountPercent,
        minSavingsCents: watch.minSavingsCents,
      };
      const evaluation = evaluateDeal(
        listings,
        filters,
        history
          .map((point) => point.value)
          .filter((value): value is number => value !== null),
      );
      const metricValues = {
        bestProductId: evaluation.candidate?.productId ?? null,
        candidate: evaluation.candidate ?? null,
        bestPriceCents: evaluation.candidate?.priceCents ?? null,
        currentBaselineCents: evaluation.currentBaselineCents,
        historicalBaselineCents: evaluation.historicalBaselineCents,
        referencePriceCents: evaluation.referencePriceCents,
        eligibleCount: evaluation.eligibleListings.length,
        discountBps: evaluation.discountBps,
        confidence: evaluation.confidence,
        qualifies: evaluation.qualifies,
        rejectionReason: evaluation.rejectionReason,
        scannedAt: now,
      };

      await getDb()
        .insert(watchMetrics)
        .values({
          watchId: watch.id,
          ...metricValues,
        })
        .onConflictDoUpdate({
          target: watchMetrics.watchId,
          set: metricValues,
        });

      const observationValues = {
        bestPriceCents: evaluation.candidate?.priceCents ?? null,
        currentBaselineCents: evaluation.currentBaselineCents,
        eligibleCount: evaluation.eligibleListings.length,
      };

      await getDb()
        .insert(priceObservations)
        .values({
          watchId: watch.id,
          bucketAt: hourBucket(now),
          ...observationValues,
        })
        .onConflictDoUpdate({
          target: [priceObservations.watchId, priceObservations.bucketAt],
          set: observationValues,
        });

      const alertsForWatch = await getDb()
        .select()
        .from(alerts)
        .where(eq(alerts.watchId, watch.id))
        .orderBy(desc(alerts.lastSeenAt), desc(alerts.firstSeenAt));
      const activeForWatch = alertsForWatch.filter(
        (alert) => alert.state === "active",
      );

      if (
        evaluation.qualifies &&
        evaluation.candidate &&
        evaluation.referencePriceCents &&
        evaluation.discountBps !== null &&
        evaluation.confidence
      ) {
        const candidate = evaluation.candidate;
        const alertEvidence = {
          candidate,
          candidatePriceCents: candidate.priceCents,
          referencePriceCents: evaluation.referencePriceCents,
          discountBps: evaluation.discountBps,
          confidence: evaluation.confidence,
        };
        const activeForListing = activeForWatch.find(
          (alert) => alert.productId === candidate.productId,
        );
        const latestAlertForListing = alertsForWatch.find(
          (alert) => alert.productId === candidate.productId,
        );
        const createsNewEvent = shouldCreateAlertEvent({
          productId: candidate.productId,
          candidatePriceCents: candidate.priceCents,
          activeAlerts: activeForWatch,
          latestAlertForListing,
          now,
        });

        if (createsNewEvent) {
          if (activeForListing) {
            await getDb()
              .update(alerts)
              .set({ state: "expired", expiredAt: now })
              .where(eq(alerts.id, activeForListing.id));
          }
          const [saved] = await getDb()
            .insert(alerts)
            .values({
              watchId: watch.id,
              productId: candidate.productId,
              ...alertEvidence,
              lastNotifiedAt: now,
              lastNotifiedPriceCents: candidate.priceCents,
            })
            .returning();
          if (saved) {
            createdAlerts += 1;
            await queueTelegramDelivery(saved.id, now);
          }
        } else if (activeForListing) {
          await getDb()
            .update(alerts)
            .set({
              ...alertEvidence,
              missCount: 0,
              lastSeenAt: now,
            })
            .where(eq(alerts.id, activeForListing.id));
        } else if (latestAlertForListing) {
          await getDb()
            .update(alerts)
            .set({ lastSeenAt: now })
            .where(eq(alerts.id, latestAlertForListing.id));
        }
      }

      const seenProductId = evaluation.qualifies
        ? evaluation.candidate?.productId
        : null;
      for (const active of activeForWatch) {
        if (active.productId === seenProductId) continue;
        const misses = active.missCount + 1;
        await getDb()
          .update(alerts)
          .set({
            missCount: misses,
            state: misses >= 2 ? "expired" : "active",
            expiredAt: misses >= 2 ? now : null,
          })
          .where(eq(alerts.id, active.id));
      }
    }

    await getDb()
      .update(blueprintScanState)
      .set({
        lastScanAt: now,
        nextScanAt: new Date(now.getTime() + WATCH_SCAN_INTERVAL_MS),
        leaseUntil: null,
        failureCount: 0,
        lastError: null,
      })
      .where(eq(blueprintScanState.blueprintId, blueprintId));
    return { watches: watchRows.length, alerts: createdAlerts };
  } catch (error) {
    await recordBlueprintFailure(blueprintId, error);
    throw error;
  }
}

export async function scanBlueprint(
  blueprintId: number,
  client: BlueprintMarketplaceProductClient = new CardTraderClient(),
): Promise<{ watches: number; alerts: number }> {
  let listings: MarketListing[];
  try {
    listings = await client.marketplaceProducts(blueprintId);
  } catch (error) {
    await recordBlueprintFailure(blueprintId, error);
    throw error;
  }
  return processBlueprintListings(blueprintId, listings);
}

export async function runMarketScanner(
  options: {
    explicitBlueprintId?: number;
    explicitBlueprintIds?: readonly number[];
    client?: MarketplaceProductClient;
    dispatchNotifications?: () => Promise<{ sent: number; failed: number }>;
  } = {},
) {
  if (
    options.explicitBlueprintId !== undefined &&
    options.explicitBlueprintIds !== undefined
  ) {
    throw new Error("Choose either one explicit blueprint or a blueprint list");
  }
  await deactivateExpiredGuestWatches();
  const [run] = await getDb()
    .insert(scanRuns)
    .values({ kind: "market" })
    .returning();
  if (!run) throw new Error("Could not create market scan run");
  const explicitlyRequestedBlueprintIds =
    options.explicitBlueprintId !== undefined
      ? [options.explicitBlueprintId]
      : options.explicitBlueprintIds !== undefined
        ? [...new Set(options.explicitBlueprintIds)]
        : null;
  const blueprintIds =
    explicitlyRequestedBlueprintIds ?? (await claimDueBlueprints());
  let successes = 0;
  let failures = 0;
  let watchCount = 0;
  let alertCount = 0;
  const client = options.client ?? new CardTraderClient();
  let expansionFetches = 0;
  let blueprintFetches = 0;

  if (options.explicitBlueprintId !== undefined) {
    blueprintFetches = 1;
    try {
      const result = await scanBlueprint(options.explicitBlueprintId, client);
      successes = 1;
      watchCount = result.watches;
      alertCount = result.alerts;
    } catch {
      failures = 1;
    }
  } else if (blueprintIds.length > 0) {
    const blueprintRows = await getDb()
      .select({
        blueprintId: blueprints.id,
        expansionId: blueprints.expansionId,
      })
      .from(blueprints)
      .where(inArray(blueprints.id, blueprintIds));
    const fetchResult = await fetchMarketplacePlan(
      planMarketplaceFetches(blueprintRows),
      client,
    );
    expansionFetches = fetchResult.expansionFetches;
    blueprintFetches = fetchResult.blueprintFetches;

    for (const [blueprintId, error] of fetchResult.failures) {
      await recordBlueprintFailure(blueprintId, error);
      failures += 1;
    }

    const fetchedBlueprintIds = blueprintIds.filter((blueprintId) =>
      fetchResult.listingsByBlueprint.has(blueprintId),
    );
    for (
      let index = 0;
      index < fetchedBlueprintIds.length;
      index += BLUEPRINT_PROCESS_CONCURRENCY
    ) {
      const batch = fetchedBlueprintIds.slice(
        index,
        index + BLUEPRINT_PROCESS_CONCURRENCY,
      );
      const outcomes = await Promise.allSettled(
        batch.map((blueprintId) =>
          processBlueprintListings(
            blueprintId,
            fetchResult.listingsByBlueprint.get(blueprintId) ?? [],
          ),
        ),
      );
      for (const outcome of outcomes) {
        if (outcome.status === "fulfilled") {
          successes += 1;
          watchCount += outcome.value.watches;
          alertCount += outcome.value.alerts;
        } else {
          failures += 1;
        }
      }
    }
  }

  await getDb()
    .update(scanRuns)
    .set({
      status: failures > 0 && successes === 0 ? "failed" : "succeeded",
      completedAt: new Date(),
      claimedCount: blueprintIds.length,
      successCount: successes,
      failureCount: failures,
      details: {
        watches: watchCount,
        alerts: alertCount,
        marketplaceFetches: {
          expansions: expansionFetches,
          blueprints: blueprintFetches,
        },
      },
      error: failures > 0 ? `${failures} blueprint scans failed` : null,
    })
    .where(eq(scanRuns.id, run.id));

  await (options.dispatchNotifications ?? dispatchPendingNotifications)();
  return {
    claimed: blueprintIds.length,
    successes,
    failures,
    watches: watchCount,
    alerts: alertCount,
    marketplaceFetches: {
      expansions: expansionFetches,
      blueprints: blueprintFetches,
    },
  };
}

export async function scanUserWatchlist(
  userId: string,
  options: {
    client?: MarketplaceProductClient;
    dispatchNotifications?: () => Promise<{ sent: number; failed: number }>;
  } = {},
) {
  const rows = await getDb()
    .selectDistinct({ blueprintId: watches.blueprintId })
    .from(watches)
    .where(and(eq(watches.userId, userId), eq(watches.active, true)));
  if (rows.length === 0) return null;

  return runMarketScanner({
    explicitBlueprintIds: rows.map((row) => row.blueprintId),
    client: options.client,
    dispatchNotifications: options.dispatchNotifications,
  });
}

export async function pruneOperationalData(
  scope: {
    watchIds?: string[];
    notificationAlertIds?: string[];
    telegramTokenUserIds?: string[];
  } = {},
) {
  const historyCutoff = new Date(
    Date.now() - PRICE_HISTORY_RETENTION_DAYS * MILLISECONDS_PER_DAY,
  );
  const tokenCutoff = new Date();
  await getDb()
    .delete(priceObservations)
    .where(
      and(
        lt(priceObservations.bucketAt, historyCutoff),
        scope.watchIds?.length
          ? inArray(priceObservations.watchId, scope.watchIds)
          : undefined,
      ),
    );
  await getDb()
    .delete(telegramLinkTokens)
    .where(
      and(
        or(
          lt(telegramLinkTokens.expiresAt, tokenCutoff),
          isNotNull(telegramLinkTokens.usedAt),
        ),
        scope.telegramTokenUserIds?.length
          ? inArray(telegramLinkTokens.userId, scope.telegramTokenUserIds)
          : undefined,
      ),
    );
  await getDb()
    .delete(notificationDeliveries)
    .where(
      and(
        lt(notificationDeliveries.createdAt, historyCutoff),
        inArray(notificationDeliveries.status, ["sent", "failed"]),
        scope.notificationAlertIds?.length
          ? inArray(notificationDeliveries.alertId, scope.notificationAlertIds)
          : undefined,
      ),
    );
}

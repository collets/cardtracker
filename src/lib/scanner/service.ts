import "server-only";
import { and, asc, eq, gt, inArray, lt, or, sql } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  alerts,
  blueprintScanState,
  priceObservations,
  scanRuns,
  userPreferences,
  watches,
  watchMetrics,
} from "@/db/schema";
import { CardTraderClient } from "@/lib/cardtrader/client";
import { evaluateDeal } from "@/lib/deals/evaluate";
import type { WatchFilters } from "@/lib/deals/types";
import { getServerEnv } from "@/lib/env";
import {
  dispatchPendingNotifications,
  queueTelegramDelivery,
} from "@/lib/telegram/service";

function hourBucket(date: Date) {
  const value = new Date(date);
  value.setUTCMinutes(0, 0, 0);
  return value;
}

function safeError(error: unknown) {
  return error instanceof Error
    ? error.message.slice(0, 500)
    : "Unknown scan error";
}

export async function claimDueBlueprints(
  limit = getServerEnv().SCAN_BATCH_SIZE,
): Promise<number[]> {
  const rows = await getSql()<Array<{ blueprint_id: number }>>`
    with candidates as (
      select state.blueprint_id
      from blueprint_scan_state state
      where state.next_scan_at <= now()
        and (state.lease_until is null or state.lease_until < now())
        and exists (
          select 1 from watches watch
          where watch.blueprint_id = state.blueprint_id and watch.active = true
        )
      order by state.blueprint_id
      limit ${limit}
      for update of state skip locked
    )
    update blueprint_scan_state state
    set lease_until = now() + interval '4 minutes'
    from candidates
    where state.blueprint_id = candidates.blueprint_id
    returning state.blueprint_id
  `;
  return rows.map((row) => row.blueprint_id);
}

export async function scanBlueprint(
  blueprintId: number,
  client = new CardTraderClient(),
): Promise<{ watches: number; alerts: number }> {
  try {
    const [listings, watchRows] = await Promise.all([
      client.marketplaceProducts(blueprintId),
      getDb()
        .select({ watch: watches, preferences: userPreferences })
        .from(watches)
        .leftJoin(userPreferences, eq(userPreferences.userId, watches.userId))
        .where(
          and(eq(watches.blueprintId, blueprintId), eq(watches.active, true)),
        ),
    ]);
    const now = new Date();
    let createdAlerts = 0;

    for (const row of watchRows) {
      const watch = row.watch;
      const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
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

      await getDb()
        .insert(watchMetrics)
        .values({
          watchId: watch.id,
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
        })
        .onConflictDoUpdate({
          target: watchMetrics.watchId,
          set: {
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
          },
        });

      await getDb()
        .insert(priceObservations)
        .values({
          watchId: watch.id,
          bucketAt: hourBucket(now),
          bestPriceCents: evaluation.candidate?.priceCents ?? null,
          currentBaselineCents: evaluation.currentBaselineCents,
          eligibleCount: evaluation.eligibleListings.length,
        })
        .onConflictDoUpdate({
          target: [priceObservations.watchId, priceObservations.bucketAt],
          set: {
            bestPriceCents: evaluation.candidate?.priceCents ?? null,
            currentBaselineCents: evaluation.currentBaselineCents,
            eligibleCount: evaluation.eligibleListings.length,
          },
        });

      const activeForWatch = await getDb()
        .select()
        .from(alerts)
        .where(and(eq(alerts.watchId, watch.id), eq(alerts.state, "active")));

      if (
        evaluation.qualifies &&
        evaluation.candidate &&
        evaluation.referencePriceCents &&
        evaluation.discountBps !== null &&
        evaluation.confidence
      ) {
        const existing = activeForWatch.find(
          (alert) => alert.productId === evaluation.candidate?.productId,
        );
        if (existing) {
          await getDb()
            .update(alerts)
            .set({
              candidate: evaluation.candidate,
              candidatePriceCents: evaluation.candidate.priceCents,
              referencePriceCents: evaluation.referencePriceCents,
              discountBps: evaluation.discountBps,
              confidence: evaluation.confidence,
              missCount: 0,
              lastSeenAt: now,
            })
            .where(eq(alerts.id, existing.id));
        } else {
          const [known] = await getDb()
            .select()
            .from(alerts)
            .where(
              and(
                eq(alerts.watchId, watch.id),
                eq(alerts.productId, evaluation.candidate.productId),
              ),
            )
            .limit(1);
          const canRenotify =
            !known?.lastNotifiedAt ||
            now.getTime() - known.lastNotifiedAt.getTime() >=
              24 * 60 * 60 * 1000 ||
            (known.lastNotifiedPriceCents !== null &&
              evaluation.candidate.priceCents <=
                known.lastNotifiedPriceCents * 0.9);
          const [saved] = known
            ? await getDb()
                .update(alerts)
                .set({
                  state: "active",
                  candidate: evaluation.candidate,
                  candidatePriceCents: evaluation.candidate.priceCents,
                  referencePriceCents: evaluation.referencePriceCents,
                  discountBps: evaluation.discountBps,
                  confidence: evaluation.confidence,
                  missCount: 0,
                  lastSeenAt: now,
                  expiredAt: null,
                  lastNotifiedAt: canRenotify ? now : known.lastNotifiedAt,
                  lastNotifiedPriceCents: canRenotify
                    ? evaluation.candidate.priceCents
                    : known.lastNotifiedPriceCents,
                })
                .where(eq(alerts.id, known.id))
                .returning()
            : await getDb()
                .insert(alerts)
                .values({
                  watchId: watch.id,
                  productId: evaluation.candidate.productId,
                  candidate: evaluation.candidate,
                  candidatePriceCents: evaluation.candidate.priceCents,
                  referencePriceCents: evaluation.referencePriceCents,
                  discountBps: evaluation.discountBps,
                  confidence: evaluation.confidence,
                  lastNotifiedAt: now,
                  lastNotifiedPriceCents: evaluation.candidate.priceCents,
                })
                .returning();
          if (saved && (!known || canRenotify)) {
            createdAlerts += 1;
            await queueTelegramDelivery(saved.id, now);
          }
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
        nextScanAt: new Date(now.getTime() + 5 * 60 * 1000),
        leaseUntil: null,
        failureCount: 0,
        lastError: null,
      })
      .where(eq(blueprintScanState.blueprintId, blueprintId));
    return { watches: watchRows.length, alerts: createdAlerts };
  } catch (error) {
    await getDb()
      .update(blueprintScanState)
      .set({
        leaseUntil: null,
        failureCount: sql`${blueprintScanState.failureCount} + 1`,
        lastError: safeError(error),
        nextScanAt: new Date(Date.now() + 5 * 60 * 1000),
      })
      .where(eq(blueprintScanState.blueprintId, blueprintId));
    throw error;
  }
}

export async function runMarketScanner(
  options: { explicitBlueprintId?: number } = {},
) {
  const [run] = await getDb()
    .insert(scanRuns)
    .values({ kind: "market" })
    .returning();
  if (!run) throw new Error("Could not create market scan run");
  const blueprintIds = options.explicitBlueprintId
    ? [options.explicitBlueprintId]
    : await claimDueBlueprints();
  let successes = 0;
  let failures = 0;
  let watchCount = 0;
  let alertCount = 0;
  const client = new CardTraderClient();

  for (let index = 0; index < blueprintIds.length; index += 5) {
    const batch = blueprintIds.slice(index, index + 5);
    const outcomes = await Promise.allSettled(
      batch.map((id) => scanBlueprint(id, client)),
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
    if (index + 5 < blueprintIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
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
      details: { watches: watchCount, alerts: alertCount },
      error: failures > 0 ? `${failures} blueprint scans failed` : null,
    })
    .where(eq(scanRuns.id, run.id));

  await dispatchPendingNotifications();
  return {
    claimed: blueprintIds.length,
    successes,
    failures,
    watches: watchCount,
    alerts: alertCount,
  };
}

export async function pruneOperationalData() {
  const historyCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const tokenCutoff = new Date();
  await getDb()
    .delete(priceObservations)
    .where(lt(priceObservations.bucketAt, historyCutoff));
  const { telegramLinkTokens, notificationDeliveries } =
    await import("@/db/schema");
  await getDb()
    .delete(telegramLinkTokens)
    .where(
      or(
        lt(telegramLinkTokens.expiresAt, tokenCutoff),
        sql`${telegramLinkTokens.usedAt} is not null`,
      ),
    );
  await getDb()
    .delete(notificationDeliveries)
    .where(
      and(
        lt(notificationDeliveries.createdAt, historyCutoff),
        inArray(notificationDeliveries.status, ["sent", "failed"]),
      ),
    );
}

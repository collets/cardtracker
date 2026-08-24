import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  alertFeedback,
  alerts,
  blueprints,
  blueprintScanState,
  expansions,
  guestAccessLinks,
  notificationDeliveries,
  priceObservations,
  scanRuns,
  telegramChannels,
  telegramLinkTokens,
  thresholdRecommendations,
  userPreferences,
  users,
  watches,
  watchMetrics,
} from "@/db/schema";
import {
  archiveAlert,
  restoreAlertToInbox,
  saveAlertFeedback,
} from "@/lib/alerts/service";
import type { MarketListing } from "@/lib/cardtrader/types";
import {
  claimDueBlueprints,
  pruneOperationalData,
  runMarketScanner,
  scanBlueprint,
  scanUserWatchlist,
  WATCH_SCAN_INTERVAL_MS,
  WATCH_SCAN_LEASE_MS,
} from "@/lib/scanner/service";
import {
  createTelegramLink,
  dispatchPendingNotifications,
  dispatchScheduledScanDiagnostics,
  handleTelegramUpdate,
} from "@/lib/telegram/service";
import {
  createGuestAccessLink,
  redeemGuestAccessToken,
  revokeGuestAccessLink,
} from "@/lib/guests/service";
import {
  applyThresholdRecommendation,
  dismissThresholdRecommendation,
} from "@/lib/recommendations/service";
import { updateWatch } from "@/lib/watches/service";
import { watchInputSchema } from "@/lib/watches/validation";

const expansionId = 990_001;
const blueprintId = 990_001;
const expansionBlueprintIds = [990_001, 990_002, 990_003, 990_004, 990_005];
const userIds = [
  "00000000-0000-4000-8000-000000000901",
  "00000000-0000-4000-8000-000000000902",
] as const;
const watchIds = [
  "00000000-0000-4000-8000-000000000911",
  "00000000-0000-4000-8000-000000000912",
] as const;
const bulkWatchIds = [
  "00000000-0000-4000-8000-000000000913",
  "00000000-0000-4000-8000-000000000914",
  "00000000-0000-4000-8000-000000000915",
  "00000000-0000-4000-8000-000000000916",
] as const;

function listing(productId: number, priceCents: number): MarketListing {
  return {
    productId,
    blueprintId,
    name: "Integration Card",
    priceCents,
    currency: "EUR",
    quantity: 1,
    description: null,
    condition: "Near Mint",
    language: "en",
    foil: false,
    signed: false,
    altered: false,
    graded: false,
    onVacation: false,
    seller: {
      id: productId,
      username: `seller-${productId}`,
      countryCode: "IT",
      canSellViaHub: true,
      oneDayReady: true,
      cancellationRisk: false,
    },
  };
}

const qualifyingListings = [
  listing(9001, 1_000),
  listing(9002, 2_000),
  listing(9003, 2_100),
  listing(9004, 2_200),
  listing(9005, 2_300),
  listing(9006, 2_400),
];
const nonQualifyingListings = qualifyingListings.map((row, index) =>
  listing(row.productId + 100, 2_000 + index * 50),
);

function listingsForBlueprint(
  id: number,
  source: MarketListing[] = qualifyingListings,
): MarketListing[] {
  return source.map((row, index) => ({
    ...row,
    productId: id * 100 + index,
    blueprintId: id,
    seller: {
      ...row.seller,
      id: id * 100 + index,
      username: `seller-${id}-${index}`,
    },
  }));
}

async function cleanFixtures() {
  await getDb()
    .delete(users)
    .where(like(users.email, "guest-%@guest.riftwatch.test"));
  await getDb()
    .delete(guestAccessLinks)
    .where(inArray(guestAccessLinks.createdBy, [...userIds]));
  await getDb().delete(expansions).where(eq(expansions.id, expansionId));
  await getDb()
    .delete(users)
    .where(inArray(users.id, [...userIds]));
}

async function seedFixtures() {
  await getDb()
    .insert(users)
    .values(
      userIds.map((id, index) => ({
        id,
        email: `integration-${index}@riftwatch.test`,
        role: index === 0 ? ("admin" as const) : ("user" as const),
        emailVerified: new Date(),
      })),
    );
  await getDb()
    .insert(userPreferences)
    .values(
      userIds.map((userId) => ({
        userId,
        sellerCountries: ["IT"],
        languages: ["en"],
        conditions: ["Near Mint"],
      })),
    );
  await getDb().insert(expansions).values({
    id: expansionId,
    gameId: 22,
    code: "E2E",
    name: "Integration Expansion",
    syncedAt: new Date(),
  });
  await getDb().insert(blueprints).values({
    id: blueprintId,
    expansionId,
    gameId: 22,
    categoryId: 258,
    name: "Integration Card",
    rarity: "Rare",
    fixedProperties: {},
    editableProperties: [],
    syncedAt: new Date(),
  });
  await getDb()
    .insert(watches)
    .values(
      userIds.map((userId, index) => ({
        id: watchIds[index],
        userId,
        blueprintId,
        languages: ["en"],
        conditions: ["Near Mint"],
        sellerCountries: ["IT"],
      })),
    );
  await getDb()
    .insert(blueprintScanState)
    .values({
      blueprintId,
      nextScanAt: new Date(Date.now() - 60_000),
    });
  await getDb()
    .insert(telegramChannels)
    .values(
      userIds.map((userId, index) => ({
        userId,
        chatId: `integration-chat-${index}`,
        diagnosticsEnabled: true,
      })),
    );
}

beforeEach(async () => {
  await cleanFixtures();
  await seedFixtures();
});

afterAll(async () => {
  await cleanFixtures();
  await getSql().end();
});

describe("scanner persistence", () => {
  it("claims a due blueprint only once across overlapping workers", async () => {
    const before = new Date();
    const claims = await Promise.all([
      claimDueBlueprints(10, blueprintId),
      claimDueBlueprints(10, blueprintId),
    ]);

    expect(claims.flat().filter((id) => id === blueprintId)).toHaveLength(1);
    const [state] = await getDb()
      .select({ leaseUntil: blueprintScanState.leaseUntil })
      .from(blueprintScanState)
      .where(eq(blueprintScanState.blueprintId, blueprintId));
    if (!state?.leaseUntil) throw new Error("Blueprint lease was not claimed");
    expect(state.leaseUntil).toBeInstanceOf(Date);
    expect(state.leaseUntil.getTime()).toBeGreaterThanOrEqual(
      before.getTime() + WATCH_SCAN_LEASE_MS,
    );
  });

  it("keeps a successfully scanned blueprint off the due queue for five minutes", async () => {
    const before = new Date();
    let runId: string | undefined;
    try {
      await expect(claimDueBlueprints(1, blueprintId)).resolves.toEqual([
        blueprintId,
      ]);
      await expect(
        runMarketScanner({
          explicitBlueprintIds: [blueprintId],
          client: {
            marketplaceProducts: vi
              .fn()
              .mockResolvedValue(nonQualifyingListings),
            marketplaceProductsForExpansion: vi
              .fn()
              .mockResolvedValue(new Map()),
          },
          dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
        }),
      ).resolves.toMatchObject({ claimed: 1, successes: 1, failures: 0 });

      const [run] = await getDb()
        .select({ id: scanRuns.id })
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      runId = run?.id;
      const [state] = await getDb()
        .select()
        .from(blueprintScanState)
        .where(eq(blueprintScanState.blueprintId, blueprintId));
      expect(state?.lastScanAt).toBeInstanceOf(Date);
      expect(state?.nextScanAt).toBeInstanceOf(Date);
      expect(state?.leaseUntil).toBeNull();
      expect(state?.nextScanAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime() + WATCH_SCAN_INTERVAL_MS,
      );
      expect(await claimDueBlueprints(10, blueprintId)).toEqual([]);
    } finally {
      if (runId) {
        await getDb().delete(scanRuns).where(eq(scanRuns.id, runId));
      }
    }
  });

  it("fetches once per blueprint and creates idempotent evidence for every watch", async () => {
    const marketplaceProducts = vi.fn().mockResolvedValue(qualifyingListings);

    await expect(
      scanBlueprint(blueprintId, { marketplaceProducts }),
    ).resolves.toEqual({ watches: 2, alerts: 2 });
    await expect(
      scanBlueprint(blueprintId, { marketplaceProducts }),
    ).resolves.toEqual({ watches: 2, alerts: 0 });

    expect(marketplaceProducts).toHaveBeenCalledTimes(2);
    await expect(
      getDb()
        .select()
        .from(watchMetrics)
        .where(inArray(watchMetrics.watchId, [...watchIds])),
    ).resolves.toHaveLength(2);
    await expect(
      getDb()
        .select()
        .from(priceObservations)
        .where(inArray(priceObservations.watchId, [...watchIds])),
    ).resolves.toHaveLength(2);
    await expect(
      getDb()
        .select()
        .from(alerts)
        .where(inArray(alerts.watchId, [...watchIds])),
    ).resolves.toHaveLength(2);
    const fixtureAlerts = await getDb()
      .select({ id: alerts.id })
      .from(alerts)
      .where(inArray(alerts.watchId, [...watchIds]));
    await expect(
      getDb()
        .select()
        .from(notificationDeliveries)
        .where(
          inArray(
            notificationDeliveries.alertId,
            fixtureAlerts.map((alert) => alert.id),
          ),
        ),
    ).resolves.toHaveLength(2);
    const recommendations = await getDb()
      .select()
      .from(thresholdRecommendations)
      .where(inArray(thresholdRecommendations.watchId, [...watchIds]));
    expect(recommendations).toHaveLength(2);
    expect(recommendations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "pending",
          currentDiscountPercent: 20,
          currentMinSavingsCents: 500,
          proposedDiscountPercent: 20,
          proposedMinSavingsCents: 220,
          referencePriceCents: 2_200,
          eligibleCount: 6,
        }),
      ]),
    );
    await expect(
      getDb()
        .select()
        .from(notificationDeliveries)
        .where(
          inArray(
            notificationDeliveries.recommendationId,
            recommendations.map((recommendation) => recommendation.id),
          ),
        ),
    ).resolves.toHaveLength(2);
  });

  it("applies, dismisses, and invalidates threshold suggestions only for their owner", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const recommendations = await getDb()
      .select()
      .from(thresholdRecommendations)
      .where(inArray(thresholdRecommendations.watchId, [...watchIds]));
    const first = recommendations.find(
      (recommendation) => recommendation.watchId === watchIds[0],
    );
    const second = recommendations.find(
      (recommendation) => recommendation.watchId === watchIds[1],
    );
    if (!first || !second) throw new Error("Recommendation fixtures missing");

    await expect(
      applyThresholdRecommendation(userIds[1], first.id),
    ).rejects.toThrow("Threshold suggestion not found");
    await expect(
      applyThresholdRecommendation(userIds[0], first.id),
    ).resolves.toMatchObject({ id: watchIds[0] });
    await expect(
      getDb()
        .select({
          discountPercent: watches.discountPercent,
          minSavingsCents: watches.minSavingsCents,
        })
        .from(watches)
        .where(eq(watches.id, watchIds[0])),
    ).resolves.toEqual([{ discountPercent: 20, minSavingsCents: 220 }]);

    await expect(
      dismissThresholdRecommendation(userIds[0], second.id),
    ).rejects.toThrow("Threshold suggestion not found");
    await expect(
      dismissThresholdRecommendation(userIds[1], second.id),
    ).resolves.toBeUndefined();
    await expect(
      getDb()
        .select({ status: thresholdRecommendations.status })
        .from(thresholdRecommendations)
        .where(inArray(thresholdRecommendations.id, [first.id, second.id])),
    ).resolves.toEqual(
      expect.arrayContaining([{ status: "applied" }, { status: "dismissed" }]),
    );
  });

  it("resolves concurrent apply attempts exactly once", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const [recommendation] = await getDb()
      .select({ id: thresholdRecommendations.id })
      .from(thresholdRecommendations)
      .where(eq(thresholdRecommendations.watchId, watchIds[0]))
      .limit(1);
    if (!recommendation) throw new Error("Recommendation fixture missing");

    const results = await Promise.allSettled([
      applyThresholdRecommendation(userIds[0], recommendation.id),
      applyThresholdRecommendation(userIds[0], recommendation.id),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    await expect(
      getDb()
        .select({
          discountPercent: watches.discountPercent,
          minSavingsCents: watches.minSavingsCents,
        })
        .from(watches)
        .where(eq(watches.id, watchIds[0])),
    ).resolves.toEqual([{ discountPercent: 20, minSavingsCents: 220 }]);
  });

  it("marks a pending suggestion stale when its watch thresholds are edited", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const [recommendation] = await getDb()
      .select()
      .from(thresholdRecommendations)
      .where(eq(thresholdRecommendations.watchId, watchIds[0]))
      .limit(1);
    if (!recommendation) throw new Error("Recommendation fixture missing");

    await updateWatch(
      userIds[0],
      watchIds[0],
      watchInputSchema.parse({
        blueprintId,
        languages: ["en"],
        conditions: ["Near Mint"],
        sellerCountries: ["IT"],
        discountPercent: 25,
      }),
    );

    await expect(
      getDb()
        .select({ status: thresholdRecommendations.status })
        .from(thresholdRecommendations)
        .where(eq(thresholdRecommendations.id, recommendation.id)),
    ).resolves.toEqual([{ status: "stale" }]);
    await expect(
      applyThresholdRecommendation(userIds[0], recommendation.id),
    ).rejects.toThrow("Threshold suggestion not found");
  });

  it("does not create threshold suggestions for guest watches", async () => {
    await getDb()
      .update(users)
      .set({ kind: "guest" })
      .where(eq(users.id, userIds[1]));

    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });

    await expect(
      getDb()
        .select({ watchId: thresholdRecommendations.watchId })
        .from(thresholdRecommendations)
        .where(inArray(thresholdRecommendations.watchId, [...watchIds])),
    ).resolves.toEqual([{ watchId: watchIds[0] }]);
  });

  it("fetches five claimed blueprints through one expansion request", async () => {
    await getDb()
      .insert(blueprints)
      .values(
        expansionBlueprintIds.slice(1).map((id) => ({
          id,
          expansionId,
          gameId: 22,
          categoryId: 258,
          name: `Bulk card ${id}`,
          rarity: "Rare",
          fixedProperties: {},
          editableProperties: [],
          syncedAt: new Date(),
        })),
      );
    await getDb()
      .insert(watches)
      .values(
        expansionBlueprintIds.slice(1).map((id, index) => ({
          id: bulkWatchIds[index],
          userId: userIds[0],
          blueprintId: id,
          languages: ["en"],
          conditions: ["Near Mint"],
          sellerCountries: ["IT"],
        })),
      );
    await getDb()
      .insert(blueprintScanState)
      .values(
        expansionBlueprintIds.slice(1).map((id) => ({
          blueprintId: id,
          nextScanAt: new Date(Date.now() - 60_000),
          leaseUntil: new Date(Date.now() + 60_000),
        })),
      );
    const marketplaceProducts = vi.fn().mockResolvedValue([]);
    const marketplaceProductsForExpansion = vi
      .fn()
      .mockImplementation(
        async (_expansionId: number, requestedIds: readonly number[]) =>
          new Map(requestedIds.map((id) => [id, listingsForBlueprint(id)])),
      );
    const runIds: string[] = [];

    try {
      const result = await runMarketScanner({
        client: { marketplaceProducts, marketplaceProductsForExpansion },
        explicitBlueprintIds: expansionBlueprintIds,
        dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
      });
      const [run] = await getDb()
        .select()
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      if (run) runIds.push(run.id);

      expect(result).toEqual({
        claimed: 5,
        successes: 5,
        failures: 0,
        watches: 6,
        alerts: 6,
        marketplaceFetches: { expansions: 1, blueprints: 0 },
        notifications: { sent: 0, failed: 0 },
      });
      expect(marketplaceProductsForExpansion).toHaveBeenCalledOnce();
      expect(marketplaceProducts).not.toHaveBeenCalled();
      expect(run).toMatchObject({
        claimedCount: 5,
        successCount: 5,
        failureCount: 0,
        details: {
          watches: 6,
          alerts: 6,
          marketplaceFetches: { expansions: 1, blueprints: 0 },
        },
      });
      await expect(
        getDb()
          .select()
          .from(watchMetrics)
          .where(inArray(watchMetrics.watchId, [...watchIds, ...bulkWatchIds])),
      ).resolves.toHaveLength(6);
      const states = await getDb()
        .select()
        .from(blueprintScanState)
        .where(inArray(blueprintScanState.blueprintId, expansionBlueprintIds));
      expect(states).toHaveLength(5);
      expect(states.every((state) => state.lastScanAt instanceof Date)).toBe(
        true,
      );
      expect(states.every((state) => state.leaseUntil === null)).toBe(true);

      marketplaceProductsForExpansion.mockRejectedValueOnce(
        new Error("bulk unavailable"),
      );
      const failedResult = await runMarketScanner({
        client: { marketplaceProducts, marketplaceProductsForExpansion },
        explicitBlueprintIds: expansionBlueprintIds,
        dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
      });
      const [failedRun] = await getDb()
        .select()
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      if (failedRun) runIds.push(failedRun.id);
      expect(failedResult).toMatchObject({
        claimed: 5,
        successes: 0,
        failures: 5,
        marketplaceFetches: { expansions: 1, blueprints: 0 },
      });
      expect(failedRun).toMatchObject({
        status: "failed",
        claimedCount: 5,
        successCount: 0,
        failureCount: 5,
      });
      const failedStates = await getDb()
        .select()
        .from(blueprintScanState)
        .where(inArray(blueprintScanState.blueprintId, expansionBlueprintIds));
      expect(
        failedStates.every(
          (state) =>
            state.leaseUntil === null &&
            state.failureCount === 1 &&
            state.lastError === "bulk unavailable",
        ),
      ).toBe(true);
      expect(marketplaceProducts).not.toHaveBeenCalled();

      const invalidListing = {
        ...listingsForBlueprint(blueprintId)[0],
        productId: 1n,
      } as unknown as MarketListing;
      marketplaceProductsForExpansion.mockImplementationOnce(
        async (_expansionId: number, requestedIds: readonly number[]) =>
          new Map(
            requestedIds.map((id) => [
              id,
              id === blueprintId
                ? [invalidListing]
                : listingsForBlueprint(id, nonQualifyingListings),
            ]),
          ),
      );
      const partialResult = await runMarketScanner({
        client: { marketplaceProducts, marketplaceProductsForExpansion },
        explicitBlueprintIds: expansionBlueprintIds,
        dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
      });
      const [partialRun] = await getDb()
        .select()
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      if (partialRun) runIds.push(partialRun.id);
      expect(partialResult).toMatchObject({
        claimed: 5,
        successes: 4,
        failures: 1,
        watches: 4,
        marketplaceFetches: { expansions: 1, blueprints: 0 },
      });
      expect(partialRun).toMatchObject({
        status: "succeeded",
        claimedCount: 5,
        successCount: 4,
        failureCount: 1,
      });
      const partialStates = await getDb()
        .select()
        .from(blueprintScanState)
        .where(inArray(blueprintScanState.blueprintId, expansionBlueprintIds));
      expect(
        partialStates.find((state) => state.blueprintId === blueprintId),
      ).toMatchObject({ failureCount: 2, leaseUntil: null });
      expect(
        partialStates
          .filter((state) => state.blueprintId !== blueprintId)
          .every(
            (state) => state.failureCount === 0 && state.leaseUntil === null,
          ),
      ).toBe(true);
    } finally {
      if (runIds.length > 0) {
        await getDb().delete(scanRuns).where(inArray(scanRuns.id, runIds));
      }
    }
  });

  it("keeps an explicit scan on the blueprint endpoint", async () => {
    const marketplaceProducts = vi
      .fn()
      .mockResolvedValue(nonQualifyingListings);
    const marketplaceProductsForExpansion = vi
      .fn()
      .mockResolvedValue(new Map());
    let runId: string | undefined;

    try {
      const result = await runMarketScanner({
        explicitBlueprintId: blueprintId,
        client: { marketplaceProducts, marketplaceProductsForExpansion },
        dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
      });
      const [run] = await getDb()
        .select({ id: scanRuns.id })
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      runId = run?.id;

      expect(result.marketplaceFetches).toEqual({
        expansions: 0,
        blueprints: 1,
      });
      expect(marketplaceProducts).toHaveBeenCalledOnce();
      expect(marketplaceProductsForExpansion).not.toHaveBeenCalled();
    } finally {
      if (runId) {
        await getDb().delete(scanRuns).where(eq(scanRuns.id, runId));
      }
    }
  });

  it("builds a bulk request only from the authenticated user's watches", async () => {
    const otherBlueprintId = 990_010;
    const otherWatchId = "00000000-0000-4000-8000-000000000917";
    await getDb().insert(blueprints).values({
      id: otherBlueprintId,
      expansionId,
      gameId: 22,
      categoryId: 258,
      name: "Other user's card",
      rarity: "Rare",
      fixedProperties: {},
      editableProperties: [],
      syncedAt: new Date(),
    });
    await getDb()
      .insert(watches)
      .values({
        id: otherWatchId,
        userId: userIds[1],
        blueprintId: otherBlueprintId,
        languages: ["en"],
        conditions: ["Near Mint"],
        sellerCountries: ["IT"],
      });
    await getDb()
      .insert(blueprintScanState)
      .values({
        blueprintId: otherBlueprintId,
        nextScanAt: new Date(Date.now() - 60_000),
      });
    const marketplaceProducts = vi
      .fn()
      .mockResolvedValue(nonQualifyingListings);
    const marketplaceProductsForExpansion = vi
      .fn()
      .mockResolvedValue(new Map());
    let runId: string | undefined;

    try {
      const result = await scanUserWatchlist(userIds[0], {
        client: { marketplaceProducts, marketplaceProductsForExpansion },
        dispatchNotifications: async () => ({ sent: 0, failed: 0 }),
      });
      const [run] = await getDb()
        .select({ id: scanRuns.id })
        .from(scanRuns)
        .orderBy(desc(scanRuns.startedAt))
        .limit(1);
      runId = run?.id;

      expect(result).toMatchObject({
        claimed: 1,
        successes: 1,
        failures: 0,
        marketplaceFetches: { expansions: 0, blueprints: 1 },
      });
      expect(marketplaceProducts).toHaveBeenCalledOnce();
      expect(marketplaceProducts).toHaveBeenCalledWith(blueprintId);
      expect(marketplaceProducts).not.toHaveBeenCalledWith(otherBlueprintId);
      expect(marketplaceProductsForExpansion).not.toHaveBeenCalled();
    } finally {
      if (runId) {
        await getDb().delete(scanRuns).where(eq(scanRuns.id, runId));
      }
    }
  });

  it("expires an alert after two consecutive misses", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const misses = vi.fn().mockResolvedValue(nonQualifyingListings);

    await scanBlueprint(blueprintId, { marketplaceProducts: misses });
    let rows = await getDb()
      .select()
      .from(alerts)
      .where(and(eq(alerts.watchId, watchIds[0]), eq(alerts.state, "active")));
    expect(rows[0]?.missCount).toBe(1);

    await scanBlueprint(blueprintId, { marketplaceProducts: misses });
    rows = await getDb()
      .select()
      .from(alerts)
      .where(eq(alerts.watchId, watchIds[0]));
    expect(rows[0]).toMatchObject({ state: "expired", missCount: 2 });
    expect(rows[0]?.expiredAt).toBeInstanceOf(Date);
  });

  it("archives one alert without disabling its watch and creates a new event only for a meaningful change", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const [original] = await getDb()
      .select()
      .from(alerts)
      .where(eq(alerts.watchId, watchIds[0]))
      .limit(1);
    if (!original) throw new Error("Alert fixture was not created");

    await archiveAlert(userIds[0], original.id);
    await expect(
      getDb()
        .select({ active: watches.active })
        .from(watches)
        .where(eq(watches.id, watchIds[0])),
    ).resolves.toEqual([{ active: true }]);
    await expect(
      scanBlueprint(blueprintId, {
        marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
      }),
    ).resolves.toEqual({ watches: 2, alerts: 0 });

    const improvedListings = qualifyingListings.map((row, index) =>
      index === 0 ? { ...row, priceCents: 800 } : row,
    );
    await expect(
      scanBlueprint(blueprintId, {
        marketplaceProducts: vi.fn().mockResolvedValue(improvedListings),
      }),
    ).resolves.toEqual({ watches: 2, alerts: 2 });
    const history = await getDb()
      .select()
      .from(alerts)
      .where(eq(alerts.watchId, watchIds[0]));
    expect(history).toHaveLength(2);
    expect(history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: original.id, state: "dismissed" }),
        expect.objectContaining({
          state: "active",
          candidatePriceCents: 800,
          readAt: null,
        }),
      ]),
    );
  });

  it("restores an archived alert to Inbox only for its owner", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const [ownedAlert] = await getDb()
      .select({ id: alerts.id })
      .from(alerts)
      .where(eq(alerts.watchId, watchIds[0]))
      .limit(1);
    if (!ownedAlert) throw new Error("Alert fixture was not created");

    await archiveAlert(userIds[0], ownedAlert.id);
    await expect(
      restoreAlertToInbox(userIds[1], ownedAlert.id),
    ).rejects.toThrow("Archived alert not found");
    await restoreAlertToInbox(userIds[0], ownedAlert.id);
    await expect(
      getDb().select().from(alerts).where(eq(alerts.id, ownedAlert.id)),
    ).resolves.toEqual([
      expect.objectContaining({
        state: "active",
        archivedAt: null,
        readAt: null,
      }),
    ]);
  });

  it("creates a new event when a different listing materially beats the active deal", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const betterVendorListings = [
      {
        ...listing(9_999, 800),
        seller: {
          ...listing(9_999, 800).seller,
          username: "meaningfully-cheaper-seller",
        },
      },
      ...qualifyingListings.slice(1),
    ];

    await expect(
      scanBlueprint(blueprintId, {
        marketplaceProducts: vi.fn().mockResolvedValue(betterVendorListings),
      }),
    ).resolves.toEqual({ watches: 2, alerts: 2 });
    await expect(
      getDb()
        .select({ productId: alerts.productId })
        .from(alerts)
        .where(eq(alerts.watchId, watchIds[0])),
    ).resolves.toEqual(
      expect.arrayContaining([{ productId: 9001 }, { productId: 9_999 }]),
    );
  });

  it("records safe failures and releases the lease", async () => {
    await expect(
      scanBlueprint(blueprintId, {
        marketplaceProducts: vi
          .fn()
          .mockRejectedValue(new Error("safe failure")),
      }),
    ).rejects.toThrow("safe failure");

    const [state] = await getDb()
      .select()
      .from(blueprintScanState)
      .where(eq(blueprintScanState.blueprintId, blueprintId));
    expect(state).toMatchObject({
      leaseUntil: null,
      failureCount: 1,
      lastError: "safe failure",
    });
  });

  it("delivers queued Telegram notifications once and prunes old evidence", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const telegramFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    const fixtureAlerts = await getDb()
      .select({ id: alerts.id })
      .from(alerts)
      .where(inArray(alerts.watchId, [...watchIds]));
    const fixtureAlertIds = fixtureAlerts.map((alert) => alert.id);
    const fixtureDeliveries = await getDb()
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(inArray(notificationDeliveries.alertId, fixtureAlertIds));
    const deliveryIds = fixtureDeliveries.map((delivery) => delivery.id);

    await expect(
      dispatchPendingNotifications(telegramFetch, { deliveryIds }),
    ).resolves.toEqual({ sent: 2, failed: 0 });
    await expect(
      dispatchPendingNotifications(telegramFetch, { deliveryIds }),
    ).resolves.toEqual({ sent: 0, failed: 0 });
    expect(telegramFetch).toHaveBeenCalledTimes(2);
    for (const [, request] of telegramFetch.mock.calls) {
      const body = JSON.parse(String(request?.body)) as {
        reply_markup?: {
          inline_keyboard?: Array<Array<{ text: string; url: string }>>;
        };
      };
      expect(body.reply_markup?.inline_keyboard?.[0]?.[0]).toEqual({
        text: "Open CardTrader",
        url: `https://www.cardtrader.com/en/cards/${blueprintId}`,
      });
    }

    await getDb()
      .update(notificationDeliveries)
      .set({ createdAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000) })
      .where(inArray(notificationDeliveries.alertId, fixtureAlertIds));
    await getDb()
      .update(priceObservations)
      .set({ bucketAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1_000) })
      .where(inArray(priceObservations.watchId, [...watchIds]));
    await pruneOperationalData({
      watchIds: [...watchIds],
      notificationAlertIds: fixtureAlertIds,
      telegramTokenUserIds: [...userIds],
    });

    await expect(
      getDb()
        .select()
        .from(notificationDeliveries)
        .where(inArray(notificationDeliveries.alertId, fixtureAlertIds)),
    ).resolves.toHaveLength(0);
    await expect(
      getDb()
        .select()
        .from(priceObservations)
        .where(inArray(priceObservations.watchId, [...watchIds])),
    ).resolves.toHaveLength(0);
  });

  it("sends scheduled scan diagnostics to opted-in enabled linked users", async () => {
    const telegramFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(
      dispatchScheduledScanDiagnostics(
        {
          claimed: 0,
          successes: 0,
          failures: 0,
          watches: 0,
          alerts: 0,
          notifications: { sent: 0, failed: 0 },
        },
        telegramFetch,
      ),
    ).resolves.toEqual({ sent: 1, failed: 1 });
    expect(telegramFetch).toHaveBeenCalledTimes(2);
    const [, request] = telegramFetch.mock.calls[0] ?? [];
    const body = JSON.parse(String(request?.body)) as {
      chat_id?: string;
      text?: string;
    };
    expect(["integration-chat-0", "integration-chat-1"]).toContain(
      body.chat_id,
    );
    expect(body.text).toContain(
      "Riftwatch diagnostic · scheduled scan completed",
    );
    expect(body.text).toContain("Claimed 0");

    await getDb()
      .update(users)
      .set({ disabled: true })
      .where(eq(users.id, userIds[0]));
    await getDb()
      .update(telegramChannels)
      .set({ diagnosticsEnabled: false })
      .where(eq(telegramChannels.userId, userIds[1]));
    await expect(
      dispatchScheduledScanDiagnostics(
        {
          claimed: 1,
          successes: 1,
          failures: 0,
          watches: 2,
          alerts: 1,
          notifications: { sent: 1, failed: 0 },
        },
        telegramFetch,
      ),
    ).resolves.toEqual({ sent: 0, failed: 0 });
    expect(telegramFetch).toHaveBeenCalledTimes(2);
  });

  it("delivers a threshold recommendation with a scoped Riftwatch deep link", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const recommendations = await getDb()
      .select({ id: thresholdRecommendations.id })
      .from(thresholdRecommendations)
      .where(inArray(thresholdRecommendations.watchId, [...watchIds]));
    const deliveries = await getDb()
      .select({ id: notificationDeliveries.id })
      .from(notificationDeliveries)
      .where(
        inArray(
          notificationDeliveries.recommendationId,
          recommendations.map((recommendation) => recommendation.id),
        ),
      );
    const telegramFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await expect(
      dispatchPendingNotifications(telegramFetch, {
        deliveryIds: deliveries.map((delivery) => delivery.id),
      }),
    ).resolves.toEqual({ sent: 2, failed: 0 });
    expect(telegramFetch).toHaveBeenCalledTimes(2);
    for (const [, request] of telegramFetch.mock.calls) {
      const body = JSON.parse(String(request?.body)) as {
        text: string;
        reply_markup?: {
          inline_keyboard?: Array<Array<{ text: string; url: string }>>;
        };
      };
      expect(body.text).toContain("Riftwatch suggestion: Integration Card");
      const action = body.reply_markup?.inline_keyboard?.[0]?.[0];
      expect(action?.text).toBe("Review suggestion");
      expect(action?.url).toMatch(
        /^http:\/\/127\.0\.0\.1:3000\/watches\/[0-9a-f-]+\?recommendation=[0-9a-f-]+$/,
      );
    }
  });

  it("stores one editable feedback outcome only for the alert owner", async () => {
    await scanBlueprint(blueprintId, {
      marketplaceProducts: vi.fn().mockResolvedValue(qualifyingListings),
    });
    const [ownedAlert] = await getDb()
      .select({ id: alerts.id })
      .from(alerts)
      .where(eq(alerts.watchId, watchIds[0]))
      .limit(1);
    if (!ownedAlert) throw new Error("Feedback alert fixture was not created");

    await expect(
      saveAlertFeedback(userIds[0], ownedAlert.id, "purchased"),
    ).resolves.toBeUndefined();
    await expect(
      saveAlertFeedback(userIds[0], ownedAlert.id, "useful"),
    ).resolves.toBeUndefined();
    await expect(
      saveAlertFeedback(userIds[1], ownedAlert.id, "not_a_deal"),
    ).rejects.toThrow("Alert not found");

    await expect(
      getDb()
        .select({ outcome: alertFeedback.outcome })
        .from(alertFeedback)
        .where(eq(alertFeedback.alertId, ownedAlert.id)),
    ).resolves.toEqual([{ outcome: "useful" }]);
    const [updatedAlert] = await getDb()
      .select({ readAt: alerts.readAt })
      .from(alerts)
      .where(eq(alerts.id, ownedAlert.id));
    expect(updatedAlert?.readAt).toBeInstanceOf(Date);
  });

  it("atomically consumes a Telegram link token under concurrent replay", async () => {
    const linkUrl = await createTelegramLink(userIds[0]);
    const token = new URL(linkUrl).searchParams.get("start");
    if (!token) throw new Error("Telegram link did not contain a token");
    const telegramFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 200 }));

    const results = await Promise.all([
      handleTelegramUpdate(
        {
          message: {
            text: `/start ${token}`,
            chat: { id: "integration-replay-a", username: "first" },
          },
        },
        telegramFetch,
      ),
      handleTelegramUpdate(
        {
          message: {
            text: `/start ${token}`,
            chat: { id: "integration-replay-b", username: "second" },
          },
        },
        telegramFetch,
      ),
    ]);

    expect(results.filter((result) => result.handled)).toHaveLength(1);
    expect(telegramFetch).toHaveBeenCalledOnce();
    const [storedToken] = await getDb()
      .select({ usedAt: telegramLinkTokens.usedAt })
      .from(telegramLinkTokens)
      .where(eq(telegramLinkTokens.userId, userIds[0]))
      .limit(1);
    expect(storedToken?.usedAt).toBeInstanceOf(Date);
    const [channel] = await getDb()
      .select({ chatId: telegramChannels.chatId })
      .from(telegramChannels)
      .where(eq(telegramChannels.userId, userIds[0]));
    expect(["integration-replay-a", "integration-replay-b"]).toContain(
      channel?.chatId,
    );
  });

  it("redeems a guest link only up to its configured visitor limit", async () => {
    const link = await createGuestAccessLink(userIds[0], 1);
    const token = new URL(link.url).hash.slice(1);
    expect(token).toHaveLength(43);

    const guests = await Promise.all([
      redeemGuestAccessToken(token),
      redeemGuestAccessToken(token),
    ]);
    const createdGuests = guests.filter(
      (guest): guest is NonNullable<typeof guest> => guest !== null,
    );
    expect(createdGuests).toHaveLength(1);
    expect(createdGuests[0]).toMatchObject({
      kind: "guest",
      watchQuota: 2,
    });

    const [storedLink] = await getDb()
      .select({ usedCount: guestAccessLinks.usedCount })
      .from(guestAccessLinks)
      .where(eq(guestAccessLinks.createdBy, userIds[0]))
      .orderBy(desc(guestAccessLinks.createdAt))
      .limit(1);
    expect(storedLink).toEqual({ usedCount: 1 });
  });

  it("refuses malformed and revoked guest capabilities without creating users", async () => {
    await expect(redeemGuestAccessToken("not-a-token")).resolves.toBeNull();

    const link = await createGuestAccessLink(userIds[0], 1);
    const token = new URL(link.url).hash.slice(1);
    const [stored] = await getDb()
      .select({ id: guestAccessLinks.id })
      .from(guestAccessLinks)
      .where(eq(guestAccessLinks.createdBy, userIds[0]))
      .orderBy(desc(guestAccessLinks.createdAt))
      .limit(1);
    if (!stored) throw new Error("Guest link fixture was not created");

    await expect(revokeGuestAccessLink(stored.id)).resolves.toMatchObject({
      id: stored.id,
    });
    await expect(redeemGuestAccessToken(token)).resolves.toBeNull();
  });
});

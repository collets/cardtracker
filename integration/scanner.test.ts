import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  alerts,
  blueprints,
  blueprintScanState,
  expansions,
  notificationDeliveries,
  priceObservations,
  scanRuns,
  telegramChannels,
  userPreferences,
  users,
  watches,
  watchMetrics,
} from "@/db/schema";
import type { MarketListing } from "@/lib/cardtrader/types";
import {
  claimDueBlueprints,
  pruneOperationalData,
  runMarketScanner,
  scanBlueprint,
  scanUserWatchlist,
} from "@/lib/scanner/service";
import { dispatchPendingNotifications } from "@/lib/telegram/service";

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
    const claims = await Promise.all([
      claimDueBlueprints(10, blueprintId),
      claimDueBlueprints(10, blueprintId),
    ]);

    expect(claims.flat().filter((id) => id === blueprintId)).toHaveLength(1);
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
});

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  alerts,
  blueprints,
  blueprintScanState,
  expansions,
  notificationDeliveries,
  priceObservations,
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
} from "@/lib/scanner/service";
import { dispatchPendingNotifications } from "@/lib/telegram/service";

const expansionId = 990_001;
const blueprintId = 990_001;
const userIds = [
  "00000000-0000-4000-8000-000000000901",
  "00000000-0000-4000-8000-000000000902",
] as const;
const watchIds = [
  "00000000-0000-4000-8000-000000000911",
  "00000000-0000-4000-8000-000000000912",
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

  it("deduplicates overlapping explicit scans through the normal lease", async () => {
    const marketplaceProducts = vi.fn().mockResolvedValue(qualifyingListings);
    const dispatchNotifications = vi
      .fn()
      .mockResolvedValue({ sent: 0, failed: 0 });
    const results = await Promise.all([
      runMarketScanner({
        explicitBlueprintId: blueprintId,
        client: { marketplaceProducts },
        dispatchNotifications,
      }),
      runMarketScanner({
        explicitBlueprintId: blueprintId,
        client: { marketplaceProducts },
        dispatchNotifications,
      }),
    ]);

    expect(results.reduce((sum, result) => sum + result.claimed, 0)).toBe(1);
    expect(marketplaceProducts).toHaveBeenCalledTimes(1);
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

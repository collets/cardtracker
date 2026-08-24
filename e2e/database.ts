import { and, eq, inArray, like } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  alerts,
  blueprints,
  expansions,
  invitations,
  scanRuns,
  telegramChannels,
  thresholdRecommendations,
  userPreferences,
  users,
  watches,
} from "@/db/schema";
import type { MarketListing } from "@/lib/cardtrader/types";

export const e2eAdminEmail = "e2e-admin@riftwatch.test";
export const e2eUserEmail = "e2e-user@riftwatch.test";
const e2eUserIds = [
  "00000000-0000-4000-8000-000000000801",
  "00000000-0000-4000-8000-000000000802",
] as const;
const e2eExpansionId = 980_001;
export const e2eWatchBlueprintId = 980_001;
export const e2eAlertBlueprintId = 980_002;
export const e2ePendingInviteEmail = "e2e-pending@riftwatch.test";
export const e2eAcceptedInviteEmail = "e2e-accepted@riftwatch.test";
const e2eAlertWatchId = "00000000-0000-4000-8000-000000000811";
const e2eAlertId = "00000000-0000-4000-8000-000000000821";
export const e2eThresholdRecommendationId =
  "00000000-0000-4000-8000-000000000822";
const e2eInvitationIds = [
  "00000000-0000-4000-8000-000000000831",
  "00000000-0000-4000-8000-000000000832",
] as const;
const e2eRunIds = [
  ...Array.from(
    { length: 27 },
    (_, index) =>
      `00000000-0000-4000-8000-${String(841 + index).padStart(12, "0")}`,
  ),
  "00000000-0000-4000-8000-000000000871",
  "00000000-0000-4000-8000-000000000872",
] as const;

function databaseUrl() {
  const url =
    process.env.DATABASE_URL ??
    "postgresql://riftwatch:riftwatch@127.0.0.1:5432/riftwatch";
  const hostname = new URL(url).hostname;
  if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname)) {
    throw new Error("Playwright fixtures refuse non-local DATABASE_URL values");
  }
  return url;
}

async function withDatabase<T>(
  callback: (db: ReturnType<typeof drizzle>) => Promise<T>,
) {
  const sql = postgres(databaseUrl(), { max: 1, prepare: false });
  try {
    return await callback(drizzle(sql));
  } finally {
    await sql.end();
  }
}

export async function cleanE2eFixtures() {
  await withDatabase(async (db) => {
    await db
      .delete(invitations)
      .where(inArray(invitations.id, [...e2eInvitationIds]));
    await db.delete(scanRuns).where(inArray(scanRuns.id, [...e2eRunIds]));
    await db
      .delete(users)
      .where(like(users.email, "guest-%@guest.riftwatch.test"));
    await db.delete(expansions).where(eq(expansions.id, e2eExpansionId));
    await db.delete(users).where(inArray(users.id, [...e2eUserIds]));
  });
}

/**
 * Playwright retries rerun the test body without rerunning global setup. Keep
 * the admin watch scenario idempotent so a failed attempt cannot affect its
 * retry.
 */
export async function cleanE2eAdminWatch() {
  await withDatabase(async (db) => {
    await db
      .delete(watches)
      .where(
        and(
          eq(watches.userId, e2eUserIds[0]),
          eq(watches.blueprintId, e2eWatchBlueprintId),
        ),
      );
  });
}

/** Restore the recommendation scenario because Playwright retries do not rerun
 * global setup. */
export async function resetE2eThresholdRecommendation() {
  await withDatabase(async (db) => {
    await db
      .update(watches)
      .set({
        discountPercent: 20,
        minSavingsCents: 500,
        updatedAt: new Date(),
      })
      .where(eq(watches.id, e2eAlertWatchId));
    await db
      .update(thresholdRecommendations)
      .set({ status: "pending", resolvedAt: null })
      .where(eq(thresholdRecommendations.id, e2eThresholdRecommendationId));
  });
}

export async function seedE2eFixtures() {
  await cleanE2eFixtures();
  await withDatabase(async (db) => {
    await db.insert(users).values([
      {
        id: e2eUserIds[0],
        email: e2eAdminEmail,
        emailVerified: new Date(),
        role: "admin",
      },
      {
        id: e2eUserIds[1],
        email: e2eUserEmail,
        emailVerified: new Date(),
        role: "user",
      },
    ]);
    await db.insert(userPreferences).values(
      e2eUserIds.map((userId) => ({
        userId,
        sellerCountries: ["IT"],
        languages: ["en"],
        conditions: ["Mint", "Near Mint"],
      })),
    );
    await db.insert(telegramChannels).values([
      {
        userId: e2eUserIds[0],
        chatId: "e2e-admin-diagnostics",
      },
      {
        userId: e2eUserIds[1],
        chatId: "e2e-user-diagnostics",
      },
    ]);
    await db.insert(invitations).values([
      {
        id: e2eInvitationIds[0],
        email: e2ePendingInviteEmail,
        role: "user",
        invitedBy: e2eUserIds[0],
      },
      {
        id: e2eInvitationIds[1],
        email: e2eAcceptedInviteEmail,
        role: "user",
        invitedBy: e2eUserIds[0],
        acceptedAt: new Date(),
      },
    ]);
    await db.insert(scanRuns).values([
      ...e2eRunIds.slice(0, 27).map((id, index) => ({
        id,
        kind: "market" as const,
        status: "succeeded" as const,
        startedAt: new Date(Date.UTC(2097, 7, 13, 12, index)),
      })),
      {
        id: e2eRunIds[27],
        kind: "catalog",
        status: "succeeded",
        startedAt: new Date("2097-08-12T12:00:00.000Z"),
      },
      {
        id: e2eRunIds[28],
        kind: "cleanup",
        status: "failed",
        startedAt: new Date("2097-08-11T12:00:00.000Z"),
      },
    ]);
    await db.insert(expansions).values({
      id: e2eExpansionId,
      gameId: 22,
      code: "E2E",
      name: "E2E Expansion",
      syncedAt: new Date(),
    });
    await db.insert(blueprints).values([
      {
        id: e2eWatchBlueprintId,
        expansionId: e2eExpansionId,
        gameId: 22,
        categoryId: 258,
        name: "E2E Watch Card",
        version: "Standard",
        collectorNumber: "E2E-001",
        rarity: "Rare",
        fixedProperties: {},
        editableProperties: [
          { name: "riftbound_language", possible_values: ["en", "fr"] },
          { name: "riftbound_foil", possible_values: [false, true] },
        ],
        syncedAt: new Date(),
      },
      {
        id: e2eAlertBlueprintId,
        expansionId: e2eExpansionId,
        gameId: 22,
        categoryId: 258,
        name: "E2E Alert Card",
        version: "Alternate Art",
        collectorNumber: "E2E-002",
        rarity: "Epic",
        fixedProperties: {},
        editableProperties: [
          { name: "riftbound_language", possible_values: ["en"] },
          { name: "riftbound_foil", possible_values: [true] },
        ],
        syncedAt: new Date(),
      },
    ]);
    await db.insert(watches).values({
      id: e2eAlertWatchId,
      userId: e2eUserIds[1],
      blueprintId: e2eAlertBlueprintId,
      languages: ["en"],
      conditions: ["Near Mint"],
      sellerCountries: ["IT"],
    });
    const candidate: MarketListing = {
      productId: 980_021,
      blueprintId: e2eAlertBlueprintId,
      name: "E2E Alert Card",
      priceCents: 1_000,
      currency: "EUR",
      quantity: 1,
      description: null,
      condition: "Near Mint",
      language: "en",
      foil: true,
      signed: false,
      altered: false,
      graded: false,
      onVacation: false,
      seller: {
        id: 980_031,
        username: "e2e-seller",
        countryCode: "IT",
        canSellViaHub: true,
        oneDayReady: true,
        cancellationRisk: false,
      },
    };
    await db.insert(alerts).values({
      id: e2eAlertId,
      watchId: e2eAlertWatchId,
      productId: candidate.productId,
      candidate,
      candidatePriceCents: 1_000,
      referencePriceCents: 2_000,
      discountBps: 5_000,
      confidence: "medium",
    });
    await db.insert(thresholdRecommendations).values({
      id: e2eThresholdRecommendationId,
      watchId: e2eAlertWatchId,
      currentDiscountPercent: 20,
      currentMinSavingsCents: 500,
      proposedDiscountPercent: 20,
      proposedMinSavingsCents: 200,
      referencePriceCents: 2_000,
      eligibleCount: 6,
    });
  });
}

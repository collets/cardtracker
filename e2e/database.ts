import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  alerts,
  blueprints,
  expansions,
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
const e2eAlertBlueprintId = 980_002;
const e2eAlertWatchId = "00000000-0000-4000-8000-000000000811";
const e2eAlertId = "00000000-0000-4000-8000-000000000821";

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
    await db.delete(expansions).where(eq(expansions.id, e2eExpansionId));
    await db.delete(users).where(inArray(users.id, [...e2eUserIds]));
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
  });
}

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  blueprints,
  blueprintScanState,
  expansions,
  users,
  watches,
} from "@/db/schema";
import { createWatches, updateWatch } from "@/lib/watches/service";
import { watchInputSchema } from "@/lib/watches/validation";

const expansionId = 991_001;
const blueprintIds = [991_001, 991_002] as const;
const userId = "00000000-0000-4000-8000-000000000951";

async function cleanFixtures() {
  await getDb().delete(expansions).where(eq(expansions.id, expansionId));
  await getDb().delete(users).where(eq(users.id, userId));
}

async function seedFixtures(watchQuota = 2) {
  await getDb().insert(users).values({
    id: userId,
    email: "watch-integration@riftwatch.test",
    emailVerified: new Date(),
    watchQuota,
  });
  await getDb().insert(expansions).values({
    id: expansionId,
    gameId: 22,
    code: "WIT",
    name: "Watch Integration Expansion",
    syncedAt: new Date(),
  });
  await getDb()
    .insert(blueprints)
    .values(
      blueprintIds.map((id) => ({
        id,
        expansionId,
        gameId: 22,
        categoryId: 258,
        name: `Watch Integration Card ${id}`,
        fixedProperties: {},
        editableProperties: [],
        syncedAt: new Date(),
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

describe("bulk watch persistence", () => {
  it("creates every watch and schedules each distinct blueprint atomically", async () => {
    const inputs = blueprintIds.map((blueprintId) =>
      watchInputSchema.parse({ blueprintId }),
    );

    await expect(createWatches(userId, inputs)).resolves.toHaveLength(2);
    await expect(
      getDb().select().from(watches).where(eq(watches.userId, userId)),
    ).resolves.toHaveLength(2);
    await expect(
      getDb()
        .select()
        .from(blueprintScanState)
        .where(inArray(blueprintScanState.blueprintId, [...blueprintIds])),
    ).resolves.toHaveLength(2);
  });

  it("rolls the whole selection back when it exceeds the user quota", async () => {
    await cleanFixtures();
    await seedFixtures(1);
    const inputs = blueprintIds.map((blueprintId) =>
      watchInputSchema.parse({ blueprintId }),
    );

    await expect(createWatches(userId, inputs)).rejects.toThrow(
      "Watch quota exceeded",
    );
    await expect(
      getDb().select().from(watches).where(eq(watches.userId, userId)),
    ).resolves.toHaveLength(0);
    await expect(
      getDb()
        .select()
        .from(blueprintScanState)
        .where(inArray(blueprintScanState.blueprintId, [...blueprintIds])),
    ).resolves.toHaveLength(0);
  });

  it("rejects a watch that the same user already owns", async () => {
    const input = watchInputSchema.parse({ blueprintId: blueprintIds[0] });
    await createWatches(userId, [input]);

    await expect(createWatches(userId, [input])).rejects.toThrow(
      "already in your watchlist",
    );
    await expect(
      getDb().select().from(watches).where(eq(watches.userId, userId)),
    ).resolves.toHaveLength(1);
  });

  it("rolls back a mixed selection containing an existing watch", async () => {
    const inputs = blueprintIds.map((blueprintId) =>
      watchInputSchema.parse({ blueprintId }),
    );
    await createWatches(userId, [inputs[0]!]);

    await expect(createWatches(userId, inputs)).rejects.toThrow(
      "selected cards are already in your watchlist",
    );
    await expect(
      getDb().select().from(watches).where(eq(watches.userId, userId)),
    ).resolves.toHaveLength(1);
  });

  it("updates filters without allowing the watched blueprint to change", async () => {
    const [created] = await createWatches(userId, [
      watchInputSchema.parse({ blueprintId: blueprintIds[0] }),
    ]);
    if (!created) throw new Error("Watch fixture was not created");

    const updated = await updateWatch(
      userId,
      created.id,
      watchInputSchema.parse({
        blueprintId: blueprintIds[1],
        discountPercent: 25,
      }),
    );

    expect(updated).toMatchObject({
      blueprintId: blueprintIds[0],
      discountPercent: 25,
    });
  });
});

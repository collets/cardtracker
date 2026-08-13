import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import { blueprints, expansions, scanRuns } from "@/db/schema";
import { synchronizeCatalog } from "@/lib/catalog/service";

const expansionId = 992_001;
const blueprintId = 992_001;
let originalExpansionActivity = new Map<number, boolean>();

async function cleanFixtures() {
  await getDb().delete(expansions).where(eq(expansions.id, expansionId));
}

beforeEach(async () => {
  await cleanFixtures();
  const expansionsBeforeTest = await getDb()
    .select({ id: expansions.id, active: expansions.active })
    .from(expansions)
    .where(eq(expansions.gameId, 22));
  originalExpansionActivity = new Map(
    expansionsBeforeTest.map((expansion) => [expansion.id, expansion.active]),
  );
});

afterEach(async () => {
  await cleanFixtures();
  for (const [id, active] of originalExpansionActivity) {
    await getDb()
      .update(expansions)
      .set({ active })
      .where(eq(expansions.id, id));
  }
});

afterAll(async () => {
  await cleanFixtures();
  await getSql().end();
});

describe("catalog synchronization", () => {
  it("stores Riftbound Singles only and marks the run with safe summary details", async () => {
    const result = await synchronizeCatalog({
      expansions: async () => [
        { id: expansionId, game_id: 22, code: "TST", name: "Test expansion" },
        { id: 992_002, game_id: 99, code: "OTHER", name: "Other game" },
      ],
      blueprints: async () => [
        {
          id: blueprintId,
          expansion_id: expansionId,
          game_id: 22,
          category_id: 258,
          name: "Catalog integration card",
          version: "Alternate Art",
          image_url: "https://images.example.test/card.jpg",
          fixed_properties: {
            collector_number: "007",
            riftbound_rarity: "Epic",
          },
          editable_properties: [{ name: "riftbound_language" }],
        },
        {
          id: blueprintId + 1,
          expansion_id: expansionId,
          game_id: 22,
          category_id: 999,
          name: "Excluded category",
          fixed_properties: {},
          editable_properties: [],
        },
      ],
    } as never);

    expect(result).toEqual({ expansions: 1, blueprints: 1 });
    await expect(
      getDb().select().from(expansions).where(eq(expansions.id, expansionId)),
    ).resolves.toEqual([
      expect.objectContaining({
        code: "TST",
        name: "Test expansion",
        active: true,
      }),
    ]);
    await expect(
      getDb().select().from(blueprints).where(eq(blueprints.id, blueprintId)),
    ).resolves.toEqual([
      expect.objectContaining({
        name: "Catalog integration card",
        version: "Alternate Art",
        collectorNumber: "007",
        rarity: "Epic",
        imageUrl: "https://images.example.test/card.jpg",
      }),
    ]);
    await expect(
      getDb()
        .select({ id: blueprints.id })
        .from(blueprints)
        .where(eq(blueprints.id, blueprintId + 1)),
    ).resolves.toEqual([]);
    const [run] = await getDb()
      .select()
      .from(scanRuns)
      .orderBy(desc(scanRuns.startedAt))
      .limit(1);
    expect(run).toMatchObject({
      kind: "catalog",
      status: "succeeded",
      successCount: 1,
      details: { expansions: 1, blueprints: 1 },
      error: null,
    });
  });

  it("records a bounded failed run before passing catalog errors to its caller", async () => {
    await expect(
      synchronizeCatalog({
        expansions: async () => {
          throw new Error("upstream catalog timeout");
        },
      } as never),
    ).rejects.toThrow("upstream catalog timeout");

    const [run] = await getDb()
      .select()
      .from(scanRuns)
      .orderBy(desc(scanRuns.startedAt))
      .limit(1);
    expect(run).toMatchObject({
      kind: "catalog",
      status: "failed",
      failureCount: 1,
      error: "upstream catalog timeout",
    });
  });
});

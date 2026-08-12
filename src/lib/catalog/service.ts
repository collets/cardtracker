import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprints, expansions, scanRuns } from "@/db/schema";
import { CardTraderClient } from "@/lib/cardtrader/client";
import {
  RIFTBOUND_GAME_ID,
  RIFTBOUND_SINGLES_CATEGORY_ID,
} from "@/lib/constants";
import { boundedErrorMessage } from "@/lib/errors";

export async function synchronizeCatalog(client = new CardTraderClient()) {
  const [run] = await getDb()
    .insert(scanRuns)
    .values({ kind: "catalog" })
    .returning();
  if (!run) throw new Error("Could not create catalog run");

  try {
    const remoteExpansions = (await client.expansions()).filter(
      (expansion) => expansion.game_id === RIFTBOUND_GAME_ID,
    );
    const now = new Date();
    let blueprintCount = 0;

    await getDb()
      .update(expansions)
      .set({ active: false })
      .where(eq(expansions.gameId, RIFTBOUND_GAME_ID));
    for (const expansion of remoteExpansions) {
      await getDb()
        .insert(expansions)
        .values({
          id: expansion.id,
          gameId: expansion.game_id,
          code: expansion.code,
          name: expansion.name,
          active: true,
          syncedAt: now,
        })
        .onConflictDoUpdate({
          target: expansions.id,
          set: {
            code: expansion.code,
            name: expansion.name,
            active: true,
            syncedAt: now,
          },
        });

      const remoteBlueprints = (await client.blueprints(expansion.id)).filter(
        (blueprint) => blueprint.category_id === RIFTBOUND_SINGLES_CATEGORY_ID,
      );
      blueprintCount += remoteBlueprints.length;
      for (const blueprint of remoteBlueprints) {
        const fixed = blueprint.fixed_properties;
        const collectorNumber =
          typeof fixed.collector_number === "string"
            ? fixed.collector_number
            : null;
        const rarity =
          typeof fixed.riftbound_rarity === "string"
            ? fixed.riftbound_rarity
            : null;
        const values = {
          id: blueprint.id,
          expansionId: blueprint.expansion_id,
          gameId: blueprint.game_id,
          categoryId: blueprint.category_id,
          name: blueprint.name,
          version: blueprint.version ?? null,
          collectorNumber,
          rarity,
          imageUrl: blueprint.image_url ?? null,
          fixedProperties: fixed,
          editableProperties: blueprint.editable_properties,
          active: true,
          syncedAt: now,
        };
        await getDb()
          .insert(blueprints)
          .values(values)
          .onConflictDoUpdate({
            target: blueprints.id,
            set: {
              expansionId: values.expansionId,
              name: values.name,
              version: values.version,
              collectorNumber: values.collectorNumber,
              rarity: values.rarity,
              imageUrl: values.imageUrl,
              fixedProperties: values.fixedProperties,
              editableProperties: values.editableProperties,
              active: values.active,
              syncedAt: values.syncedAt,
            },
          });
      }
    }

    await getDb()
      .update(scanRuns)
      .set({
        status: "succeeded",
        completedAt: new Date(),
        successCount: blueprintCount,
        details: {
          expansions: remoteExpansions.length,
          blueprints: blueprintCount,
        },
      })
      .where(eq(scanRuns.id, run.id));
    return { expansions: remoteExpansions.length, blueprints: blueprintCount };
  } catch (error) {
    await getDb()
      .update(scanRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureCount: 1,
        error: boundedErrorMessage(error, "Unknown catalog error"),
      })
      .where(eq(scanRuns.id, run.id));
    throw error;
  }
}

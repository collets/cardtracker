import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprints, expansions, scanRuns } from "@/db/schema";
import { CardTraderClient } from "@/lib/cardtrader/client";
import {
  RIFTBOUND_GAME_ID,
  RIFTBOUND_SINGLES_CATEGORY_ID,
} from "@/lib/constants";
import {
  claimJobLease,
  completeJobLease,
  releaseJobLease,
} from "@/lib/security/job-lease";

export async function synchronizeCatalog(client = new CardTraderClient()) {
  const leaseClaimed = await claimJobLease("catalog");
  if (!leaseClaimed) {
    return {
      status: "skipped" as const,
      reason: "busy_or_recent" as const,
      expansions: 0,
      blueprints: 0,
    };
  }
  let runId: string | undefined;
  try {
    const [run] = await getDb()
      .insert(scanRuns)
      .values({ kind: "catalog" })
      .returning({ id: scanRuns.id });
    if (!run) throw new Error("Could not create catalog run");
    runId = run.id;
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
        await getDb()
          .insert(blueprints)
          .values({
            id: blueprint.id,
            expansionId: blueprint.expansion_id,
            gameId: blueprint.game_id,
            categoryId: blueprint.category_id,
            name: blueprint.name,
            version: blueprint.version ?? null,
            collectorNumber:
              typeof fixed.collector_number === "string"
                ? fixed.collector_number
                : null,
            rarity:
              typeof fixed.riftbound_rarity === "string"
                ? fixed.riftbound_rarity
                : null,
            imageUrl: blueprint.image_url ?? null,
            fixedProperties: fixed,
            editableProperties: blueprint.editable_properties,
            active: true,
            syncedAt: now,
          })
          .onConflictDoUpdate({
            target: blueprints.id,
            set: {
              expansionId: blueprint.expansion_id,
              name: blueprint.name,
              version: blueprint.version ?? null,
              collectorNumber:
                typeof fixed.collector_number === "string"
                  ? fixed.collector_number
                  : null,
              rarity:
                typeof fixed.riftbound_rarity === "string"
                  ? fixed.riftbound_rarity
                  : null,
              imageUrl: blueprint.image_url ?? null,
              fixedProperties: fixed,
              editableProperties: blueprint.editable_properties,
              active: true,
              syncedAt: now,
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
    await completeJobLease("catalog");
    return {
      status: "succeeded" as const,
      expansions: remoteExpansions.length,
      blueprints: blueprintCount,
    };
  } catch (error) {
    if (runId) {
      await getDb()
        .update(scanRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
          failureCount: 1,
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Unknown catalog error",
        })
        .where(eq(scanRuns.id, runId));
    }
    await releaseJobLease("catalog");
    throw error;
  }
}

import "server-only";
import { and, count, countDistinct, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprints, blueprintScanState, users, watches } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import type { z } from "zod";
import type { watchInputSchema } from "@/lib/watches/validation";

type WatchInput = z.infer<typeof watchInputSchema>;

export async function createWatch(userId: string, input: WatchInput) {
  const [watch] = await createWatches(userId, [input]);
  return watch;
}

export async function createWatches(userId: string, inputs: WatchInput[]) {
  if (inputs.length === 0) {
    throw new UserFacingError("Select at least one card");
  }

  const blueprintIds = [...new Set(inputs.map((input) => input.blueprintId))];
  if (blueprintIds.length !== inputs.length) {
    throw new UserFacingError("The card selection contains duplicates");
  }

  return getDb().transaction(async (tx) => {
    // All watch creation paths take these locks in the same order. This keeps
    // the per-user quota and global blueprint capacity checks atomic.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('riftwatch:watch-capacity'))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`riftwatch:watch-user:${userId}`}))`,
    );

    const [user, blueprintRows, current, uniqueBlueprints, alreadyWatched] =
      await Promise.all([
        tx
          .select({ quota: users.watchQuota })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
        tx
          .select({ id: blueprints.id })
          .from(blueprints)
          .where(
            and(
              inArray(blueprints.id, blueprintIds),
              eq(blueprints.active, true),
            ),
          ),
        tx
          .select({ value: count() })
          .from(watches)
          .where(and(eq(watches.userId, userId), eq(watches.active, true))),
        tx
          .select({ value: countDistinct(watches.blueprintId) })
          .from(watches)
          .where(eq(watches.active, true)),
        tx
          .select({ blueprintId: watches.blueprintId })
          .from(watches)
          .where(
            and(
              inArray(watches.blueprintId, blueprintIds),
              eq(watches.active, true),
            ),
          )
          .groupBy(watches.blueprintId),
      ]);

    const quota = user[0]?.quota ?? getServerEnv().DEFAULT_WATCH_QUOTA;
    if (blueprintRows.length !== blueprintIds.length) {
      throw new UserFacingError(
        "One or more selected Riftbound cards are no longer available",
      );
    }
    if ((current[0]?.value ?? 0) + inputs.length > quota) {
      const remaining = Math.max(0, quota - (current[0]?.value ?? 0));
      throw new UserFacingError(
        `Watch quota exceeded: ${remaining} slot${remaining === 1 ? "" : "s"} remaining`,
      );
    }

    const watchedBlueprintIds = new Set(
      alreadyWatched.map((watch) => watch.blueprintId),
    );
    const newBlueprintCount = blueprintIds.filter(
      (blueprintId) => !watchedBlueprintIds.has(blueprintId),
    ).length;
    if (
      (uniqueBlueprints[0]?.value ?? 0) + newBlueprintCount >
      getServerEnv().MAX_ACTIVE_BLUEPRINTS
    ) {
      throw new UserFacingError(
        "The application-wide active blueprint capacity has been reached",
      );
    }

    const inserted = await tx
      .insert(watches)
      .values(
        inputs.map((input) => ({
          userId,
          blueprintId: input.blueprintId,
          languages: input.languages,
          conditions: input.conditions,
          foil: input.foil === "any" ? null : input.foil === "foil",
          graded: input.graded,
          requireZero: input.requireZero,
          sellerCountries: input.sellerCountries,
          discountPercent: input.discountPercent,
          minSavingsCents: Math.round(input.minSavingsEuros * 100),
        })),
      )
      .returning();
    await tx
      .insert(blueprintScanState)
      .values(
        blueprintIds.map((blueprintId) => ({
          blueprintId,
          nextScanAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: blueprintScanState.blueprintId,
        set: { nextScanAt: new Date() },
      });
    return inserted;
  });
}

export async function removeWatch(userId: string, watchId: string) {
  const [removed] = await getDb()
    .delete(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .returning({ id: watches.id });
  if (!removed) throw new UserFacingError("Watch not found");
}

export async function updateWatch(
  userId: string,
  watchId: string,
  input: WatchInput,
) {
  const [updated] = await getDb()
    .update(watches)
    .set({
      languages: input.languages,
      conditions: input.conditions,
      foil: input.foil === "any" ? null : input.foil === "foil",
      graded: input.graded,
      requireZero: input.requireZero,
      sellerCountries: input.sellerCountries,
      discountPercent: input.discountPercent,
      minSavingsCents: Math.round(input.minSavingsEuros * 100),
      updatedAt: new Date(),
    })
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .returning();
  if (!updated) throw new UserFacingError("Watch not found");
  await getDb()
    .update(blueprintScanState)
    .set({ nextScanAt: new Date() })
    .where(eq(blueprintScanState.blueprintId, updated.blueprintId));
  return updated;
}

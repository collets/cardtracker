import "server-only";
import {
  and,
  count,
  countDistinct,
  eq,
  inArray,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { getDb } from "@/db";
import {
  blueprints,
  blueprintScanState,
  thresholdRecommendations,
  users,
  watches,
} from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";
import type { z } from "zod";
import type { watchInputSchema } from "@/lib/watches/validation";

type WatchInput = z.infer<typeof watchInputSchema>;

function watchFilterValues(input: WatchInput) {
  return {
    languages: input.languages,
    conditions: input.conditions,
    foil: input.foil === "any" ? null : input.foil === "foil",
    graded: input.graded,
    requireZero: input.requireZero,
    sellerCountries: input.sellerCountries,
    discountPercent: input.discountPercent,
    minSavingsCents: Math.round(input.minSavingsEuros * 100),
  };
}

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
  const env = getServerEnv();

  return getDb().transaction(async (tx) => {
    // All watch creation paths take these locks in the same order. This keeps
    // the per-user quota and global blueprint capacity checks atomic.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('riftwatch:watch-capacity'))`,
    );
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`riftwatch:watch-user:${userId}`}))`,
    );

    const [
      userRows,
      blueprintRows,
      currentWatchCountRows,
      uniqueBlueprintCountRows,
      alreadyWatched,
      userAlreadyWatched,
    ] = await Promise.all([
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
      tx
        .select({ blueprintId: watches.blueprintId })
        .from(watches)
        .where(
          and(
            eq(watches.userId, userId),
            inArray(watches.blueprintId, blueprintIds),
            eq(watches.active, true),
          ),
        ),
    ]);

    const quota = userRows[0]?.quota ?? env.DEFAULT_WATCH_QUOTA;
    if (blueprintRows.length !== blueprintIds.length) {
      throw new UserFacingError(
        "One or more selected Riftbound cards are no longer available",
      );
    }
    if (userAlreadyWatched.length > 0) {
      throw new UserFacingError(
        userAlreadyWatched.length === 1 && inputs.length === 1
          ? "This card is already in your watchlist"
          : "One or more selected cards are already in your watchlist",
      );
    }
    const currentWatchCount = currentWatchCountRows[0]?.value ?? 0;
    if (currentWatchCount + inputs.length > quota) {
      const remaining = Math.max(0, quota - currentWatchCount);
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
      (uniqueBlueprintCountRows[0]?.value ?? 0) + newBlueprintCount >
      env.MAX_ACTIVE_BLUEPRINTS
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
          ...watchFilterValues(input),
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
  return getDb().transaction(async (tx) => {
    const [updated] = await tx
      .update(watches)
      .set({
        ...watchFilterValues(input),
        updatedAt: new Date(),
      })
      .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
      .returning();
    if (!updated) throw new UserFacingError("Watch not found");

    await tx
      .update(thresholdRecommendations)
      .set({ status: "stale", resolvedAt: new Date() })
      .where(
        and(
          eq(thresholdRecommendations.watchId, watchId),
          eq(thresholdRecommendations.status, "pending"),
          or(
            ne(
              thresholdRecommendations.currentDiscountPercent,
              input.discountPercent,
            ),
            ne(
              thresholdRecommendations.currentMinSavingsCents,
              Math.round(input.minSavingsEuros * 100),
            ),
          ),
        ),
      );
    await tx
      .update(blueprintScanState)
      .set({ nextScanAt: new Date() })
      .where(eq(blueprintScanState.blueprintId, updated.blueprintId));
    return updated;
  });
}

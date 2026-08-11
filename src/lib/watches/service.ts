import "server-only";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { blueprints, blueprintScanState, users, watches } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import type { z } from "zod";
import type { watchInputSchema } from "@/lib/watches/validation";

type WatchInput = z.infer<typeof watchInputSchema>;

export async function createWatch(userId: string, input: WatchInput) {
  return getDb().transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(1381455444, 0), pg_advisory_xact_lock(1381455444, hashtext(${userId}))`,
    );
    const [user] = await tx
      .select({ quota: users.watchQuota })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [blueprint] = await tx
      .select({ id: blueprints.id })
      .from(blueprints)
      .where(
        and(eq(blueprints.id, input.blueprintId), eq(blueprints.active, true)),
      )
      .limit(1);
    const [current] = await tx
      .select({ value: count() })
      .from(watches)
      .where(and(eq(watches.userId, userId), eq(watches.active, true)));
    const [uniqueBlueprints] = await tx
      .select({ value: countDistinct(watches.blueprintId) })
      .from(watches)
      .where(eq(watches.active, true));
    const [alreadyWatched] = await tx
      .select({ id: watches.id })
      .from(watches)
      .where(
        and(
          eq(watches.blueprintId, input.blueprintId),
          eq(watches.active, true),
        ),
      )
      .limit(1);

    if (!user) throw new Error("User not found");
    const quota = user.quota;
    if (!blueprint)
      throw new Error("The selected Riftbound card does not exist");
    if ((current?.value ?? 0) >= quota)
      throw new Error(`Watch quota reached (${quota})`);
    if (
      !alreadyWatched &&
      (uniqueBlueprints?.value ?? 0) >= getServerEnv().MAX_ACTIVE_BLUEPRINTS
    ) {
      throw new Error(
        "The application-wide active blueprint capacity has been reached",
      );
    }

    const [watch] = await tx
      .insert(watches)
      .values({
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
      })
      .returning();
    await tx
      .insert(blueprintScanState)
      .values({ blueprintId: input.blueprintId, nextScanAt: new Date() })
      .onConflictDoUpdate({
        target: blueprintScanState.blueprintId,
        set: { nextScanAt: new Date() },
      });
    return watch;
  });
}

export async function removeWatch(userId: string, watchId: string) {
  const [removed] = await getDb()
    .delete(watches)
    .where(and(eq(watches.id, watchId), eq(watches.userId, userId)))
    .returning({ id: watches.id });
  if (!removed) throw new Error("Watch not found");
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
  if (!updated) throw new Error("Watch not found");
  await getDb()
    .update(blueprintScanState)
    .set({ nextScanAt: new Date() })
    .where(eq(blueprintScanState.blueprintId, updated.blueprintId));
  return updated;
}

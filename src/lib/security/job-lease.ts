import "server-only";

import { and, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { jobLeases } from "@/db/schema";

const LEASE_MS = 10 * 60 * 1_000;
const COOLDOWN_MS = 5 * 60 * 1_000;

export async function claimJobLease(name: string, now = new Date()) {
  const leaseUntil = new Date(now.getTime() + LEASE_MS);
  const cooldownCutoff = new Date(now.getTime() - COOLDOWN_MS);
  const [claimed] = await getDb()
    .insert(jobLeases)
    .values({ name, leaseUntil, updatedAt: now })
    .onConflictDoUpdate({
      target: jobLeases.name,
      set: { leaseUntil, updatedAt: now },
      setWhere: and(
        or(sql`${jobLeases.leaseUntil} is null`, lt(jobLeases.leaseUntil, now)),
        or(
          sql`${jobLeases.lastCompletedAt} is null`,
          lt(jobLeases.lastCompletedAt, cooldownCutoff),
        ),
      ),
    })
    .returning({ name: jobLeases.name });
  return Boolean(claimed);
}

export async function completeJobLease(name: string, now = new Date()) {
  await getDb()
    .update(jobLeases)
    .set({ leaseUntil: null, lastCompletedAt: now, updatedAt: now })
    .where(eq(jobLeases.name, name));
}

export async function releaseJobLease(name: string, now = new Date()) {
  await getDb()
    .update(jobLeases)
    .set({ leaseUntil: null, updatedAt: now })
    .where(eq(jobLeases.name, name));
}

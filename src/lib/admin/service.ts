import "server-only";

import { and, count, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { adminAuditEvents, users } from "@/db/schema";

export type UserAdminUpdate = {
  userId: string;
  quota: number;
  disabled: boolean;
  role: "admin" | "user";
};

export async function updateUserByAdmin(
  actorUserId: string,
  update: UserAdminUpdate,
) {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(1381455444, 1)`);
    const [target] = await tx
      .select({
        id: users.id,
        role: users.role,
        disabled: users.disabled,
        watchQuota: users.watchQuota,
      })
      .from(users)
      .where(eq(users.id, update.userId))
      .for("update")
      .limit(1);
    if (!target) throw new Error("User not found");
    if (
      target.id === actorUserId &&
      (update.disabled || update.role !== "admin")
    ) {
      throw new Error(
        "You cannot disable or demote your own administrator account",
      );
    }

    if (
      target.role === "admin" &&
      !target.disabled &&
      (update.role !== "admin" || update.disabled)
    ) {
      const [activeAdmins] = await tx
        .select({ value: count() })
        .from(users)
        .where(and(eq(users.role, "admin"), eq(users.disabled, false)));
      if ((activeAdmins?.value ?? 0) <= 1) {
        throw new Error("The last active administrator cannot be removed");
      }
    }

    const [saved] = await tx
      .update(users)
      .set({
        watchQuota: update.quota,
        disabled: update.disabled,
        role: update.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, update.userId))
      .returning({ id: users.id });
    if (!saved) throw new Error("User not found");

    await tx.insert(adminAuditEvents).values({
      actorUserId,
      action: "user.update",
      targetType: "user",
      targetId: target.id,
      outcome: "success",
      metadata: {
        previousRole: target.role,
        role: update.role,
        previousDisabled: target.disabled,
        disabled: update.disabled,
        previousQuota: target.watchQuota,
        quota: update.quota,
      },
    });
    return saved;
  });
}

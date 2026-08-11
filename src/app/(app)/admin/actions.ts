"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { adminAuditEvents, invitations } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { updateUserByAdmin } from "@/lib/admin/service";
import { synchronizeCatalog } from "@/lib/catalog/service";
import { runMarketScanner } from "@/lib/scanner/service";
import { recordAdminAudit, safeFailureMetadata } from "@/lib/security/audit";
import { normalizeEmail } from "@/lib/utils";
import { z } from "zod";

const invitationSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "user"]),
});

const userUpdateSchema = z.object({
  userId: z.uuid(),
  quota: z.coerce.number().int().min(1).max(500),
  disabled: z.boolean(),
  role: z.enum(["admin", "user"]),
});

const invitationDeleteSchema = z.object({
  invitationId: z.uuid(),
});

export async function inviteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  try {
    const { email, role } = invitationSchema.parse({
      email: normalizeEmail(String(formData.get("email") ?? "")),
      role: formData.get("role"),
    });
    await getDb().transaction(async (tx) => {
      const [invitation] = await tx
        .insert(invitations)
        .values({ email, role, invitedBy: admin.id })
        .onConflictDoUpdate({
          target: invitations.email,
          set: { role, invitedBy: admin.id, acceptedAt: null },
        })
        .returning({ id: invitations.id });
      if (!invitation) throw new Error("Could not save invitation");
      await tx.insert(adminAuditEvents).values({
        actorUserId: admin.id,
        action: "invitation.create",
        targetType: "invitation",
        targetId: invitation.id,
        outcome: "success",
        metadata: { role },
      });
    });
  } catch (error) {
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "invitation.create",
      targetType: "invitation",
      outcome: "failure",
      metadata: safeFailureMetadata(error),
    });
    throw error;
  }
  revalidatePath("/admin");
}

export async function deletePendingInvitationAction(formData: FormData) {
  const admin = await requireAdmin();
  let targetId: string | undefined;
  try {
    const { invitationId } = invitationDeleteSchema.parse({
      invitationId: formData.get("invitationId"),
    });
    targetId = invitationId;
    await getDb().transaction(async (tx) => {
      const [deleted] = await tx
        .delete(invitations)
        .where(
          and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)),
        )
        .returning({ id: invitations.id });
      if (!deleted) throw new Error("Pending invitation not found");
      await tx.insert(adminAuditEvents).values({
        actorUserId: admin.id,
        action: "invitation.revoke",
        targetType: "invitation",
        targetId: deleted.id,
        outcome: "success",
      });
    });
  } catch (error) {
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "invitation.revoke",
      targetType: "invitation",
      targetId,
      outcome: "failure",
      metadata: safeFailureMetadata(error),
    });
    throw error;
  }
  revalidatePath("/admin");
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  let targetId: string | undefined;
  try {
    const update = userUpdateSchema.parse({
      userId: formData.get("userId"),
      quota: formData.get("quota"),
      disabled: formData.get("disabled") === "on",
      role: formData.get("role"),
    });
    targetId = update.userId;
    await updateUserByAdmin(admin.id, update);
  } catch (error) {
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "user.update",
      targetType: "user",
      targetId,
      outcome: "failure",
      metadata: safeFailureMetadata(error),
    });
    throw error;
  }
  revalidatePath("/admin");
}

export async function synchronizeCatalogAction() {
  const admin = await requireAdmin();
  try {
    const result = await synchronizeCatalog();
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "catalog.synchronize",
      targetType: "catalog",
      targetId: "riftbound",
      outcome: "success",
      metadata: {
        status: result.status,
        expansions: result.expansions,
        blueprints: result.blueprints,
      },
    });
  } catch (error) {
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "catalog.synchronize",
      targetType: "catalog",
      targetId: "riftbound",
      outcome: "failure",
      metadata: safeFailureMetadata(error),
    });
    throw error;
  }
  revalidatePath("/admin");
  revalidatePath("/cards");
}

export async function runScannerAction() {
  const admin = await requireAdmin();
  try {
    const result = await runMarketScanner();
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "scanner.run",
      targetType: "scanner",
      targetId: "market",
      outcome: "success",
      metadata: {
        claimed: result.claimed,
        successes: result.successes,
        failures: result.failures,
      },
    });
  } catch (error) {
    await recordAdminAudit({
      actorUserId: admin.id,
      action: "scanner.run",
      targetType: "scanner",
      targetId: "market",
      outcome: "failure",
      metadata: safeFailureMetadata(error),
    });
    throw error;
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

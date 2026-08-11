"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { invitations, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth/guards";
import { synchronizeCatalog } from "@/lib/catalog/service";
import { runMarketScanner } from "@/lib/scanner/service";
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
  const { email, role } = invitationSchema.parse({
    email: normalizeEmail(String(formData.get("email") ?? "")),
    role: formData.get("role") === "admin" ? "admin" : "user",
  });
  await getDb()
    .insert(invitations)
    .values({ email, role, invitedBy: admin.id })
    .onConflictDoUpdate({
      target: invitations.email,
      set: { role, invitedBy: admin.id, acceptedAt: null },
    });
  revalidatePath("/admin");
}

export async function deletePendingInvitationAction(formData: FormData) {
  await requireAdmin();
  const { invitationId } = invitationDeleteSchema.parse({
    invitationId: formData.get("invitationId"),
  });
  const [deleted] = await getDb()
    .delete(invitations)
    .where(
      and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)),
    )
    .returning({ id: invitations.id });
  if (!deleted) throw new Error("Pending invitation not found");
  revalidatePath("/admin");
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const update = userUpdateSchema.parse({
    userId: formData.get("userId"),
    quota: formData.get("quota"),
    disabled: formData.get("disabled") === "on",
    role: formData.get("role") === "admin" ? "admin" : "user",
  });
  if (update.userId === admin.id && update.disabled) {
    throw new Error("You cannot disable your own administrator account");
  }
  await getDb()
    .update(users)
    .set({
      watchQuota: update.quota,
      disabled: update.disabled,
      role: update.role,
      updatedAt: new Date(),
    })
    .where(eq(users.id, update.userId));
  revalidatePath("/admin");
}

export async function synchronizeCatalogAction() {
  await requireAdmin();
  await synchronizeCatalog();
  revalidatePath("/admin");
  revalidatePath("/cards");
}

export async function runScannerAction() {
  await requireAdmin();
  await runMarketScanner();
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

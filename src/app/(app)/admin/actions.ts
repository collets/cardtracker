"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { invitations, users } from "@/db/schema";
import { actionResult } from "@/lib/actions/server";
import { requireAdmin } from "@/lib/auth/guards";
import { synchronizeCatalog } from "@/lib/catalog/service";
import { runMarketScanner } from "@/lib/scanner/service";
import { normalizeEmail } from "@/lib/utils";
import { UserFacingError } from "@/lib/errors";
import {
  createGuestAccessLink,
  revokeGuestAccessLink,
} from "@/lib/guests/service";
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

const invitationRevocationSchema = z.object({
  invitationId: z.uuid(),
});

const guestAccessLinkSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(5),
});

const guestAccessRevocationSchema = z.object({
  linkId: z.uuid(),
});

export async function inviteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  return actionResult(
    async () => {
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
    },
    "Invitation saved",
    "The invitation could not be saved. Please retry.",
  );
}

export async function revokePendingInvitationAction(formData: FormData) {
  await requireAdmin();
  return actionResult(
    async () => {
      const { invitationId } = invitationRevocationSchema.parse({
        invitationId: formData.get("invitationId"),
      });
      const [revoked] = await getDb()
        .delete(invitations)
        .where(
          and(eq(invitations.id, invitationId), isNull(invitations.acceptedAt)),
        )
        .returning({ id: invitations.id });
      if (!revoked) {
        throw new UserFacingError("Pending invitation not found");
      }
      revalidatePath("/admin");
    },
    "Invitation revoked",
    "The invitation could not be revoked. Please retry.",
  );
}

export async function createGuestAccessLinkAction(formData: FormData) {
  const admin = await requireAdmin();
  return actionResult(
    async () => {
      const { maxUses } = guestAccessLinkSchema.parse({
        maxUses: formData.get("maxUses"),
      });
      const link = await createGuestAccessLink(admin.id, maxUses);
      revalidatePath("/admin");
      return link;
    },
    ({ maxUses }) =>
      `Guest link created for ${maxUses} visitor${maxUses === 1 ? "" : "s"}`,
    "The guest link could not be created. Please retry.",
  );
}

export async function revokeGuestAccessLinkAction(formData: FormData) {
  await requireAdmin();
  return actionResult(
    async () => {
      const { linkId } = guestAccessRevocationSchema.parse({
        linkId: formData.get("linkId"),
      });
      const revoked = await revokeGuestAccessLink(linkId);
      if (!revoked)
        throw new UserFacingError("Guest link is already unavailable");
      revalidatePath("/admin");
    },
    "Guest link revoked",
    "The guest link could not be revoked. Please retry.",
  );
}

export async function updateUserAction(formData: FormData) {
  const admin = await requireAdmin();
  return actionResult(
    async () => {
      const update = userUpdateSchema.parse({
        userId: formData.get("userId"),
        quota: formData.get("quota"),
        disabled: formData.get("disabled") === "on",
        role: formData.get("role") === "admin" ? "admin" : "user",
      });
      if (update.userId === admin.id && update.disabled) {
        throw new UserFacingError(
          "You cannot disable your own administrator account",
        );
      }
      const [updated] = await getDb()
        .update(users)
        .set({
          watchQuota: update.quota,
          disabled: update.disabled,
          role: update.role,
          updatedAt: new Date(),
        })
        .where(eq(users.id, update.userId))
        .returning({ id: users.id });
      if (!updated) throw new UserFacingError("User not found");
      revalidatePath("/admin");
    },
    "User settings saved",
    "The user settings could not be saved. Please retry.",
  );
}

export async function synchronizeCatalogAction() {
  await requireAdmin();
  return actionResult(
    async () => {
      await synchronizeCatalog();
      revalidatePath("/admin");
      revalidatePath("/cards");
    },
    "Catalog synchronized",
    "Catalog synchronization failed. Check the latest run for details.",
  );
}

export async function runScannerAction() {
  await requireAdmin();
  return actionResult(
    async () => {
      await runMarketScanner();
      revalidatePath("/admin");
      revalidatePath("/dashboard");
    },
    "Market scan completed",
    "The market scan failed. Check the latest run for details.",
  );
}

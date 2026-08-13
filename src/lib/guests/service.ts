import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  guestAccessLinks,
  guestAccessRedemptions,
  userPreferences,
  users,
} from "@/db/schema";
import { buildAppUrl } from "@/lib/app-url";
import { getServerEnv } from "@/lib/env";
export { isGuestSessionActive } from "@/lib/guests/session";

export const GUEST_ACCESS_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const GUEST_SESSION_LIFETIME_MS = 60 * 60 * 1000;
export const GUEST_WATCH_QUOTA = 2;

const guestTokenSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{43}$/, "Invalid guest access token");

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createGuestAccessLink(
  createdBy: string,
  maxUses: number,
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GUEST_ACCESS_LINK_LIFETIME_MS);
  await getDb()
    .insert(guestAccessLinks)
    .values({
      tokenHash: hashGuestToken(token),
      maxUses,
      expiresAt,
      createdBy,
    });

  return {
    url: `${buildAppUrl(getServerEnv().NEXT_PUBLIC_APP_URL, "/guest")}#${token}`,
    expiresAt,
    maxUses,
  };
}

export async function revokeGuestAccessLink(linkId: string) {
  const [revoked] = await getDb()
    .update(guestAccessLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(guestAccessLinks.id, linkId), isNull(guestAccessLinks.revokedAt)),
    )
    .returning({ id: guestAccessLinks.id });
  return revoked ?? null;
}

export async function redeemGuestAccessToken(tokenValue: unknown) {
  const parsed = guestTokenSchema.safeParse(tokenValue);
  if (!parsed.success) return null;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + GUEST_SESSION_LIFETIME_MS);
  return getDb().transaction(async (tx) => {
    // This conditional increment is the concurrency boundary: a link cannot
    // create more guests than its configured use count, even under parallel use.
    const [link] = await tx
      .update(guestAccessLinks)
      .set({ usedCount: sql`${guestAccessLinks.usedCount} + 1` })
      .where(
        and(
          eq(guestAccessLinks.tokenHash, hashGuestToken(parsed.data)),
          gt(guestAccessLinks.expiresAt, now),
          isNull(guestAccessLinks.revokedAt),
          sql`${guestAccessLinks.usedCount} < ${guestAccessLinks.maxUses}`,
        ),
      )
      .returning({ id: guestAccessLinks.id });
    if (!link) return null;

    const [guest] = await tx
      .insert(users)
      .values({
        email: `guest-${randomUUID()}@guest.riftwatch.test`,
        emailVerified: now,
        kind: "guest",
        watchQuota: GUEST_WATCH_QUOTA,
      })
      .returning();
    if (!guest) throw new Error("Guest account creation did not return a user");

    await tx.insert(userPreferences).values({ userId: guest.id });
    await tx.insert(guestAccessRedemptions).values({
      userId: guest.id,
      linkId: link.id,
      expiresAt,
    });
    return guest;
  });
}

import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { guestAccessRedemptions, users } from "@/db/schema";
import { UserFacingError } from "@/lib/errors";
import { isGuestSessionActive } from "@/lib/guests/session";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const [record] = await getDb()
    .select({
      role: users.role,
      kind: users.kind,
      disabled: users.disabled,
      watchQuota: users.watchQuota,
      guestExpiresAt: guestAccessRedemptions.expiresAt,
    })
    .from(users)
    .leftJoin(
      guestAccessRedemptions,
      eq(guestAccessRedemptions.userId, users.id),
    )
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!record || record.disabled) redirect("/sign-in");
  if (!isGuestSessionActive(record.kind, record.guestExpiresAt)) {
    redirect("/guest?error=expired");
  }
  return {
    ...session.user,
    role: record.role,
    disabled: record.disabled,
    kind: record.kind,
    watchQuota: record.watchQuota,
    guestExpiresAt: record.guestExpiresAt,
  };
}

export async function requireMemberUser() {
  const user = await requireUser();
  if (user.kind === "guest") {
    throw new UserFacingError(
      "Guest access uses scheduled price updates; manual scans are unavailable.",
    );
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

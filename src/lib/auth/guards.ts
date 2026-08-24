import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/auth";
import { getSql } from "@/db";
import { observeCancellableDatabaseOperation } from "@/lib/db/observability";
import { UserFacingError } from "@/lib/errors";

export const requireUser = cache(async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const [record] = await observeCancellableDatabaseOperation(
    "auth.require-user",
    getSql()<
      Array<{
        role: "admin" | "user";
        kind: "member" | "guest";
        disabled: boolean;
        watchQuota: number;
        guestSessionActive: boolean | null;
      }>
    >`
      select
        app_user.role,
        app_user.kind,
        app_user.disabled,
        app_user.watch_quota as "watchQuota",
        (
          app_user.kind <> 'guest'
          or redemption.expires_at > now()
        ) as "guestSessionActive"
      from users app_user
      left join guest_access_redemptions redemption
        on redemption.user_id = app_user.id
      where app_user.id = ${session.user.id}
      limit 1
    `,
  );
  if (!record || record.disabled) redirect("/sign-in");
  if (record.guestSessionActive !== true) {
    redirect("/guest?error=expired");
  }
  return {
    ...session.user,
    role: record.role,
    disabled: record.disabled,
    kind: record.kind,
    watchQuota: record.watchQuota,
  };
});

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

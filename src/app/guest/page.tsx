import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuestAccessEntry } from "@/components/guest-access-entry";
import { getDb } from "@/db";
import { guestAccessRedemptions, users } from "@/db/schema";
import { isGuestSessionActive } from "@/lib/guests/session";

export const dynamic = "force-dynamic";

export default async function GuestPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user?.id) {
    const [user] = await getDb()
      .select({ kind: users.kind, expiresAt: guestAccessRedemptions.expiresAt })
      .from(users)
      .leftJoin(
        guestAccessRedemptions,
        eq(guestAccessRedemptions.userId, users.id),
      )
      .where(eq(users.id, session.user.id))
      .limit(1);
    if (user && isGuestSessionActive(user.kind, user.expiresAt)) {
      redirect("/dashboard");
    }
  }

  const params = await searchParams;
  return (
    <GuestAccessEntry
      initialError={
        params.error === "expired"
          ? "expired"
          : params.error
            ? "invalid"
            : undefined
      }
    />
  );
}

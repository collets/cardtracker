import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");
  const [record] = await getDb()
    .select({
      role: users.role,
      disabled: users.disabled,
      watchQuota: users.watchQuota,
    })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!record || record.disabled) redirect("/sign-in");
  return {
    ...session.user,
    role: record.role,
    disabled: record.disabled,
    watchQuota: record.watchQuota,
  };
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}

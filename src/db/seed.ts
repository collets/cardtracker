import "@/envConfig";
import { eq } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import { userPreferences, users } from "@/db/schema";
import { getServerEnv } from "@/lib/env";
import { normalizeEmail } from "@/lib/utils";

const env = getServerEnv();
if (!env.ADMIN_EMAIL)
  throw new Error("ADMIN_EMAIL is required to seed the database");

const email = normalizeEmail(env.ADMIN_EMAIL);
const [existing] = await getDb()
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

const [admin] = existing
  ? await getDb()
      .update(users)
      .set({ role: "admin", disabled: false })
      .where(eq(users.id, existing.id))
      .returning()
  : await getDb()
      .insert(users)
      .values({ email, role: "admin", emailVerified: new Date() })
      .returning();

if (admin) {
  await getDb()
    .insert(userPreferences)
    .values({ userId: admin.id })
    .onConflictDoNothing();
}

await getSql().end();

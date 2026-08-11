import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  accounts,
  invitations,
  sessions,
  userPreferences,
  users,
  verificationTokens,
} from "@/db/schema";
import { resolveKnownUserRole } from "@/lib/auth/authorization";
import {
  isVerifiedGoogleProfile,
  omitStoredOAuthTokens,
} from "@/lib/auth/google";
import { normalizeEmail } from "@/lib/utils";

const devAuthEnabled =
  process.env.AUTH_ENABLE_DEV_PROVIDER === "true" &&
  process.env.NODE_ENV !== "production";

if (
  process.env.NODE_ENV === "production" &&
  process.env.AUTH_ENABLE_DEV_PROVIDER === "true"
) {
  throw new Error("AUTH_ENABLE_DEV_PROVIDER must be disabled in production");
}

async function authorizationForEmail(emailValue: string) {
  const email = normalizeEmail(emailValue);
  const adminEmail = process.env.ADMIN_EMAIL
    ? normalizeEmail(process.env.ADMIN_EMAIL)
    : undefined;
  const [existing] = await getDb()
    .select({ id: users.id, role: users.role, disabled: users.disabled })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  const knownRole = resolveKnownUserRole(email === adminEmail, existing);
  if (knownRole === null) return null;
  if (knownRole) return { email, role: knownRole };

  const [invitation] = await getDb()
    .select({ role: invitations.role })
    .from(invitations)
    .where(
      and(
        sql`lower(${invitations.email}) = ${email}`,
        sql`${invitations.acceptedAt} is null`,
      ),
    )
    .limit(1);
  return invitation ? { email, role: invitation.role } : null;
}

async function finishUserProvisioning(userId: string, emailValue: string) {
  const email = normalizeEmail(emailValue);
  const authorization = await authorizationForEmail(email);
  if (!authorization) return;

  await getDb().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: authorization.role, email, updatedAt: new Date() })
      .where(eq(users.id, userId));
    await tx.insert(userPreferences).values({ userId }).onConflictDoNothing();
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(sql`lower(${invitations.email}) = ${email}`);
  });
}

const providers = [];
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      account: omitStoredOAuthTokens,
    }),
  );
}
if (devAuthEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development login",
      credentials: { email: { label: "Email", type: "email" } },
      async authorize(credentials) {
        const value =
          typeof credentials.email === "string" ? credentials.email : "";
        const authorization = await authorizationForEmail(value);
        if (!authorization) return null;
        const email = authorization.email;
        const [existing] = await getDb()
          .select()
          .from(users)
          .where(sql`lower(${users.email}) = ${email}`)
          .limit(1);
        if (existing) return existing;
        const [created] = await getDb()
          .insert(users)
          .values({
            email,
            emailVerified: new Date(),
            role: authorization.role,
          })
          .returning();
        if (!created) return null;
        await getDb()
          .insert(userPreferences)
          .values({ userId: created.id })
          .onConflictDoNothing();
        return created;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    // enableRLS() intentionally removes the builder method from the table type;
    // the adapter's structural type still requires it even though runtime access
    // only depends on these columns.
    usersTable: users as never,
    accountsTable: accounts as never,
    sessionsTable: sessions as never,
    verificationTokensTable: verificationTokens as never,
  }),
  providers,
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: { signIn: "/sign-in" },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      if (account?.provider === "google" && !isVerifiedGoogleProfile(profile))
        return false;
      return Boolean(await authorizationForEmail(user.email));
    },
    async jwt({ token, user }) {
      if (user?.id) token.userId = user.id;
      if (user?.email) {
        const [record] = await getDb()
          .select({ id: users.id, role: users.role, disabled: users.disabled })
          .from(users)
          .where(sql`lower(${users.email}) = ${normalizeEmail(user.email)}`)
          .limit(1);
        if (record) {
          token.userId = record.id;
          token.role = record.role;
          token.disabled = record.disabled;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id =
          typeof token.userId === "string" ? token.userId : (token.sub ?? "");
        session.user.role = token.role === "admin" ? "admin" : "user";
        session.user.disabled = token.disabled === true;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (user.id && user.email)
        await finishUserProvisioning(user.id, user.email);
    },
    async signIn({ user }) {
      if (user.id && user.email)
        await finishUserProvisioning(user.id, user.email);
    },
  },
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, count, eq, inArray, notInArray } from "drizzle-orm";
import { getDb, getSql } from "@/db";
import {
  adminAuditEvents,
  blueprints,
  expansions,
  jobLeases,
  users,
  watches,
} from "@/db/schema";
import { updateUserByAdmin } from "@/lib/admin/service";
import { createWatch } from "@/lib/watches/service";
import { claimJobLease, completeJobLease } from "@/lib/security/job-lease";

const adminIds = [
  "00000000-0000-4000-8000-000000000951",
  "00000000-0000-4000-8000-000000000952",
] as const;
const quotaUserId = "00000000-0000-4000-8000-000000000953";
const securityExpansionId = 990_050;
const securityBlueprintIds = [990_051, 990_052] as const;

beforeAll(async () => {
  await getDb()
    .delete(users)
    .where(inArray(users.id, [...adminIds, quotaUserId]));
  await getDb()
    .insert(users)
    .values([
      {
        id: adminIds[0],
        email: "security-admin-one@riftwatch.test",
        role: "admin",
        emailVerified: new Date(),
      },
      {
        id: adminIds[1],
        email: "security-admin-two@riftwatch.test",
        role: "admin",
        emailVerified: new Date(),
      },
      {
        id: quotaUserId,
        email: "security-quota@riftwatch.test",
        role: "user",
        watchQuota: 1,
        emailVerified: new Date(),
      },
    ]);
  await getDb().insert(expansions).values({
    id: securityExpansionId,
    gameId: 22,
    code: "SEC",
    name: "Security Test Expansion",
    syncedAt: new Date(),
  });
  await getDb()
    .insert(blueprints)
    .values(
      securityBlueprintIds.map((id) => ({
        id,
        expansionId: securityExpansionId,
        gameId: 22,
        categoryId: 258,
        name: `Security Test Card ${id}`,
        fixedProperties: {},
        editableProperties: [],
        syncedAt: new Date(),
      })),
    );
});

afterAll(async () => {
  await getDb()
    .delete(expansions)
    .where(eq(expansions.id, securityExpansionId));
  await getDb()
    .delete(users)
    .where(inArray(users.id, [...adminIds, quotaUserId]));
  await getSql().end();
});

describe("database security", () => {
  it("defines a non-login, non-bypass runtime role and forces RLS", async () => {
    const [role] = await getSql()<
      Array<{
        rolcanlogin: boolean;
        rolsuper: boolean;
        rolcreaterole: boolean;
        rolcreatedb: boolean;
        rolreplication: boolean;
        rolbypassrls: boolean;
      }>
    >`select rolcanlogin, rolsuper, rolcreaterole, rolcreatedb, rolreplication, rolbypassrls from pg_roles where rolname = 'riftwatch_runtime'`;
    expect(role).toEqual({
      rolcanlogin: false,
      rolsuper: false,
      rolcreaterole: false,
      rolcreatedb: false,
      rolreplication: false,
      rolbypassrls: false,
    });

    const [rls] = await getSql()<Array<{ missing: number }>>`
      select count(*)::int as missing
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'public'
        and relation.relkind in ('r', 'p')
        and relation.relname in (
          'accounts', 'admin_audit_events', 'alerts', 'blueprint_scan_state',
          'blueprints', 'expansions', 'invitations', 'job_leases',
          'notification_deliveries', 'price_observations', 'scan_runs',
          'sessions', 'telegram_channels', 'telegram_link_tokens',
          'user_preferences', 'users', 'verification_tokens',
          'watch_metrics', 'watches'
        )
        and (not relation.relrowsecurity or not relation.relforcerowsecurity)
    `;
    expect(rls?.missing).toBe(0);
  });

  it("allows runtime reads but rejects audit mutation", async () => {
    await expect(
      getSql().begin(async (sql) => {
        await sql`set local role riftwatch_runtime`;
        return sql`select id from users limit 1`;
      }),
    ).resolves.toBeDefined();

    const [event] = await getDb()
      .insert(adminAuditEvents)
      .values({
        actorUserId: adminIds[0],
        action: "scanner.run",
        targetType: "scanner",
        outcome: "success",
      })
      .returning({ id: adminAuditEvents.id });
    expect(event).toBeDefined();

    await expect(
      getSql().begin(async (sql) => {
        await sql`set local role riftwatch_runtime`;
        await sql`update admin_audit_events set target_type = 'changed' where id = ${event?.id ?? 0}`;
      }),
    ).rejects.toThrow();
  });
});

describe("administrator invariants", () => {
  it("rejects self-demotion", async () => {
    await expect(
      updateUserByAdmin(adminIds[0], {
        userId: adminIds[0],
        quota: 50,
        disabled: false,
        role: "user",
      }),
    ).rejects.toThrow(/disable or demote/i);
  });

  it("cannot remove the last active administrator", async () => {
    await updateUserByAdmin(adminIds[0], {
      userId: adminIds[1],
      quota: 50,
      disabled: true,
      role: "admin",
    });

    const otherActiveAdmins = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.disabled, false),
          notInArray(users.id, [...adminIds]),
        ),
      );
    const otherAdminIds = otherActiveAdmins.map(({ id }) => id);
    if (otherAdminIds.length > 0) {
      await getDb()
        .update(users)
        .set({ disabled: true })
        .where(inArray(users.id, otherAdminIds));
    }

    try {
      await expect(
        updateUserByAdmin(adminIds[1], {
          userId: adminIds[0],
          quota: 50,
          disabled: true,
          role: "admin",
        }),
      ).rejects.toThrow(/last active administrator/i);
    } finally {
      if (otherAdminIds.length > 0) {
        await getDb()
          .update(users)
          .set({ disabled: false })
          .where(inArray(users.id, otherAdminIds));
      }
    }

    const [admin] = await getDb()
      .select({ disabled: users.disabled })
      .from(users)
      .where(eq(users.id, adminIds[0]));
    expect(admin?.disabled).toBe(false);
  });
});

describe("quota concurrency", () => {
  it("cannot exceed a user's quota through parallel requests", async () => {
    const inputFor = (blueprintId: number) => ({
      blueprintId,
      languages: ["en"] as ("en" | "fr" | "kr" | "zh-CN")[],
      conditions: ["Near Mint"] as (
        | "Mint"
        | "Near Mint"
        | "Slightly Played"
        | "Moderately Played"
        | "Played"
        | "Poor"
      )[],
      foil: "any" as const,
      graded: false,
      requireZero: false,
      sellerCountries: ["IT"] as "IT"[],
      discountPercent: 20,
      minSavingsEuros: 5,
    });
    const outcomes = await Promise.allSettled(
      securityBlueprintIds.map((id) => createWatch(quotaUserId, inputFor(id))),
    );

    expect(
      outcomes.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      outcomes.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
    const [total] = await getDb()
      .select({ value: count() })
      .from(watches)
      .where(eq(watches.userId, quotaUserId));
    expect(total?.value).toBe(1);
  });
});

describe("job lease concurrency", () => {
  it("allows one worker and enforces the completion cooldown", async () => {
    const leaseName = "security-test-catalog";
    await getDb().delete(jobLeases).where(eq(jobLeases.name, leaseName));
    const claims = await Promise.all([
      claimJobLease(leaseName),
      claimJobLease(leaseName),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    await completeJobLease(leaseName);
    await expect(claimJobLease(leaseName)).resolves.toBe(false);
    await getDb().delete(jobLeases).where(eq(jobLeases.name, leaseName));
  });
});

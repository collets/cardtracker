#!/usr/bin/env node

import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);

function valueFor(flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function hasFlag(flag: string) {
  return args.includes(flag);
}

function print(message = "") {
  process.stdout.write(`${message}\n`);
}

function fail(message: string): never {
  throw new Error(message);
}

function isLoopback(urlValue: string) {
  const hostname = new URL(urlValue).hostname;
  return new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname);
}

async function checkEnvironment() {
  const { productionEnvironmentIssues } = await import("@/lib/env");
  const issues = productionEnvironmentIssues(process.env, {
    requireDirectDatabase: hasFlag("--require-direct"),
  });
  if (issues.length > 0) {
    for (const issue of issues) print(`✗ ${issue}`);
    fail(`Production environment has ${issues.length} configuration issue(s)`);
  }
  print("✓ Production environment is complete and internally consistent.");
  print("✓ Credential values were not displayed.");
}

async function showOperationalStatus() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required");
  if (!isLoopback(databaseUrl) && !hasFlag("--allow-hosted")) {
    fail(
      "Refusing a hosted database; pass --allow-hosted for this read-only report",
    );
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [status] = await sql<
      Array<{
        active_watches: number;
        unique_blueprints: number;
        stale_blueprints: number;
        failed_runs_24h: number;
        failed_deliveries: number;
      }>
    >`
      select
        (select count(*)::int from watches where active = true) as active_watches,
        (select count(distinct blueprint_id)::int from watches where active = true) as unique_blueprints,
        (
          select count(*)::int
          from blueprint_scan_state state
          where exists (
            select 1 from watches watch
            where watch.blueprint_id = state.blueprint_id and watch.active = true
          )
          and (state.last_scan_at is null or state.last_scan_at < now() - interval '15 minutes')
        ) as stale_blueprints,
        (
          select count(*)::int from scan_runs
          where started_at >= now() - interval '24 hours'
          and (status = 'failed' or failure_count > 0)
        ) as failed_runs_24h,
        (
          select count(*)::int from notification_deliveries
          where status = 'failed'
        ) as failed_deliveries
    `;
    if (!status) fail("Operational status query returned no result");
    const capacity = Number(process.env.MAX_ACTIVE_BLUEPRINTS ?? 250);
    print("Riftwatch operational status");
    print(`Active watches: ${status.active_watches}`);
    print(`Unique active blueprints: ${status.unique_blueprints}/${capacity}`);
    print(`Stale active blueprints (>15m): ${status.stale_blueprints}`);
    print(`Failed/partial runs (24h): ${status.failed_runs_24h}`);
    print(`Failed notification deliveries: ${status.failed_deliveries}`);
  } finally {
    await sql.end();
  }
}

async function auditDatabaseSecurity() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL is required");
  if (!isLoopback(databaseUrl) && !hasFlag("--allow-hosted")) {
    fail(
      "Refusing a hosted database; pass --allow-hosted for this read-only audit",
    );
  }

  const sql = postgres(databaseUrl, { max: 1, prepare: false });
  try {
    const [status] = await sql<
      Array<{
        current_role: string;
        role_is_safe: boolean;
        ssl_enabled: boolean;
        rls_disabled: number;
        force_rls_disabled: number;
        unsafe_api_grants: number;
        unsafe_default_grants: number;
        mutable_audit_grants: number;
      }>
    >`
      select
        current_user as current_role,
        (
          select not (rolsuper or rolcreaterole or rolcreatedb or rolreplication or rolbypassrls)
          from pg_roles where rolname = current_user
        ) as role_is_safe,
        coalesce((select ssl from pg_stat_ssl where pid = pg_backend_pid()), false) as ssl_enabled,
        (
          select count(*)::int
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
            and not relation.relrowsecurity
        ) as rls_disabled,
        (
          select count(*)::int
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
            and not relation.relforcerowsecurity
        ) as force_rls_disabled,
        (
          select count(*)::int from (
            select privilege.grantee
            from pg_class object
            join pg_namespace namespace on namespace.oid = object.relnamespace
            cross join lateral aclexplode(
              coalesce(
                object.relacl,
                acldefault(case when object.relkind = 'S' then 'S'::"char" else 'r'::"char" end, object.relowner)
              )
            ) privilege
            where namespace.nspname = 'public'
              and object.relkind in ('r', 'p', 'v', 'm', 'S', 'f')
            union all
            select privilege.grantee
            from pg_proc object
            join pg_namespace namespace on namespace.oid = object.pronamespace
            cross join lateral aclexplode(
              coalesce(object.proacl, acldefault('f', object.proowner))
            ) privilege
            where namespace.nspname = 'public'
            union all
            select privilege.grantee
            from pg_namespace object
            cross join lateral aclexplode(
              coalesce(object.nspacl, acldefault('n', object.nspowner))
            ) privilege
            where object.nspname = 'public'
          ) unsafe_access
          where unsafe_access.grantee = 0
            or unsafe_access.grantee in (
              select oid from pg_roles
              where rolname in ('anon', 'authenticated', 'service_role')
            )
        ) as unsafe_api_grants,
        (
          select count(*)::int
          from pg_default_acl defaults
          cross join lateral aclexplode(defaults.defaclacl) privilege
          left join pg_roles grantee on grantee.oid = privilege.grantee
          where (
              grantee.rolname in ('anon', 'authenticated', 'service_role')
              or privilege.grantee = 0
            )
            and defaults.defaclnamespace = 'public'::regnamespace
        ) as unsafe_default_grants,
        (
          select count(*)::int
          from information_schema.table_privileges
          where table_schema = 'public'
            and table_name = 'admin_audit_events'
            and grantee = 'riftwatch_runtime'
            and privilege_type in ('UPDATE', 'DELETE', 'TRUNCATE')
        ) as mutable_audit_grants
    `;
    if (!status) fail("Database security audit returned no result");

    print("Riftwatch database security audit");
    print(`Runtime role: ${status.current_role}`);
    print(`Unprivileged role flags: ${status.role_is_safe ? "yes" : "no"}`);
    print(`TLS active: ${status.ssl_enabled ? "yes" : "no"}`);
    print(`Tables without RLS: ${status.rls_disabled}`);
    print(`Tables without forced RLS: ${status.force_rls_disabled}`);
    print(`Unsafe PUBLIC/API object grants: ${status.unsafe_api_grants}`);
    print(`Unsafe PUBLIC/API default grants: ${status.unsafe_default_grants}`);
    print(`Mutable audit grants: ${status.mutable_audit_grants}`);

    if (
      !status.role_is_safe ||
      (!isLoopback(databaseUrl) && !status.ssl_enabled) ||
      status.rls_disabled > 0 ||
      status.force_rls_disabled > 0 ||
      status.unsafe_api_grants > 0 ||
      status.unsafe_default_grants > 0 ||
      status.mutable_audit_grants > 0
    ) {
      fail("Database security audit failed");
    }
    print("Database security audit passed.");
  } finally {
    await sql.end();
  }
}

async function expectResponse(
  baseUrl: string,
  path: string,
  expected: number | number[],
  init?: RequestInit,
) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  const statuses = Array.isArray(expected) ? expected : [expected];
  if (!statuses.includes(response.status)) {
    fail(
      `${path} returned HTTP ${response.status}; expected ${statuses.join(" or ")}`,
    );
  }
  print(`✓ ${path}: HTTP ${response.status}`);
  return response;
}

async function smokeHosted() {
  const urlValue = valueFor("--url") ?? process.env.NEXT_PUBLIC_APP_URL;
  if (!urlValue) fail("Pass --url or set NEXT_PUBLIC_APP_URL");
  const url = new URL(urlValue);
  if (url.protocol !== "https:" && !isLoopback(url.toString())) {
    fail("Hosted smoke targets must use HTTPS");
  }
  const baseUrl = url.toString().replace(/\/$/, "");

  const health = await expectResponse(baseUrl, "/api/health", 200);
  const healthBody = (await health.json()) as {
    status?: unknown;
    database?: unknown;
  };
  if (healthBody.status !== "ok" || healthBody.database !== "connected") {
    fail("Health response did not report a connected database");
  }
  const landing = await expectResponse(baseUrl, "/", 200);
  const policy = landing.headers.get("content-security-policy") ?? "";
  if (
    !policy.includes("strict-dynamic") ||
    !policy.includes("frame-ancestors 'none'")
  ) {
    fail("Hosted response is missing the enforced strict CSP");
  }
  if (landing.headers.get("x-content-type-options") !== "nosniff") {
    fail("Hosted response is missing X-Content-Type-Options");
  }
  const authCsrf = await expectResponse(baseUrl, "/api/auth/csrf", 200);
  const authCookies = authCsrf.headers.get("set-cookie")?.toLowerCase() ?? "";
  for (const attribute of ["httponly", "secure", "samesite=lax"]) {
    if (!authCookies.includes(attribute)) {
      fail(`Auth.js cookie is missing ${attribute}`);
    }
  }
  const protectedPage = await expectResponse(baseUrl, "/dashboard", [303, 307]);
  if (!protectedPage.headers.get("location")?.includes("/sign-in")) {
    fail("Unauthenticated dashboard request did not redirect to sign-in");
  }
  await expectResponse(baseUrl, "/api/cron/catalog", 401);
  await expectResponse(baseUrl, "/api/cron/scan", 401);

  for (const kind of ["catalog", "scan"] as const) {
    if (!hasFlag(`--run-${kind}`)) continue;
    const secret = process.env.CRON_SECRET;
    if (!secret) fail(`CRON_SECRET is required for --run-${kind}`);
    await expectResponse(baseUrl, `/api/cron/${kind}`, 200, {
      headers: { Authorization: `Bearer ${secret}` },
    });
  }
  print("Hosted smoke checks passed.");
}

function showHelp() {
  print(`Riftwatch production tooling

Commands:
  check-env [--require-direct] Validate production configuration without printing values
  status [--allow-hosted]   Print aggregate database operational status
  security [--allow-hosted] Audit runtime role, TLS, grants, and RLS
  smoke --url <url>         Run safe hosted HTTP checks
        [--run-catalog]     Explicitly invoke the authenticated catalog job
        [--run-scan]        Explicitly invoke the authenticated market job`);
}

try {
  switch (command) {
    case "check-env":
      await checkEnvironment();
      break;
    case "status":
      await showOperationalStatus();
      break;
    case "security":
      await auditDatabaseSecurity();
      break;
    case "smoke":
      await smokeHosted();
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      showHelp();
      fail(`Unknown command: ${command}`);
  }
} catch (error) {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : "Unknown production tooling error"}\n`,
  );
  process.exitCode = 1;
}

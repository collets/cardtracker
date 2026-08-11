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
  await expectResponse(baseUrl, "/", 200);
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

#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import nextEnv from "@next/env";
import postgres from "postgres";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const command = process.argv[2] ?? "help";
const args = process.argv.slice(3);
const repositoryRoot = resolve(process.cwd());

class RecoveryCommandError extends Error {}

function fail(message: string): never {
  throw new RecoveryCommandError(message);
}

function print(message = "") {
  process.stdout.write(`${message}\n`);
}

function hasFlag(flag: string) {
  return args.includes(flag);
}

function valueFor(flag: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function isLoopback(urlValue: string) {
  const hostname = new URL(urlValue).hostname;
  return new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname);
}

function connectionEnvironment(urlValue: string) {
  const url = new URL(urlValue);
  return {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || "5432",
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.replace(/^\//, "")),
    PGSSLMODE:
      url.searchParams.get("sslmode") ??
      (isLoopback(urlValue) ? "prefer" : "require"),
  };
}

function requireTool(name: "pg_dump" | "pg_restore") {
  const result = spawnSync(name, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (
    result.error &&
    "code" in result.error &&
    result.error.code === "ENOENT"
  ) {
    fail(
      `${name} is required. Install the PostgreSQL 17 client tools and retry.`,
    );
  }
  if (result.status !== 0) fail(`${name} could not be executed`);
  const match = result.stdout.match(/(\d+)(?:\.\d+)?/);
  if (!match) fail(`${name} returned an unrecognized version`);
  return Number(match[1]);
}

function runTool(
  name: "pg_dump" | "pg_restore",
  toolArgs: string[],
  databaseUrl: string,
) {
  const result = spawnSync(name, toolArgs, {
    env: connectionEnvironment(databaseUrl),
    stdio: "inherit",
  });
  if (result.error) fail(`${name} could not be started`);
  if (result.status !== 0) fail(`${name} exited with status ${result.status}`);
}

async function sha256(file: string) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

function assertOutsideRepository(path: string) {
  const pathFromRoot = relative(repositoryRoot, path);
  if (pathFromRoot === "" || (!pathFromRoot.startsWith("..") && pathFromRoot)) {
    fail("Backup output must be outside the repository");
  }
}

function timestamp() {
  return new Date().toISOString().replaceAll(":", "-").replace(".", "-");
}

async function backup() {
  const databaseUrl =
    process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_DIRECT or DATABASE_URL is required");
  const hosted = !isLoopback(databaseUrl);
  if (hosted && !hasFlag("--allow-hosted")) {
    fail(
      "Refusing a hosted database; pass --allow-hosted for this read-only dump",
    );
  }
  const outputValue = valueFor("--output");
  if (!outputValue) fail("Pass an external backup directory with --output");
  const outputDirectory = resolve(outputValue);
  assertOutsideRepository(outputDirectory);

  const clientMajor = requireTool("pg_dump");
  const sql = postgres(databaseUrl, {
    max: 1,
    prepare: false,
    ...(hosted ? { ssl: "require" as const } : {}),
  });
  let serverMajor: number;
  try {
    const [version] = await sql<Array<{ version: number }>>`
      select current_setting('server_version_num')::int as version
    `;
    if (!version) fail("Database version query returned no result");
    serverMajor = Math.floor(version.version / 10_000);
  } finally {
    await sql.end();
  }
  if (clientMajor < serverMajor) {
    fail(
      `pg_dump ${clientMajor} cannot dump PostgreSQL ${serverMajor}; install a compatible client`,
    );
  }

  await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
  await chmod(outputDirectory, 0o700);
  const base = `riftwatch-${timestamp()}`;
  const archive = resolve(outputDirectory, `${base}.dump`);
  const partialArchive = `${archive}.partial`;
  const manifest = resolve(outputDirectory, `${base}.manifest.json`);

  print(`Creating encrypted-transport logical backup: ${basename(archive)}`);
  try {
    runTool(
      "pg_dump",
      [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--schema=public",
        "--schema=drizzle",
        `--file=${partialArchive}`,
      ],
      databaseUrl,
    );
    await chmod(partialArchive, 0o600);
    await rename(partialArchive, archive);
    const archiveStat = await stat(archive);
    const digest = await sha256(archive);
    await writeFile(
      manifest,
      `${JSON.stringify(
        {
          format: "riftwatch-logical-backup-v1",
          createdAt: new Date().toISOString(),
          schemas: ["public", "drizzle"],
          postgresServerMajor: serverMajor,
          pgDumpMajor: clientMajor,
          archive: basename(archive),
          bytes: archiveStat.size,
          sha256: digest,
        },
        null,
        2,
      )}\n`,
      { mode: 0o600 },
    );
    await chmod(manifest, 0o600);
    print(`✓ Backup created: ${archive}`);
    print(`✓ Integrity manifest: ${manifest}`);
    print("Copy both files to a separate encrypted location.");
  } catch (error) {
    await unlink(partialArchive).catch(() => undefined);
    throw error;
  }
}

function temporaryDatabaseUrl(databaseUrl: string, databaseName: string) {
  const url = new URL(databaseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function quotedIdentifier(identifier: string) {
  if (!/^riftwatch_restore_verify_[a-z0-9_]+$/.test(identifier)) {
    fail("Refusing an unsafe temporary database name");
  }
  return `"${identifier}"`;
}

async function verifyArchiveIntegrity(file: string) {
  const manifestPath = file.replace(/\.dump$/, ".manifest.json");
  let manifest: unknown;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    fail(`Integrity manifest not found or invalid: ${manifestPath}`);
  }
  if (
    typeof manifest !== "object" ||
    manifest === null ||
    !("sha256" in manifest) ||
    typeof manifest.sha256 !== "string"
  ) {
    fail("Integrity manifest does not contain a SHA-256 digest");
  }
  if ((await sha256(file)) !== manifest.sha256) {
    fail("Backup checksum does not match its integrity manifest");
  }
}

async function verifyRestore() {
  const fileValue = valueFor("--file");
  if (!fileValue) fail("Pass a backup archive with --file");
  const archive = resolve(fileValue);
  await stat(archive).catch(() => fail(`Backup archive not found: ${archive}`));
  await verifyArchiveIntegrity(archive);
  requireTool("pg_restore");

  const databaseUrl =
    process.env.DATABASE_URL_RECOVERY || process.env.DATABASE_URL;
  if (!databaseUrl) fail("DATABASE_URL_RECOVERY or DATABASE_URL is required");
  if (!isLoopback(databaseUrl)) {
    fail("Restore verification only runs against loopback PostgreSQL");
  }

  const databaseName = `riftwatch_restore_verify_${Date.now()}_${randomBytes(3).toString("hex")}`;
  const maintenanceUrl = temporaryDatabaseUrl(databaseUrl, "postgres");
  const restoreUrl = temporaryDatabaseUrl(databaseUrl, databaseName);
  const maintenance = postgres(maintenanceUrl, { max: 1, prepare: false });
  let restored: ReturnType<typeof postgres> | undefined;

  try {
    await maintenance.unsafe(
      `create database ${quotedIdentifier(databaseName)}`,
    );
    print(`Restoring into disposable local database ${databaseName}…`);
    runTool(
      "pg_restore",
      [
        "--exit-on-error",
        "--no-owner",
        "--no-privileges",
        `--dbname=${databaseName}`,
        archive,
      ],
      restoreUrl,
    );

    restored = postgres(restoreUrl, { max: 1, prepare: false });
    const requiredRelations = [
      "public.users",
      "public.watches",
      "public.alerts",
      "public.alert_feedback",
      "drizzle.__drizzle_migrations",
    ] as const;
    for (const relation of requiredRelations) {
      const [row] = await restored<Array<{ relation: string | null }>>`
        select to_regclass(${relation})::text as relation
      `;
      if (!row?.relation) fail(`Restored archive is missing ${relation}`);
    }
    await restored`select count(*) from public.users`;
    await restored`select count(*) from public.alerts`;
    await restored`select count(*) from drizzle.__drizzle_migrations`;
    print("✓ Backup checksum is valid");
    print(
      "✓ Schema, migration history, and core data are queryable after restore",
    );
  } finally {
    if (restored) await restored.end();
    await maintenance
      .unsafe(
        `drop database if exists ${quotedIdentifier(databaseName)} with (force)`,
      )
      .catch(() => undefined);
    await maintenance.end();
  }
  print("✓ Disposable restore database removed");
}

function help() {
  print("Riftwatch database recovery");
  print("");
  print("pnpm db:backup -- --output <external-directory> [--allow-hosted]");
  print("pnpm db:restore:verify -- --file <archive.dump>");
  print("");
  print("Restore verification creates and removes an isolated local database.");
}

try {
  if (command === "help" || hasFlag("--help")) help();
  else if (command === "backup") await backup();
  else if (command === "verify") await verifyRestore();
  else help();
} catch (error) {
  const message =
    error instanceof RecoveryCommandError
      ? error.message
      : "Database recovery command failed without exposing connection details";
  process.stderr.write(`✗ ${message}\n`);
  process.exitCode = 1;
}

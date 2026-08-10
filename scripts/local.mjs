#!/usr/bin/env node

import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, ".env.local");
const envExample = path.join(root, ".env.example");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const command = process.argv[2] ?? "help";
const commandArgs = process.argv.slice(3);
const extraArgs = commandArgs[0] === "--" ? commandArgs.slice(1) : commandArgs;

process.chdir(root);

function print(message = "") {
  process.stdout.write(`${message}\n`);
}

function fail(message) {
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
}

function run(program, args, options = {}) {
  const result = spawnSync(program, args, {
    cwd: root,
    env: process.env,
    stdio: options.capture ? "pipe" : "inherit",
    encoding: options.capture ? "utf8" : undefined,
  });
  if (result.error) {
    if (options.allowFailure) return result;
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${program} ${args.join(" ")} exited with ${result.status}`,
    );
  }
  return result;
}

function runInteractive(program, args) {
  const child = spawn(program, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => child.kill(signal));
  }
  child.once("exit", (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
  });
}

function ensureLocalEnv() {
  if (existsSync(envFile)) return false;
  const authSecret = randomBytes(32).toString("hex");
  const cronSecret = randomBytes(24).toString("hex");
  const contents = readFileSync(envExample, "utf8")
    .replace(
      "AUTH_SECRET=replace-with-at-least-32-random-characters",
      `AUTH_SECRET=${authSecret}`,
    )
    .replace(
      "CRON_SECRET=replace-with-at-least-32-random-characters",
      `CRON_SECRET=${cronSecret}`,
    );
  writeFileSync(envFile, contents, { encoding: "utf8", mode: 0o600 });
  chmodSync(envFile, 0o600);
  print("Created .env.local with fresh local-only auth and cron secrets.");
  print("Add CARD_TRADER_AUTH_TOKEN before synchronizing or scanning.");
  return true;
}

function loadLocalEnv() {
  loadEnvConfig(root, true);
}

function checkCommand(program, args, label) {
  const result = run(program, args, { capture: true, allowFailure: true });
  if (result.status !== 0) {
    fail(`${label} is unavailable.`);
    return false;
  }
  const version = result.stdout?.trim().split("\n")[0];
  print(`✓ ${label}${version ? `: ${version}` : ""}`);
  return true;
}

function validateEnvironment({ requireMarketplace = false } = {}) {
  const required = [
    "DATABASE_URL",
    "AUTH_SECRET",
    "ADMIN_EMAIL",
    "CRON_SECRET",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if ((process.env.AUTH_SECRET?.length ?? 0) < 16) {
    missing.push("AUTH_SECRET (minimum 16 characters)");
  }
  if ((process.env.CRON_SECRET?.length ?? 0) < 16) {
    missing.push("CRON_SECRET (minimum 16 characters)");
  }
  if (requireMarketplace && !process.env.CARD_TRADER_AUTH_TOKEN) {
    missing.push("CARD_TRADER_AUTH_TOKEN");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing or invalid environment values: ${[...new Set(missing)].join(", ")}`,
    );
  }
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!new Set(["localhost", "127.0.0.1", "[::1]"]).has(databaseUrl.hostname)) {
    throw new Error(
      "Local lifecycle commands refuse a non-local DATABASE_URL; use deployment tooling explicitly for hosted databases",
    );
  }
  print("✓ Required local environment values are configured.");
  if (!process.env.CARD_TRADER_AUTH_TOKEN) {
    print(
      "! CARD_TRADER_AUTH_TOKEN is absent; catalog and market calls will fail.",
    );
  } else {
    print("✓ CardTrader server credential is available (value not displayed).");
  }
}

function checkPrerequisites() {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  if (nodeMajor !== 24)
    fail(`Node.js 24.x is required; found ${process.versions.node}.`);
  else print(`✓ Node.js: ${process.versions.node}`);
  const pnpmOk = checkCommand(pnpm, ["--version"], "pnpm");
  const dockerOk = checkCommand("docker", ["--version"], "Docker");
  const composeOk = checkCommand(
    "docker",
    ["compose", "version"],
    "Docker Compose",
  );
  if (!pnpmOk || !dockerOk || !composeOk || process.exitCode) {
    throw new Error(
      "Install or correct the prerequisites above before continuing",
    );
  }
  const daemon = run("docker", ["info"], { capture: true, allowFailure: true });
  if (daemon.status !== 0) {
    throw new Error("Docker is installed, but its daemon is not reachable");
  }
  print("✓ Docker daemon is reachable.");
}

function databaseUp() {
  print("Starting PostgreSQL…");
  run("docker", ["compose", "up", "-d", "--wait", "postgres"]);
}

function migrateAndSeed() {
  print("Applying database migrations…");
  run(pnpm, ["db:migrate"]);
  print("Seeding the development administrator…");
  run(pnpm, ["db:seed"]);
}

function prepareLocalEnvironment() {
  ensureLocalEnv();
  loadLocalEnv();
  validateEnvironment();
  databaseUp();
  migrateAndSeed();
}

async function triggerCron(kind) {
  loadLocalEnv();
  validateEnvironment({ requireMarketplace: true });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = await fetch(`${baseUrl}/api/cron/${kind}`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    signal: AbortSignal.timeout(245_000),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Cron request failed (${response.status}): ${body}`);
  }
  print(body);
}

async function showStatus() {
  print("Docker services:");
  run("docker", ["compose", "ps"]);
  const database = run(
    "docker",
    [
      "compose",
      "exec",
      "-T",
      "postgres",
      "pg_isready",
      "-U",
      "riftwatch",
      "-d",
      "riftwatch",
    ],
    { capture: true, allowFailure: true },
  );
  print(
    database.status === 0
      ? "✓ PostgreSQL is accepting connections."
      : "! PostgreSQL is not accepting connections.",
  );

  loadLocalEnv();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      signal: AbortSignal.timeout(1_500),
    });
    const health = await response.json();
    print(
      response.ok
        ? `✓ Riftwatch is reachable at ${baseUrl} (${health.database}).`
        : `! Riftwatch returned HTTP ${response.status}.`,
    );
  } catch {
    print(`! Riftwatch is not reachable at ${baseUrl}.`);
  }
}

async function confirmReset() {
  if (extraArgs.includes("--yes")) return true;
  if (!process.stdin.isTTY) return false;
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    "Delete the local Riftwatch PostgreSQL volume and rebuild it? Type 'reset': ",
  );
  prompt.close();
  return answer === "reset";
}

function printHelp() {
  print(`Riftwatch local environment

Usage: node scripts/local.mjs <command>

Commands:
  setup          Create .env.local if absent, start DB, migrate, and seed
  dev            Prepare the stack and start the Next.js Turbopack server
  doctor         Check tools, Docker, and environment configuration
  up             Start PostgreSQL and wait until healthy
  down           Stop containers while preserving database data
  restart        Restart PostgreSQL and wait until healthy
  status         Show container, PostgreSQL, and application health
  logs           Follow PostgreSQL container logs
  db-shell       Open psql in the local database
  reset [--yes]  Delete the local DB volume, then migrate and seed again
  cron-catalog   Trigger catalog synchronization through the local API
  cron-scan      Trigger a due-watch scan through the local API
  check          Run formatting, lint, types, and unit tests
  check-all      Run all checks, build, integration, and browser tests`);
}

try {
  switch (command) {
    case "setup":
      checkPrerequisites();
      prepareLocalEnvironment();
      await showStatus();
      print("Local setup complete. Run `pnpm dev` to start Riftwatch.");
      break;
    case "dev":
      checkPrerequisites();
      prepareLocalEnvironment();
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      print(`Starting Riftwatch at ${appUrl}…`);
      if (process.env.AUTH_ENABLE_DEV_PROVIDER === "true") {
        print("");
        print("Development sign-in:");
        print(`  Email: ${process.env.ADMIN_EMAIL}`);
        print("  Password: none");
        print(`  URL: ${appUrl}/sign-in`);
        print("");
      }
      runInteractive(pnpm, ["dev:app", ...extraArgs]);
      break;
    case "doctor":
      checkPrerequisites();
      if (!existsSync(envFile))
        throw new Error(".env.local is absent; run `pnpm local:setup`");
      loadLocalEnv();
      validateEnvironment();
      await showStatus();
      break;
    case "up":
      databaseUp();
      break;
    case "down":
      run("docker", ["compose", "down"]);
      break;
    case "restart":
      run("docker", ["compose", "restart", "postgres"]);
      run("docker", ["compose", "up", "-d", "--wait", "postgres"]);
      break;
    case "status":
      await showStatus();
      break;
    case "logs":
      runInteractive("docker", ["compose", "logs", "--follow", "postgres"]);
      break;
    case "db-shell":
      runInteractive("docker", [
        "compose",
        "exec",
        "postgres",
        "psql",
        "-U",
        "riftwatch",
        "-d",
        "riftwatch",
      ]);
      break;
    case "reset":
      if (!(await confirmReset())) {
        throw new Error(
          "Reset cancelled; pass --yes or type 'reset' interactively",
        );
      }
      run("docker", ["compose", "down", "--volumes", "--remove-orphans"]);
      prepareLocalEnvironment();
      print("Local database reset complete.");
      break;
    case "cron-catalog":
      await triggerCron("catalog");
      break;
    case "cron-scan":
      await triggerCron("scan");
      break;
    case "check":
      for (const script of [
        "format:check",
        "docs:check",
        "lint",
        "typecheck",
        "test",
      ]) {
        run(pnpm, [script]);
      }
      break;
    case "check-all":
      for (const script of [
        "format:check",
        "docs:check",
        "lint",
        "test",
        "build",
        "typecheck",
        "test:integration",
        "test:e2e",
      ]) {
        run(pnpm, [script]);
      }
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      printHelp();
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  fail(
    error instanceof Error ? error.message : "Unknown local environment error",
  );
}

#!/usr/bin/env node

import { spawn } from "node:child_process";
import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const hasApproval = process.argv.slice(2).includes("--allow-hosted");
const connectionUrl = process.env.DATABASE_URL_DIRECT;

function fail(message: string): never {
  process.stderr.write(`Error: ${message}\n`);
  process.exit(1);
}

if (!hasApproval) {
  fail(
    "Refusing a hosted migration without --allow-hosted; this operation changes the selected database",
  );
}
if (!connectionUrl) {
  fail(
    "DATABASE_URL_DIRECT must be exported by the invoking shell; it was not read from a command argument or file",
  );
}

let hostname: string;
try {
  hostname = new URL(connectionUrl).hostname;
} catch {
  fail("DATABASE_URL_DIRECT must be a valid PostgreSQL connection URL");
}
if (new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname)) {
  fail("db:migrate:remote refuses loopback DATABASE_URL_DIRECT targets");
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(command, ["db:migrate"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});

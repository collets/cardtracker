#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

function run(args, env = process.env) {
  const result = spawnSync(pnpm, args, {
    cwd: root,
    env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["css:build"]);
const buildArgs = process.argv.slice(2);
run(
  [
    "exec",
    "next",
    "build",
    ...(buildArgs[0] === "--" ? buildArgs.slice(1) : buildArgs),
  ],
  {
    ...process.env,
    AUTH_ENABLE_DEV_PROVIDER: "false",
  },
);

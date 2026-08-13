#!/usr/bin/env node

import { spawn } from "node:child_process";
import { schedulerSecretName } from "./cloudflare-scheduler-secret-args.mjs";

const secretName = schedulerSecretName(process.argv.slice(2));

if (!secretName) {
  process.stderr.write(
    "Usage: pnpm cloudflare:scheduler:secret -- <RIFTWATCH_SCAN_URL|CRON_SECRET|SCHEDULER_ENABLED>\n",
  );
  process.stderr.write(
    "The value is entered only at Wrangler's interactive prompt.\n",
  );
  process.exit(1);
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const child = spawn(
  pnpm,
  [
    "dlx",
    "wrangler@4",
    "secret",
    "put",
    secretName,
    "--config",
    "cloudflare/market-scheduler/wrangler.jsonc",
  ],
  { stdio: "inherit" },
);
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});

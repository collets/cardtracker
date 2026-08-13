#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import worker, {
  marketScanUrl,
} from "../cloudflare/market-scheduler/src/index.mjs";
import { schedulerSecretName } from "./cloudflare-scheduler-secret-args.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(
  readFileSync(
    path.join(root, "cloudflare/market-scheduler/wrangler.jsonc"),
    "utf8",
  ).replace(/,\s*([}\]])/g, "$1"),
);

assert.equal(config.workers_dev, false);
assert.deepEqual(config.triggers?.crons, ["*/5 * * * *"]);
assert.equal(
  marketScanUrl("https://riftwatch.example/api/cron/scan").toString(),
  "https://riftwatch.example/api/cron/scan",
);
for (const invalidUrl of [
  "http://riftwatch.example/api/cron/scan",
  "https://riftwatch.example/api/cron/catalog",
  "https://riftwatch.example/api/cron/scan?unsafe=true",
  "https://token@riftwatch.example/api/cron/scan",
]) {
  assert.throws(() => marketScanUrl(invalidUrl));
}

let requested = false;
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => {
  requested = true;
  return new Response();
};
try {
  await worker.scheduled({ noRetry() {} }, { SCHEDULER_ENABLED: "false" });
} finally {
  globalThis.fetch = originalFetch;
}
assert.equal(requested, false);

assert.equal(
  schedulerSecretName(["--", "RIFTWATCH_SCAN_URL"]),
  "RIFTWATCH_SCAN_URL",
);
assert.equal(schedulerSecretName(["RIFTWATCH_SCAN_URL", "unsafe"]), null);

process.stdout.write(
  "Cloudflare scheduler configuration is valid and disabled by default.\n",
);

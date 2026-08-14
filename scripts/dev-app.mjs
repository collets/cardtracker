#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const suppliedArgs = process.argv.slice(2);
const nextArgs =
  suppliedArgs[0] === "--" ? suppliedArgs.slice(1) : suppliedArgs;
let stopping = false;

function start(args) {
  return spawn(pnpm, args, {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
}

const styles = start([
  "exec",
  "tailwindcss",
  "-i",
  "src/styles/tailwind.css",
  "-o",
  "src/app/globals.css",
  "--watch",
]);
const app = start(["exec", "next", "dev", ...nextArgs]);

function stop(signal) {
  if (stopping) return;
  stopping = true;
  styles.kill(signal);
  app.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => stop(signal));
}

styles.once("exit", (code, signal) => {
  if (!stopping) {
    stop("SIGTERM");
    process.exitCode = signal ? 1 : (code ?? 1);
  }
});

app.once("exit", (code, signal) => {
  stop("SIGTERM");
  process.exitCode = signal ? 1 : (code ?? 1);
});

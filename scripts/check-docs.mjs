#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ignoredDirectories = new Set([
  ".git",
  ".next",
  "node_modules",
  "playwright-report",
  "test-results",
]);

function markdownFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const target = path.join(directory, entry);
    const relative = path.relative(root, target);
    if (ignoredDirectories.has(entry) || relative.startsWith(".agents"))
      return [];
    if (statSync(target).isDirectory()) return markdownFiles(target);
    return target.endsWith(".md") ? [target] : [];
  });
}

const packageJson = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
);
const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
const pnpmBuiltins = new Set(["add", "exec", "install", "run"]);
const errors = [];

for (const file of markdownFiles(root)) {
  const contents = readFileSync(file, "utf8");
  const relativeFile = path.relative(root, file);

  for (const match of contents.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const rawTarget = match[1]?.trim();
    if (
      !rawTarget ||
      rawTarget.startsWith("#") ||
      /^[a-z]+:/i.test(rawTarget)
    ) {
      continue;
    }
    const cleanTarget = decodeURIComponent(rawTarget.split("#")[0] ?? "");
    if (!cleanTarget) continue;
    const resolved = path.resolve(path.dirname(file), cleanTarget);
    if (!existsSync(resolved)) {
      errors.push(`${relativeFile}: missing link target ${rawTarget}`);
    }
  }

  const commandSnippets = [
    ...[...contents.matchAll(/`([^`\n]+)`/g)].map((match) => match[1] ?? ""),
    ...[...contents.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map(
      (match) => match[1] ?? "",
    ),
  ];
  for (const snippet of commandSnippets) {
    for (const match of snippet.matchAll(/(?:^|\s)pnpm\s+([a-zA-Z][\w:-]*)/g)) {
      const referencedCommand = match[1];
      if (
        referencedCommand &&
        !scripts.has(referencedCommand) &&
        !pnpmBuiltins.has(referencedCommand)
      ) {
        errors.push(
          `${relativeFile}: unknown package command pnpm ${referencedCommand}`,
        );
      }
    }
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write("Documentation links and pnpm commands are valid.\n");

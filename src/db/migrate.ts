import "@/envConfig";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pendingMigrationTags,
  type MigrationJournalEntry,
} from "@/db/migration-report";
import { getServerEnv, requireEnv } from "@/lib/env";

const env = getServerEnv();
const connectionUrl = env.DATABASE_URL_DIRECT || requireEnv("DATABASE_URL");
const sql = postgres(connectionUrl, { max: 1, prepare: false });

async function readMigrationJournal(): Promise<MigrationJournalEntry[]> {
  const journalPath = path.join(
    process.cwd(),
    "drizzle",
    "meta",
    "_journal.json",
  );
  const journal = JSON.parse(await readFile(journalPath, "utf8")) as {
    entries?: unknown;
  };

  if (!Array.isArray(journal.entries)) {
    throw new Error(
      "Drizzle migration journal does not contain an entries array.",
    );
  }

  return journal.entries.filter(
    (entry): entry is MigrationJournalEntry =>
      typeof entry === "object" &&
      entry !== null &&
      "tag" in entry &&
      "when" in entry &&
      typeof entry.tag === "string" &&
      typeof entry.when === "number",
  );
}

async function lastAppliedMigrationAt() {
  try {
    const [lastMigration] = await sql<{ created_at: number | string }[]>`
      select created_at
      from drizzle.__drizzle_migrations
      order by created_at desc
      limit 1
    `;
    const createdAt = Number(lastMigration?.created_at);

    return Number.isSafeInteger(createdAt) ? createdAt : null;
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (code === "3F000" || code === "42P01") {
      return null;
    }

    throw error;
  }
}

try {
  const [journal, lastAppliedAt] = await Promise.all([
    readMigrationJournal(),
    lastAppliedMigrationAt(),
  ]);
  const pending = pendingMigrationTags(journal, lastAppliedAt);

  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });

  if (pending.length === 0) {
    console.info("✓ No pending migrations.");
  } else {
    for (const tag of pending) {
      console.info(`✓ Executed migration: ${tag}`);
    }
  }
} finally {
  await sql.end();
}

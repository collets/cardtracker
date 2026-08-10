import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/db/schema";
import { requireEnv } from "@/lib/env";

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  riftwatchSql?: Sql;
  riftwatchDb?: Database;
};

export function getSql(): Sql {
  if (!globalForDb.riftwatchSql) {
    globalForDb.riftwatchSql = postgres(requireEnv("DATABASE_URL"), {
      max: process.env.NODE_ENV === "production" ? 10 : 5,
      prepare: false,
    });
  }
  return globalForDb.riftwatchSql;
}

export function getDb(): Database {
  globalForDb.riftwatchDb ??= drizzle(getSql(), { schema });
  return globalForDb.riftwatchDb;
}

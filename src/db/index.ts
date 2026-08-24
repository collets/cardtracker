import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import * as schema from "@/db/schema";
import { requireEnv } from "@/lib/env";

type Database = PostgresJsDatabase<typeof schema>;

export function databasePoolLimit(nodeEnv: string | undefined) {
  return nodeEnv === "production" ? 3 : 5;
}

export const DATABASE_POOL_LIMIT = databasePoolLimit(process.env.NODE_ENV);

export const DATABASE_CONNECTION_OPTIONS = {
  max: DATABASE_POOL_LIMIT,
  prepare: false,
  connect_timeout: 10,
  idle_timeout: 20,
  max_lifetime: 60 * 10,
  connection: {
    application_name: "riftwatch",
  },
} as const;

const globalForDb = globalThis as unknown as {
  riftwatchSql?: Sql;
  riftwatchDb?: Database;
};

export function getSql(): Sql {
  if (!globalForDb.riftwatchSql) {
    globalForDb.riftwatchSql = postgres(
      requireEnv("DATABASE_URL"),
      DATABASE_CONNECTION_OPTIONS,
    );
  }
  return globalForDb.riftwatchSql;
}

export function getDb(): Database {
  globalForDb.riftwatchDb ??= drizzle(getSql(), { schema });
  return globalForDb.riftwatchDb;
}

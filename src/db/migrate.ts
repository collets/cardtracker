import "@/envConfig";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getServerEnv, requireEnv } from "@/lib/env";

const env = getServerEnv();
const connectionUrl = env.DATABASE_URL_DIRECT || requireEnv("DATABASE_URL");
const sql = postgres(connectionUrl, { max: 1, prepare: false });

try {
  await migrate(drizzle(sql), { migrationsFolder: "drizzle" });
} finally {
  await sql.end();
}

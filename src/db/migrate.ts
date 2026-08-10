import "@/envConfig";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb, getSql } from "@/db";

await migrate(getDb(), { migrationsFolder: "drizzle" });
await getSql().end();

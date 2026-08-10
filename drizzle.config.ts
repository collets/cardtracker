import "./src/envConfig";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL_DIRECT ??
      "postgresql://riftwatch:riftwatch@localhost:5432/riftwatch",
  },
  strict: true,
  verbose: true,
});

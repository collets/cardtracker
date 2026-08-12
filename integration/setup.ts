import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

process.env.DATABASE_URL ??=
  "postgresql://riftwatch:riftwatch@127.0.0.1:5432/riftwatch";
process.env.TELEGRAM_BOT_TOKEN ??= "integration-test-token";
process.env.TELEGRAM_BOT_USERNAME ??= "RiftwatchIntegrationBot";
process.env.NEXT_PUBLIC_APP_URL ??= "http://127.0.0.1:3000";

const hostname = new URL(process.env.DATABASE_URL).hostname;
if (!new Set(["localhost", "127.0.0.1", "[::1]", "::1"]).has(hostname)) {
  throw new Error(
    "Integration tests refuse non-local DATABASE_URL values to protect hosted data",
  );
}

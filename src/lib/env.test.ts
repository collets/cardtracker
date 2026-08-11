import { describe, expect, it } from "vitest";
import { productionEnvironmentIssues } from "@/lib/env";

const validProductionEnvironment = {
  NEXT_PUBLIC_APP_URL: "https://riftwatch.example.com",
  DATABASE_URL: "postgresql://runtime.example.com/riftwatch",
  DATABASE_URL_DIRECT: "postgresql://direct.example.com/riftwatch",
  AUTH_SECRET: "a".repeat(32),
  AUTH_GOOGLE_ID: "google-client",
  AUTH_GOOGLE_SECRET: "google-secret",
  AUTH_ENABLE_DEV_PROVIDER: "false",
  ADMIN_EMAIL: "admin@riftwatch.com",
  CARD_TRADER_AUTH_TOKEN: "cardtrader-token",
  CRON_SECRET: "c".repeat(32),
};

describe("productionEnvironmentIssues", () => {
  it("accepts the required production configuration", () => {
    expect(productionEnvironmentIssues(validProductionEnvironment)).toEqual([]);
  });

  it("rejects development authentication and missing deployment values", () => {
    const issues = productionEnvironmentIssues({
      AUTH_ENABLE_DEV_PROVIDER: "true",
    });

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("AUTH_ENABLE_DEV_PROVIDER"),
      ]),
    );
  });

  it("requires Telegram values as one complete set", () => {
    const issues = productionEnvironmentIssues({
      ...validProductionEnvironment,
      TELEGRAM_BOT_TOKEN: "bot-token",
    });

    expect(issues).toContain(
      "Telegram: TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and TELEGRAM_WEBHOOK_SECRET must be configured together",
    );
  });

  it("requires a direct database URL only for migration readiness", () => {
    const runtimeEnvironment = {
      ...validProductionEnvironment,
      DATABASE_URL_DIRECT: undefined,
    };

    expect(productionEnvironmentIssues(runtimeEnvironment)).toEqual([]);
    expect(
      productionEnvironmentIssues(runtimeEnvironment, {
        requireDirectDatabase: true,
      }),
    ).toContain("DATABASE_URL_DIRECT: required for hosted migrations");
  });
});

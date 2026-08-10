import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    launchOptions: process.env.PLAYWRIGHT_CHROME_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_PATH }
      : undefined,
  },
  webServer: {
    command: "pnpm dev:app",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://riftwatch:riftwatch@127.0.0.1:5432/riftwatch",
      AUTH_SECRET:
        process.env.AUTH_SECRET ??
        "playwright-only-secret-at-least-32-characters",
      AUTH_ENABLE_DEV_PROVIDER: "false",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

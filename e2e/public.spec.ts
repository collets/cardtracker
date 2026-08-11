import { expect, test } from "@playwright/test";

test("public landing page explains the product", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.headers()["content-security-policy"]).toContain(
    "strict-dynamic",
  );
  await expect(
    page.getByRole("heading", { name: /catch the listing/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /open riftwatch/i }),
  ).toBeVisible();
});

test("responses include the browser security baseline", async ({ request }) => {
  const first = await request.get("/");
  const second = await request.get("/");
  const firstPolicy = first.headers()["content-security-policy"];

  expect(firstPolicy).toContain("frame-ancestors 'none'");
  expect(second.headers()["content-security-policy"]).not.toBe(firstPolicy);
  expect(first.headers()["x-content-type-options"]).toBe("nosniff");
  expect(first.headers()["x-frame-options"]).toBe("DENY");
  expect(first.headers()["referrer-policy"]).toBe(
    "strict-origin-when-cross-origin",
  );
  expect(first.headers()["permissions-policy"]).toContain("camera=()");
});

test("sign-in page does not expose server credentials", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(
    page.getByRole("heading", { name: /enter riftwatch/i }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    "CARD_TRADER_AUTH_TOKEN",
  );
});

test("health endpoint confirms database readiness", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    database: "connected",
  });
});

test("cron routes reject missing and malformed bearer credentials", async ({
  request,
}) => {
  for (const path of ["/api/cron/catalog", "/api/cron/scan"]) {
    const missing = await request.get(path);
    expect(missing.status()).toBe(401);
    expect(missing.headers()["cache-control"]).toContain("no-store");

    const malformed = await request.get(path, {
      headers: { Authorization: "Bearer wrong trailing" },
    });
    expect(malformed.status()).toBe(401);
  }
});

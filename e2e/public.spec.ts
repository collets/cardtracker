import { expect, test } from "@playwright/test";

test("public landing page explains the product", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /catch the listing/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /open riftwatch/i }),
  ).toBeVisible();
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

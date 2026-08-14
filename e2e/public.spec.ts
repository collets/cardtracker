import { expect, test } from "@playwright/test";

test("public landing page explains the product", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /catch the listing/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /invited\? sign in/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /a low price only matters when the comparison is fair/i,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: /from catalog search to a useful alert/i,
    }),
  ).toBeVisible();
  await expect(page.getByText("No automatic purchases")).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Lux - Crownguard, Crystal Rose Alternate Art",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/not affiliated with or endorsed by/i),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("heading", { name: /catch the listing/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
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

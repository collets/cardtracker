import { expect, test, type Page } from "@playwright/test";
import {
  e2eAdminEmail,
  e2eAlertBlueprintId,
  e2eUserEmail,
  e2eWatchBlueprintId,
} from "./database";

async function signIn(page: Page, email: string) {
  await page.goto("/sign-in");
  await page.getByPlaceholder("Invited development email").fill(email);
  await page.getByRole("button", { name: "Development sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe.serial("authenticated MVP", () => {
  test("redirects anonymous users to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("admin discovers, creates, updates, and removes a watch", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin");
    await expect(
      page.getByRole("heading", { name: "Administration" }),
    ).toBeVisible();

    await page.goto("/cards?q=E2E+Watch+Card");
    await expect(
      page.locator(`a[href="/cards/${e2eWatchBlueprintId}"]`),
    ).toBeVisible();
    await page.goto(`/cards/${e2eWatchBlueprintId}`);
    await page.getByRole("button", { name: "Add to watchlist" }).click();
    await expect(page).toHaveURL(/\/dashboard\?created=1/);
    await expect(page.getByText("E2E Watch Card")).toBeVisible();

    await page.getByRole("link", { name: "Details" }).click();
    await page.getByLabel("Minimum discount (%)").fill("25");
    await page.getByRole("button", { name: "Save filters" }).click();
    await expect(page.getByLabel("Minimum discount (%)")).toHaveValue("25");

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Remove E2E Watch Card" }).click();
    await expect(page.getByText("E2E Watch Card")).not.toBeVisible();
  });

  test("normal user cannot access admin and can mark an alert read", async ({
    page,
  }) => {
    await signIn(page, e2eUserEmail);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/alerts");
    await expect(page.getByText("E2E Alert Card")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "CardTrader" }),
    ).toHaveAttribute(
      "href",
      `https://www.cardtrader.com/en/cards/${e2eAlertBlueprintId}`,
    );
    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(
      page.getByRole("button", { name: "Mark read" }),
    ).not.toBeVisible();
  });

  test("admin can quick-add and bulk-add catalog printings", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/cards?q=E2E+Watch+Card");

    await page
      .getByRole("button", {
        name: "Add E2E Watch Card to watchlist with default options",
      })
      .click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Card added to your watchlist" }),
    ).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("E2E Watch Card")).toBeVisible();
    await page.getByRole("button", { name: "Remove E2E Watch Card" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Watch removed" }),
    ).toBeVisible();

    await page.goto("/cards?q=E2E+Watch+Card");
    await page
      .getByRole("checkbox", { name: /^Select E2E Watch Card,/ })
      .check();
    await expect(page.getByText("1 selected across the catalog")).toBeVisible();

    await page.goto("/cards?q=E2E+Alert+Card");
    await expect(page.getByText("1 selected across the catalog")).toBeVisible();
    await page.getByRole("checkbox", { name: "Select this page" }).check();
    await expect(page.getByText("2 selected across the catalog")).toBeVisible();
    await page
      .getByRole("button", { name: "Add selected cards to watchlist" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Add 2 cards to your watchlist" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Add 2 watches" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "2 cards added to your watchlist" }),
    ).toBeVisible();
    await expect(
      page.getByText("2 selected across the catalog"),
    ).not.toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByText("E2E Watch Card")).toBeVisible();
    await expect(page.getByText("E2E Alert Card")).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan all" })).toBeVisible();
  });

  test("user can save marketplace defaults", async ({ page }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/settings");
    await page.getByRole("checkbox", { name: "French" }).check();
    await page.getByRole("button", { name: "Save defaults" }).click();
    await expect(page.getByRole("checkbox", { name: "French" })).toBeChecked();
  });
});

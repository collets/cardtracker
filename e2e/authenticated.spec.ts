import { expect, test, type Page } from "@playwright/test";
import {
  e2eAcceptedInviteEmail,
  e2eAdminEmail,
  e2ePendingInviteEmail,
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

  test("admin can delete a pending invitation but not an accepted one", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin");

    await expect(page.getByText(e2ePendingInviteEmail)).toBeVisible();
    await expect(page.getByText(e2eAcceptedInviteEmail)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Delete invitation for ${e2eAcceptedInviteEmail}`,
      }),
    ).toHaveCount(0);

    await page
      .getByRole("button", {
        name: `Delete invitation for ${e2ePendingInviteEmail}`,
      })
      .click();

    await expect(page.getByText(e2ePendingInviteEmail)).not.toBeVisible();
    await expect(page.getByText(e2eAcceptedInviteEmail)).toBeVisible();
    await expect(page.getByText("invitation.revoke").first()).toBeVisible();
  });

  test("normal user cannot access admin and can mark an alert read", async ({
    page,
  }) => {
    await signIn(page, e2eUserEmail);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto("/alerts");
    await expect(page.getByText("E2E Alert Card")).toBeVisible();
    await page.getByRole("button", { name: "Mark read" }).click();
    await expect(
      page.getByRole("button", { name: "Mark read" }),
    ).not.toBeVisible();
  });

  test("user can save marketplace defaults", async ({ page }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/settings");
    await page.getByRole("checkbox", { name: "French" }).check();
    await page.getByRole("button", { name: "Save defaults" }).click();
    await expect(page.getByRole("checkbox", { name: "French" })).toBeChecked();
  });
});

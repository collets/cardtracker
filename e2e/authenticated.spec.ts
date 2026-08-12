import { expect, test, type Page } from "@playwright/test";
import {
  e2eAcceptedInviteEmail,
  e2eAdminEmail,
  e2eAlertBlueprintId,
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

  test("admin can revoke a pending invitation but not accepted history", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin");

    await expect(page.getByText(e2ePendingInviteEmail)).toBeVisible();
    await expect(page.getByText(e2eAcceptedInviteEmail)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: `Revoke invitation for ${e2eAcceptedInviteEmail}`,
      }),
    ).toHaveCount(0);

    await page
      .getByRole("button", {
        name: `Revoke invitation for ${e2ePendingInviteEmail}`,
      })
      .click();

    await expect(
      page.getByRole("status").filter({ hasText: "Invitation revoked" }),
    ).toBeVisible();
    await expect(page.getByText(e2ePendingInviteEmail)).not.toBeVisible();
    await expect(page.getByText(e2eAcceptedInviteEmail)).toBeVisible();
  });

  test("normal user cannot access admin and can rate an alert", async ({
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
    await page.getByRole("button", { name: "Rate alert" }).click();
    await expect(
      page.getByRole("heading", { name: "How useful was this alert?" }),
    ).toBeVisible();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /Bought it/ })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "your feedback was saved" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Feedback: Bought it" }),
    ).toBeVisible();
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
    await expect(page.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await page.goto("/cards");
    const sidebar = page.getByRole("complementary");
    await expect(sidebar).toHaveCSS("position", "sticky");
    await expect(sidebar).toHaveCSS("flex-direction", "column");
    const overviewLink = page.getByRole("link", { name: "Overview" });
    const accountLink = page.getByRole("link", { name: "Account" });
    await expect(accountLink).toBeInViewport();
    await expect(accountLink).toHaveCSS(
      "width",
      await overviewLink.evaluate((element) => getComputedStyle(element).width),
    );

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Account" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await page.getByRole("checkbox", { name: "French" }).check();
    await page.getByRole("button", { name: "Save defaults" }).click();
    await expect(page.getByRole("checkbox", { name: "French" })).toBeChecked();
  });

  test("core application remains usable at a mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    async function expectNoPageOverflow(path: string, authenticated = true) {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      if (dimensions.page > dimensions.viewport + 1) {
        const overflow = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          return [...document.querySelectorAll<HTMLElement>("body *")]
            .map((element) => ({
              tag: element.tagName.toLowerCase(),
              className: element.className,
              text: element.innerText?.slice(0, 80),
              right: Math.round(element.getBoundingClientRect().right),
            }))
            .filter((element) => element.right > viewport + 1)
            .slice(0, 5);
        });
        expect(overflow, `Horizontal overflow on ${path}`).toEqual([]);
      }
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
      if (authenticated) {
        await expect(
          page.getByRole("navigation", { name: "Primary navigation" }),
        ).toBeInViewport();
      }
    }

    await expectNoPageOverflow("/", false);
    await expectNoPageOverflow("/sign-in", false);
    await signIn(page, e2eUserEmail);
    await expectNoPageOverflow("/alerts");
    await page.getByRole("button", { name: /^(Rate alert|Feedback:)/ }).click();
    const feedbackDialog = page.getByRole("dialog");
    await expect(feedbackDialog).toBeInViewport();
    const firstFeedbackOption = feedbackDialog.getByRole("button", {
      name: /Bought it/,
    });
    await expect(firstFeedbackOption).toBeInViewport();
    expect(
      await firstFeedbackOption.evaluate(
        (element) => element.getBoundingClientRect().height,
      ),
    ).toBeGreaterThanOrEqual(56);
    await page.getByRole("button", { name: "Close" }).click();
    await expectNoPageOverflow("/settings");

    await page.context().clearCookies();
    await signIn(page, e2eAdminEmail);
    for (const path of [
      "/dashboard",
      "/cards?q=E2E+Watch+Card",
      `/cards/${e2eWatchBlueprintId}`,
      "/settings",
      "/admin",
    ]) {
      await expectNoPageOverflow(path);
    }

    await page.goto("/dashboard");
    const watchDetails = page.locator('a[href^="/watches/"]').first();
    if ((await watchDetails.count()) > 0) {
      await watchDetails.click();
      await expect(page).toHaveURL(/\/watches\//);
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  });
});

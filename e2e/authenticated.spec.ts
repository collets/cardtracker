import { expect, test, type Page } from "@playwright/test";
import {
  e2eAcceptedInviteEmail,
  e2eAdminEmail,
  e2eAlertBlueprintId,
  e2ePendingInviteEmail,
  e2eThresholdRecommendationId,
  e2eUserEmail,
  e2eWatchBlueprintId,
  cleanE2eAdminWatch,
  resetE2eThresholdRecommendation,
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
    await cleanE2eAdminWatch();
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

  test("admin can enable scheduled diagnostics for a linked user", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin");

    const diagnostics = page.getByRole("checkbox", {
      name: `Scheduled scan diagnostics for ${e2eUserEmail}`,
    });
    await expect(diagnostics).not.toBeChecked();
    await diagnostics.check();
    await diagnostics
      .locator("xpath=ancestor::form")
      .getByRole("button", {
        name: "Save",
      })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "User settings saved" }),
    ).toBeVisible();
    await expect(diagnostics).toBeChecked();
  });

  test("normal user cannot access admin, rate, archive, and restore an alert", async ({
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
    await page.getByRole("link", { name: "History" }).click();
    await expect(
      page.getByRole("button", { name: "Feedback: Bought it" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Mark read" }),
    ).not.toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "watch is still active" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Restore to Inbox" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore to Inbox" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "restored to Inbox" }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Inbox" }).click();
    await expect(page.getByRole("button", { name: "Mark read" })).toBeVisible();
  });

  test("user can review and apply a price-aware threshold suggestion", async ({
    page,
  }) => {
    await resetE2eThresholdRecommendation();
    await signIn(page, e2eUserEmail);
    await expect(
      page.getByRole("heading", { name: "2 items need your attention" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "1 unread deal" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "1 watch suggestion" }),
    ).toBeVisible();
    await page.goto("/alerts?view=recommendations");
    await expect(
      page.getByRole("link", { name: /Recommendations 1/ }),
    ).toBeVisible();
    await expect(page.getByText("E2E Alert Card")).toBeVisible();
    await expect(page.getByText("€5.00")).toBeVisible();
    await expect(page.getByText("€2.00")).toBeVisible();

    await page.getByRole("link", { name: "Review" }).click();
    await expect(page).toHaveURL(
      new RegExp(`recommendation=${e2eThresholdRecommendationId}`),
    );
    await expect(
      page.getByRole("heading", { name: "Use price-aware thresholds?" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Apply suggestion" }).click();
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Suggested thresholds applied" }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Minimum saving (EUR)")).toHaveValue("2");
    await expect(page.getByLabel("Minimum saving (EUR)")).toHaveAttribute(
      "step",
      "0.01",
    );
    await expect(page.getByRole("link", { name: "Alerts" })).toHaveAttribute(
      "aria-description",
      "Alerts: 1 unread deal, 0 pending recommendations",
    );

    await page.goto("/alerts?view=recommendations");
    await expect(
      page.getByText("No threshold suggestions right now"),
    ).toBeVisible();
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
    await expect(
      page.getByRole("button", {
        name: "E2E Watch Card is already in your watchlist",
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("checkbox", {
        name: /E2E Watch Card.*already in watchlist/,
      }),
    ).toBeDisabled();

    await page.goto(`/cards/${e2eWatchBlueprintId}`);
    await expect(
      page.getByRole("button", { name: "Already watching" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("link", { name: "Review watch" }),
    ).toHaveAttribute("href", /\/watches\//);

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
    await expect(
      page.getByRole("checkbox", { name: "Scheduled scan diagnostics" }),
    ).not.toBeChecked();
    await page
      .getByRole("checkbox", { name: "Scheduled scan diagnostics" })
      .check();
    await page.getByRole("button", { name: "Save diagnostics" }).click();
    await expect(
      page.getByRole("checkbox", { name: "Scheduled scan diagnostics" }),
    ).toBeChecked();
    await page.getByRole("checkbox", { name: "French" }).check();
    await page.getByRole("button", { name: "Save defaults" }).click();
    await expect(page.getByRole("checkbox", { name: "French" })).toBeChecked();
  });

  test("admin filters recent runs without losing their page position", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin#recent-runs");
    const recentRuns = page.getByRole("heading", { name: "Recent runs" });
    await expect(recentRuns).toBeInViewport();

    await page.getByRole("combobox", { name: "Run kind" }).click();
    await page.getByRole("option", { name: "market", exact: true }).click();
    await page.getByRole("button", { name: "Apply" }).click();

    await expect(page).toHaveURL(/kind=market/);
    await expect(recentRuns).toBeInViewport();
    const rows = page.locator("table tbody tr");
    await expect(rows).not.toHaveCount(0);
    for (let index = 0; index < (await rows.count()); index += 1) {
      await expect(rows.nth(index)).toContainText("market");
      await expect(rows.nth(index)).not.toContainText("catalog");
      await expect(rows.nth(index)).not.toContainText("cleanup");
    }

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).not.toHaveURL(/kind=/);
    await expect(rows).toHaveCount(20);

    await page.getByLabel("Run status").click();
    await page.getByRole("option", { name: "failed", exact: true }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/status=failed/);
    await expect(rows).not.toHaveCount(0);
    for (let index = 0; index < (await rows.count()); index += 1) {
      await expect(rows.nth(index)).toContainText("failed");
    }

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).not.toHaveURL(/status=/);
    const currentDate = new Date().toISOString().slice(0, 10);
    const fromDate = page.getByRole("button", {
      name: "Choose from date",
    });
    const toDate = page.getByRole("button", { name: "Choose to date" });
    await fromDate.click();
    await page.getByRole("button", { name: `Select ${currentDate}` }).click();
    await toDate.click();
    await page.getByRole("button", { name: `Select ${currentDate}` }).click();
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(new RegExp(`from=${currentDate}`));
    await expect(page).toHaveURL(new RegExp(`to=${currentDate}`));

    await page.goto("/admin?from=2097-08-12&to=2097-08-12#recent-runs");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("catalog");

    await page.getByRole("button", { name: "Choose from date" }).click();
    const previousMonth = page.getByRole("button", {
      name: "Go to the Previous Month",
    });
    const nextMonth = page.getByRole("button", {
      name: "Go to the Next Month",
    });
    const calendarLayout = await page
      .getByRole("grid", { name: /August 2097/ })
      .evaluate((grid) => {
        const previous = grid.parentElement?.querySelector(
          "button[aria-label='Go to the Previous Month']",
        );
        const next = grid.parentElement?.querySelector(
          "button[aria-label='Go to the Next Month']",
        );
        const selected = grid.parentElement?.querySelector(
          "button[aria-label='Select 2097-08-12']",
        );
        if (!previous || !next || !selected) {
          throw new Error("Calendar controls are missing");
        }
        return {
          grid: grid.getBoundingClientRect(),
          previous: previous.getBoundingClientRect(),
          next: next.getBoundingClientRect(),
          previousColor: getComputedStyle(previous).color,
          selectedColor: getComputedStyle(selected).color,
          selectedBackground: getComputedStyle(selected).backgroundColor,
          selectedRadius: getComputedStyle(selected).borderRadius,
        };
      });
    await expect(previousMonth).toHaveClass(/text-slate-300/);
    await expect(nextMonth).toHaveClass(/text-slate-300/);
    expect(
      calendarLayout.next.left - calendarLayout.previous.left,
    ).toBeGreaterThan(calendarLayout.grid.width / 2);
    expect(calendarLayout.selectedRadius).toBe("8px");
    expect(calendarLayout.selectedBackground).not.toBe("rgba(0, 0, 0, 0)");
    await page.keyboard.press("Escape");

    await page.goto("/admin?from=2097-08-13&to=2097-08-12#recent-runs");
    await expect(
      page.getByText("The “From” date must be on or before the “To” date."),
    ).toBeVisible();
    await expect(rows).toHaveCount(20);

    const runFilterForm = page.locator("form:has(#run-kind)");
    const controlBounds = await runFilterForm
      .locator(
        "#run-kind, #run-status, #run-from, #run-to, button[type='submit']",
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { bottom, top } = element.getBoundingClientRect();
          return { bottom, top };
        }),
      );
    const controlBottoms = controlBounds.map((bounds) => bounds.bottom);
    expect(
      Math.max(...controlBottoms) - Math.min(...controlBottoms),
    ).toBeLessThanOrEqual(1);

    const tableDimensions = await page.getByRole("table").evaluate((table) => ({
      tableWidth: table.getBoundingClientRect().width,
      containerWidth: table.parentElement?.getBoundingClientRect().width ?? 0,
    }));
    expect(tableDimensions.tableWidth).toBeGreaterThanOrEqual(
      tableDimensions.containerWidth - 1,
    );

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
    await expect(rows).toHaveCount(20);
    await page.getByRole("link", { name: "Next" }).scrollIntoViewIfNeeded();
    await page.getByRole("link", { name: "Next" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
    // The second page can be shorter, so browsers may clamp the scroll
    // position. It must nevertheless remain away from the page top.
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);
    await page.getByRole("link", { name: "Previous" }).click();
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  });

  test("guest links grant a constrained temporary session", async ({
    page,
  }) => {
    await signIn(page, e2eAdminEmail);
    await page.goto("/admin");
    await page.getByRole("button", { name: "Create guest link" }).click();
    const guestLink = await page.getByLabel("Guest access link").inputValue();

    await page.context().clearCookies();
    await page.goto(guestLink);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(
      page.getByRole("heading", { name: "Market overview" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan all" })).toHaveCount(0);

    await page.goto(new URL("/settings", guestLink).toString());
    await expect(
      page.getByText(
        "Telegram alerts are available to full Riftwatch accounts",
      ),
    ).toBeVisible();

    await page.goto(new URL("/admin", guestLink).toString());
    await expect(page).toHaveURL(/\/dashboard/);

    await page.context().clearCookies();
    await page.goto("/guest");
    await expect(
      page.getByRole("heading", { name: "Guest access unavailable" }),
    ).toBeVisible();
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

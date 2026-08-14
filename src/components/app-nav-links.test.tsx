// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountNavigation,
  isNavigationHrefActive,
  PrimaryNavigation,
} from "@/components/app-nav-links";

let pathname = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

afterEach(() => {
  cleanup();
  pathname = "/dashboard";
});

describe("application navigation", () => {
  it("marks the matching primary destination as the current page", () => {
    pathname = "/cards/400528";
    render(<PrimaryNavigation role="user" />);

    expect(screen.getByRole("link", { name: "Discover" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("treats watch details as part of Overview", () => {
    expect(isNavigationHrefActive("/watches/watch-id", "/dashboard")).toBe(
      true,
    );
  });

  it("shows the combined alert and recommendation count", () => {
    render(
      <PrimaryNavigation
        role="user"
        attention={{
          unreadDeals: 1,
          pendingRecommendations: 2,
          total: 3,
        }}
      />,
    );

    const alertsLink = screen.getByRole("link", { name: "Alerts" });
    expect(alertsLink).toHaveTextContent("3");
    expect(alertsLink).toHaveAttribute(
      "aria-description",
      "Alerts: 1 unread deal, 2 pending recommendations",
    );
  });

  it("keeps account navigation separate and exposes Admin by role", () => {
    pathname = "/settings";
    render(
      <>
        <PrimaryNavigation role="admin" />
        <AccountNavigation />
      </>,
    );

    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Account" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

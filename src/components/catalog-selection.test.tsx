// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/actions", () => ({
  bulkAddWatchesAction: vi.fn(),
  quickAddWatchAction: vi.fn(),
}));

import {
  CatalogPageSelection,
  CatalogSelectionProvider,
  type CatalogSelectedCard,
} from "@/components/catalog-selection";

const firstPage: CatalogSelectedCard[] = [
  { id: 1, name: "Lux, Crownguard", printing: "VEN · #001 · Standard" },
  { id: 2, name: "Jinx", printing: "VEN · #002 · Standard" },
];
const secondPage: CatalogSelectedCard[] = [
  { id: 3, name: "Ahri", printing: "VEN · #003 · Standard" },
];

beforeEach(() => sessionStorage.clear());
afterEach(cleanup);

describe("catalog selection", () => {
  it("persists selected printings when the catalog page remounts", async () => {
    const first = render(
      <CatalogSelectionProvider>
        <CatalogPageSelection cards={firstPage} />
      </CatalogSelectionProvider>,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "Select this page" }));
    expect(screen.getByText("2 selected across the catalog")).toBeVisible();
    await waitFor(() =>
      expect(
        JSON.parse(sessionStorage.getItem("riftwatch:catalog-selection:v1")!),
      ).toHaveLength(2),
    );

    first.unmount();
    render(
      <CatalogSelectionProvider>
        <CatalogPageSelection cards={secondPage} />
      </CatalogSelectionProvider>,
    );

    expect(
      await screen.findByText("2 selected across the catalog"),
    ).toBeVisible();
    expect(
      screen.getByRole("checkbox", { name: "Select this page" }),
    ).not.toBeChecked();

    fireEvent.click(
      screen.getByRole("button", { name: "Clear all selected cards" }),
    );
    expect(
      screen.queryByText("2 selected across the catalog"),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(sessionStorage.getItem("riftwatch:catalog-selection:v1")!),
    ).toHaveLength(0);
  });
});

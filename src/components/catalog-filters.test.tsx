// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CatalogToolbar } from "@/components/catalog-filters";
import { parseCatalogFilters } from "@/lib/catalog/filters";

const expansions = [
  {
    id: 4521,
    code: "ven",
    name: "Riftbound x T1 2025 Worlds Champion Collection",
    count: 246,
  },
];

afterEach(cleanup);

describe("catalog filter interface", () => {
  it("links density controls to the adjacent supported column counts", () => {
    render(
      <CatalogToolbar
        filters={parseCatalogFilters({})}
        expansions={expansions}
        rarities={[]}
      />,
    );

    expect(
      screen.getByRole("group", { name: /up to 8 cards per row/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Show fewer cards per row" }),
    ).toHaveAttribute("href", "/cards?columns=6");
    expect(
      screen.getByRole("link", { name: "Show more cards per row" }),
    ).toHaveAttribute("href", "/cards?columns=12");
  });

  it("keeps the advanced form unmounted until the filter drawer opens", () => {
    render(
      <CatalogToolbar
        filters={parseCatalogFilters({})}
        expansions={expansions}
        rarities={[{ value: "Epic", count: 147 }]}
      />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("dialog")).toHaveClass(
      "flex",
      "flex-col",
      "overflow-hidden",
    );
    expect(
      screen.getByRole("checkbox", { name: /Riftbound x T1/i }),
    ).toBeInTheDocument();
  });

  it("reinitializes open drawer controls when URL filters reset", () => {
    const view = render(
      <CatalogToolbar
        filters={parseCatalogFilters({
          expansion: "4521",
          finish: "foil",
          version: "Alternate Art",
        })}
        expansions={expansions}
        rarities={[]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

    let dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("checkbox", { name: /Riftbound x T1/i }),
    ).toBeChecked();
    expect(
      within(dialog).getByLabelText("Finish availability"),
    ).toHaveTextContent("Foil available");
    expect(within(dialog).getByLabelText("Version contains")).toHaveValue(
      "Alternate Art",
    );

    view.rerender(
      <CatalogToolbar
        filters={parseCatalogFilters({})}
        expansions={expansions}
        rarities={[]}
      />,
    );

    dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("checkbox", { name: /Riftbound x T1/i }),
    ).not.toBeChecked();
    expect(
      within(dialog).getByLabelText("Finish availability"),
    ).toHaveTextContent("Any finish");
    expect(within(dialog).getByLabelText("Version contains")).toHaveValue("");
  });
});

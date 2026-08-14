// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WatchOptionsFields } from "@/components/watch-options-fields";

afterEach(cleanup);

describe("WatchOptionsFields", () => {
  it("renders constrained money inputs and the configured watch defaults", () => {
    render(
      <WatchOptionsFields
        idPrefix="watch"
        defaults={{
          languages: ["fr"],
          conditions: ["Mint"],
          foil: "foil",
          graded: true,
          requireZero: true,
          discountPercent: 35,
          minSavingsEuros: 12.5,
          sellerCountries: ["IT"],
        }}
      />,
    );

    expect(screen.getByRole("checkbox", { name: "French" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "English" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Mint" })).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "CardTrader Zero only" }),
    ).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Graded" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "IT" })).toBeChecked();
    expect(screen.getByLabelText("Minimum discount")).toHaveAttribute(
      "min",
      "1",
    );
    expect(screen.getByLabelText("Minimum discount")).toHaveValue(35);
    expect(screen.getByLabelText("Minimum saving")).toHaveAttribute(
      "step",
      "0.01",
    );
    expect(screen.getByLabelText("Minimum saving")).toHaveAttribute(
      "inputmode",
      "decimal",
    );
    expect(screen.getByLabelText("Minimum saving")).toHaveValue(12.5);
  });

  it("can omit the country override when account defaults are the only choice", () => {
    render(<WatchOptionsFields idPrefix="quick" showCountryOverride={false} />);

    expect(
      screen.queryByText("Seller country override"),
    ).not.toBeInTheDocument();
  });
});

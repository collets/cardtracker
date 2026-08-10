// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

describe("form controls", () => {
  it("gives buttons visible pointer, hover, active, and disabled states", () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("cursor-pointer");
    expect(button).toHaveClass("hover:-translate-y-0.5");
    expect(button).toHaveClass("active:translate-y-0");
    expect(button).toHaveClass("disabled:cursor-not-allowed");
  });

  it("removes native number steppers through the shared input", () => {
    render(<Input aria-label="Quota" type="number" />);

    expect(screen.getByRole("spinbutton", { name: "Quota" })).toHaveClass(
      "[appearance:textfield]",
      "[&::-webkit-inner-spin-button]:appearance-none",
      "[&::-webkit-outer-spin-button]:appearance-none",
    );
  });

  it("keeps styled checkboxes native and form-compatible", () => {
    const { container } = render(
      <form>
        <Checkbox name="languages" value="en" label="English" />
      </form>,
    );
    const checkbox = screen.getByRole("checkbox", { name: "English" });

    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(new FormData(form!).get("languages")).toBe("en");
  });
});

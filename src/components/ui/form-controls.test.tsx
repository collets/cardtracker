// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";

describe("form controls", () => {
  it("gives buttons visible stationary hover and disabled states", () => {
    render(<Button disabled>Save</Button>);

    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveClass("cursor-pointer");
    expect(button).toHaveClass(
      "transition-[background-color,border-color,color,box-shadow]",
    );
    expect(button).toHaveClass("hover:bg-cyan-200");
    expect(button).toHaveClass("hover:shadow-md");
    expect(button).not.toHaveClass("hover:-translate-y-0.5");
    expect(button).toHaveClass("disabled:cursor-not-allowed");
  });

  it("removes number steppers and gives shared inputs the cyan hover treatment", () => {
    render(<Input aria-label="Quota" type="number" />);

    expect(screen.getByRole("spinbutton", { name: "Quota" })).toHaveClass(
      "[appearance:textfield]",
      "[&::-webkit-inner-spin-button]:appearance-none",
      "[&::-webkit-outer-spin-button]:appearance-none",
      "hover:border-cyan-300/35",
      "hover:bg-cyan-300/10",
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
    expect(checkbox).toHaveClass("group-hover:border-cyan-300/60");
    expect(checkbox).toHaveClass("group-hover:bg-cyan-300/10");
    expect(checkbox).toHaveClass("group-hover:shadow-sm");
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    expect(new FormData(form!).get("languages")).toBe("en");
  });

  it("uses the date control's cyan hover treatment for select triggers", () => {
    render(
      <Select>
        <SelectTrigger aria-label="Status">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Status" });
    expect(trigger).toHaveClass("hover:border-cyan-300/35");
    expect(trigger).toHaveClass("hover:bg-cyan-300/10");
    expect(trigger).toHaveClass("hover:text-cyan-100");
  });
});

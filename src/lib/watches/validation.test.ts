import { describe, expect, it } from "vitest";
import {
  watchInputSchema,
  watchInputsFromBulkForm,
} from "@/lib/watches/validation";

describe("watch input", () => {
  it("applies safe market defaults", () => {
    const value = watchInputSchema.parse({ blueprintId: 400528 });
    expect(value).toMatchObject({
      languages: ["en"],
      conditions: ["Mint", "Near Mint"],
      foil: "any",
      graded: false,
      requireZero: false,
      discountPercent: 20,
      minSavingsEuros: 5,
    });
  });

  it("rejects meaningless thresholds", () => {
    expect(() =>
      watchInputSchema.parse({ blueprintId: 400528, discountPercent: 0 }),
    ).toThrow();
  });

  it("applies one validated option set to every bulk-selected card", () => {
    const form = new FormData();
    form.append("blueprintIds", "101");
    form.append("blueprintIds", "102");
    form.set("blueprintId", "101");
    form.append("languages", "en");
    form.append("conditions", "Near Mint");
    form.set("foil", "nonfoil");
    form.set("discountPercent", "25");

    expect(watchInputsFromBulkForm(form)).toEqual([
      expect.objectContaining({
        blueprintId: 101,
        languages: ["en"],
        conditions: ["Near Mint"],
        foil: "nonfoil",
        discountPercent: 25,
      }),
      expect.objectContaining({
        blueprintId: 102,
        languages: ["en"],
        conditions: ["Near Mint"],
        foil: "nonfoil",
        discountPercent: 25,
      }),
    ]);
  });

  it("rejects duplicate cards in a bulk selection", () => {
    const form = new FormData();
    form.append("blueprintIds", "101");
    form.append("blueprintIds", "101");
    form.set("blueprintId", "101");

    expect(() => watchInputsFromBulkForm(form)).toThrow(
      "selection contains duplicates",
    );
  });
});

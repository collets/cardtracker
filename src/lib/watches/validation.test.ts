import { describe, expect, it } from "vitest";
import { watchInputSchema } from "@/lib/watches/validation";

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
});

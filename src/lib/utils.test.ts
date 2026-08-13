import { describe, expect, it } from "vitest";
import { formatEuro, normalizeEmail } from "@/lib/utils";

describe("formatEuro", () => {
  it("formats integer cents without persisting or exposing floats", () => {
    expect(formatEuro(1_234)).toBe("€12.34");
    expect(formatEuro(0)).toBe("€0.00");
  });

  it("uses an em dash for unavailable prices", () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatEuro(undefined)).toBe("—");
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases an email consistently for authorization", () => {
    expect(normalizeEmail("  Admin@Riftwatch.COM ")).toBe(
      "admin@riftwatch.com",
    );
  });
});

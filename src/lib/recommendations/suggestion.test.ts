import { describe, expect, it } from "vitest";
import {
  suggestedMinSavingsCents,
  suggestThresholds,
} from "@/lib/recommendations/suggestion";

describe("threshold suggestions", () => {
  it.each([
    [1, 1],
    [19, 2],
    [100, 10],
    [500, 50],
    [2_000, 200],
    [4_800, 480],
    [8_000, 500],
  ])(
    "scales a %i-cent reference to %i cents with cent precision",
    (reference, result) => {
      expect(suggestedMinSavingsCents(reference)).toBe(result);
    },
  );

  it("suggests a lower absolute floor after enough comparable listings", () => {
    expect(
      suggestThresholds({
        discountPercent: 20,
        minSavingsCents: 500,
        referencePriceCents: 2_000,
        eligibleCount: 6,
      }),
    ).toEqual({ discountPercent: 20, minSavingsCents: 200 });
  });

  it("keeps a sub-euro card viable at currency precision", () => {
    expect(
      suggestThresholds({
        discountPercent: 20,
        minSavingsCents: 500,
        referencePriceCents: 19,
        eligibleCount: 4,
      }),
    ).toEqual({ discountPercent: 20, minSavingsCents: 2 });
  });

  it.each([
    {
      discountPercent: 25,
      minSavingsCents: 500,
      referencePriceCents: 2_200,
      eligibleCount: 6,
    },
    {
      discountPercent: 20,
      minSavingsCents: 300,
      referencePriceCents: 2_200,
      eligibleCount: 6,
    },
    {
      discountPercent: 20,
      minSavingsCents: 500,
      referencePriceCents: 2_200,
      eligibleCount: 3,
    },
    {
      discountPercent: 20,
      minSavingsCents: 500,
      referencePriceCents: null,
      eligibleCount: 6,
    },
    {
      discountPercent: 20,
      minSavingsCents: 500,
      referencePriceCents: 4_000,
      eligibleCount: 6,
    },
    {
      discountPercent: 20,
      minSavingsCents: 500,
      referencePriceCents: 8_000,
      eligibleCount: 6,
    },
  ])(
    "does not override intentional, sparse, or already suitable thresholds",
    (input) => {
      expect(suggestThresholds(input)).toBeNull();
    },
  );
});

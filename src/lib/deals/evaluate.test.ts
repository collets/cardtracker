import { describe, expect, it } from "vitest";
import { evaluateDeal, isEligible, median } from "@/lib/deals/evaluate";
import type { MarketListing } from "@/lib/cardtrader/types";
import type { WatchFilters } from "@/lib/deals/types";

const filters: WatchFilters = {
  languages: ["en"],
  conditions: ["Mint", "Near Mint"],
  foil: true,
  graded: false,
  requireZero: false,
  sellerCountries: ["IT", "FR", "ES"],
  discountPercent: 20,
  minSavingsCents: 500,
};

function listing(priceCents: number, productId = priceCents): MarketListing {
  return {
    productId,
    blueprintId: 400528,
    name: "Lux - Crownguard",
    priceCents,
    currency: "EUR",
    quantity: 1,
    description: null,
    condition: "Near Mint",
    language: "en",
    foil: true,
    signed: false,
    altered: false,
    graded: false,
    onVacation: false,
    seller: {
      id: productId,
      username: `seller-${productId}`,
      countryCode: "IT",
      canSellViaHub: true,
      oneDayReady: false,
      cancellationRisk: false,
    },
  };
}

describe("median", () => {
  it("handles odd and even arrays without mutating input", () => {
    const values = [5, 1, 3, 2];
    expect(median(values)).toBe(3);
    expect(values).toEqual([5, 1, 3, 2]);
    expect(median([5, 1, 3])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe("listing eligibility", () => {
  it("keeps matching listings", () => {
    expect(isEligible(listing(3000), filters)).toBe(true);
  });

  it.each([
    ["vacation", { onVacation: true }],
    ["signed", { signed: true }],
    ["wrong currency", { currency: "USD" }],
    ["wrong language", { language: "fr" }],
    ["wrong country", { seller: { ...listing(1).seller, countryCode: "US" } }],
  ])("rejects %s listings", (_label, overrides) => {
    expect(isEligible({ ...listing(3000), ...overrides }, filters)).toBe(false);
  });
});

describe("deal evaluation", () => {
  it("uses the median of listings two through six and detects a deal", () => {
    const result = evaluateDeal(
      [
        listing(2000),
        listing(3000),
        listing(3100),
        listing(3200),
        listing(3300),
        listing(3400),
      ],
      filters,
    );
    expect(result.currentBaselineCents).toBe(3200);
    expect(result.referencePriceCents).toBe(3200);
    expect(result.savingsCents).toBe(1200);
    expect(result.discountBps).toBe(3750);
    expect(result.qualifies).toBe(true);
    expect(result.confidence).toBe("medium");
  });

  it("uses the lower historical baseline and upgrades confidence", () => {
    const history = Array.from({ length: 24 }, () => 3000);
    const result = evaluateDeal(
      [
        listing(2000),
        listing(3200),
        listing(3300),
        listing(3400),
        listing(3500),
        listing(3600),
      ],
      filters,
      history,
    );
    expect(result.historicalBaselineCents).toBe(3000);
    expect(result.referencePriceCents).toBe(3000);
    expect(result.confidence).toBe("high");
    expect(result.qualifies).toBe(true);
  });

  it("requires at least four comparable listings", () => {
    const result = evaluateDeal(
      [listing(1000), listing(3000), listing(3100)],
      filters,
    );
    expect(result.qualifies).toBe(false);
    expect(result.rejectionReason).toBe("not-enough-listings");
  });

  it("requires both percentage and absolute thresholds", () => {
    const percentageMiss = evaluateDeal(
      [
        listing(2800),
        listing(3000),
        listing(3100),
        listing(3200),
        listing(3300),
      ],
      { ...filters, minSavingsCents: 0 },
    );
    expect(percentageMiss.qualifies).toBe(false);
    expect(percentageMiss.rejectionReason).toBe("below-percentage-threshold");

    const absoluteMiss = evaluateDeal(
      [
        listing(2600),
        listing(3000),
        listing(3100),
        listing(3200),
        listing(3300),
      ],
      { ...filters, discountPercent: 10, minSavingsCents: 700 },
    );
    expect(absoluteMiss.qualifies).toBe(false);
    expect(absoluteMiss.rejectionReason).toBe("below-absolute-threshold");
  });

  it("rejects a non-positive comparator baseline", () => {
    const result = evaluateDeal(
      [listing(0, 1), listing(0, 2), listing(0, 3), listing(0, 4)],
      { ...filters, minSavingsCents: 0 },
    );

    expect(result.qualifies).toBe(false);
    expect(result.referencePriceCents).toBe(0);
    expect(result.rejectionReason).toBe("no-reference-price");
  });
});

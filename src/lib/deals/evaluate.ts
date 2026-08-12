import type { MarketListing } from "@/lib/cardtrader/types";
import type { DealEvaluation, WatchFilters } from "@/lib/deals/types";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] ?? null;
  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left === undefined || right === undefined
    ? null
    : Math.round((left + right) / 2);
}

export function isEligible(
  listing: MarketListing,
  filters: WatchFilters,
): boolean {
  if (listing.currency !== "EUR" || listing.quantity <= 0 || listing.onVacation)
    return false;
  if (listing.signed || listing.altered || listing.seller.cancellationRisk)
    return false;
  if (listing.graded !== filters.graded) return false;
  if (!listing.condition || !filters.conditions.includes(listing.condition))
    return false;
  if (!listing.language || !filters.languages.includes(listing.language))
    return false;
  if (filters.foil !== null && listing.foil !== filters.foil) return false;
  if (filters.requireZero && !listing.seller.canSellViaHub) return false;
  if (
    filters.sellerCountries.length > 0 &&
    (!listing.seller.countryCode ||
      !filters.sellerCountries.includes(listing.seller.countryCode))
  ) {
    return false;
  }
  return true;
}

export function evaluateDeal(
  listings: MarketListing[],
  filters: WatchFilters,
  historicalCurrentBaselines: number[] = [],
): DealEvaluation {
  const eligibleListings = listings.filter((listing) =>
    isEligible(listing, filters),
  );
  eligibleListings.sort(
    (a, b) => a.priceCents - b.priceCents || a.productId - b.productId,
  );

  const candidate = eligibleListings[0] ?? null;
  const currentBaselineCents =
    eligibleListings.length >= 4
      ? median(
          eligibleListings.slice(1, 6).map((listing) => listing.priceCents),
        )
      : null;
  const historicalBaselineCents =
    historicalCurrentBaselines.length >= 24
      ? median(historicalCurrentBaselines)
      : null;
  const availableBaselines = [
    currentBaselineCents,
    historicalBaselineCents,
  ].filter((value): value is number => value !== null);
  const referencePriceCents =
    availableBaselines.length > 0 ? Math.min(...availableBaselines) : null;
  const baseline = {
    candidate,
    eligibleListings,
    currentBaselineCents,
    historicalBaselineCents,
    referencePriceCents,
  };

  if (!candidate || eligibleListings.length < 4) {
    return {
      ...baseline,
      savingsCents: null,
      discountBps: null,
      confidence: null,
      qualifies: false,
      rejectionReason: "not-enough-listings",
    };
  }

  if (!referencePriceCents || referencePriceCents <= 0) {
    return {
      ...baseline,
      savingsCents: null,
      discountBps: null,
      confidence: null,
      qualifies: false,
      rejectionReason: "no-reference-price",
    };
  }

  const savingsCents = referencePriceCents - candidate.priceCents;
  const discountBps = Math.floor((savingsCents * 10_000) / referencePriceCents);
  const confidence =
    historicalBaselineCents !== null && eligibleListings.length >= 6
      ? "high"
      : "medium";
  const percentageQualifies = discountBps >= filters.discountPercent * 100;
  const absoluteQualifies = savingsCents >= filters.minSavingsCents;

  return {
    ...baseline,
    savingsCents,
    discountBps,
    confidence,
    qualifies: percentageQualifies && absoluteQualifies,
    rejectionReason: !percentageQualifies
      ? "below-percentage-threshold"
      : !absoluteQualifies
        ? "below-absolute-threshold"
        : null,
  };
}

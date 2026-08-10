import type { MarketListing } from "@/lib/cardtrader/types";

export interface WatchFilters {
  languages: string[];
  conditions: string[];
  foil: boolean | null;
  graded: boolean;
  requireZero: boolean;
  sellerCountries: string[];
  discountPercent: number;
  minSavingsCents: number;
}

export type DealRejectionReason =
  | "not-enough-listings"
  | "below-percentage-threshold"
  | "below-absolute-threshold"
  | "no-reference-price";

export interface DealEvaluation {
  candidate: MarketListing | null;
  eligibleListings: MarketListing[];
  currentBaselineCents: number | null;
  historicalBaselineCents: number | null;
  referencePriceCents: number | null;
  savingsCents: number | null;
  discountBps: number | null;
  confidence: "medium" | "high" | null;
  qualifies: boolean;
  rejectionReason: DealRejectionReason | null;
}

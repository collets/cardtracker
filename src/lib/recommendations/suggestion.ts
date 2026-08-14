import {
  DEFAULT_DISCOUNT_PERCENT,
  DEFAULT_MIN_SAVINGS_CENTS,
} from "@/lib/constants";

export const RECOMMENDATION_MIN_ELIGIBLE_LISTINGS = 4;
const SUGGESTED_SAVINGS_PERCENT = 10;

export type ThresholdSuggestion = {
  discountPercent: number;
  minSavingsCents: number;
};

export function suggestedMinSavingsCents(referencePriceCents: number): number {
  const proportionalSavings = Math.round(
    (referencePriceCents * SUGGESTED_SAVINGS_PERCENT) / 100,
  );
  return Math.min(DEFAULT_MIN_SAVINGS_CENTS, Math.max(1, proportionalSavings));
}

export function suggestThresholds(input: {
  discountPercent: number;
  minSavingsCents: number;
  referencePriceCents: number | null;
  eligibleCount: number;
}): ThresholdSuggestion | null {
  if (
    input.discountPercent !== DEFAULT_DISCOUNT_PERCENT ||
    input.minSavingsCents !== DEFAULT_MIN_SAVINGS_CENTS ||
    !input.referencePriceCents ||
    input.referencePriceCents <= 0 ||
    input.eligibleCount < RECOMMENDATION_MIN_ELIGIBLE_LISTINGS
  ) {
    return null;
  }

  const minSavingsCents = suggestedMinSavingsCents(input.referencePriceCents);
  const percentageSavingsCents =
    (input.referencePriceCents * input.discountPercent) / 100;
  if (
    input.minSavingsCents <= percentageSavingsCents ||
    minSavingsCents >= input.minSavingsCents
  ) {
    return null;
  }

  return {
    discountPercent: input.discountPercent,
    minSavingsCents,
  };
}

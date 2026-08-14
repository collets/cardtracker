import { z } from "zod";
import {
  CARD_CONDITIONS,
  DEFAULT_CONDITIONS,
  DEFAULT_DISCOUNT_PERCENT,
  DEFAULT_LANGUAGES,
  DEFAULT_MIN_SAVINGS_CENTS,
  EU_EEA_COUNTRY_CODES,
  MAX_BULK_WATCHES,
  SUPPORTED_LANGUAGE_CODES,
} from "@/lib/constants";

export const watchInputSchema = z.object({
  blueprintId: z.coerce.number().int().positive(),
  languages: z
    .array(z.enum(SUPPORTED_LANGUAGE_CODES))
    .min(1)
    .default(DEFAULT_LANGUAGES),
  conditions: z
    .array(z.enum(CARD_CONDITIONS))
    .min(1)
    .default(DEFAULT_CONDITIONS),
  foil: z.enum(["any", "foil", "nonfoil"]).default("any"),
  graded: z.boolean().default(false),
  requireZero: z.boolean().default(false),
  sellerCountries: z
    .array(z.enum(EU_EEA_COUNTRY_CODES))
    .nullable()
    .default(null),
  discountPercent: z.coerce
    .number()
    .int()
    .min(1)
    .max(90)
    .default(DEFAULT_DISCOUNT_PERCENT),
  minSavingsEuros: z.coerce
    .number()
    .min(0)
    .max(100_000)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      "Minimum saving cannot use fractions of a cent",
    )
    .default(DEFAULT_MIN_SAVINGS_CENTS / 100),
});

export function watchInputFromForm(formData: FormData) {
  const sellerCountries = formData.getAll("sellerCountries").map(String);
  return watchInputSchema.parse({
    blueprintId: formData.get("blueprintId"),
    languages: formData.getAll("languages").map(String),
    conditions: formData.getAll("conditions").map(String),
    foil: formData.get("foil") || "any",
    graded: formData.get("graded") === "on",
    requireZero: formData.get("requireZero") === "on",
    sellerCountries: sellerCountries.length ? sellerCountries : null,
    discountPercent:
      formData.get("discountPercent") || DEFAULT_DISCOUNT_PERCENT,
    minSavingsEuros:
      formData.get("minSavingsEuros") || DEFAULT_MIN_SAVINGS_CENTS / 100,
  });
}

const bulkBlueprintIdsSchema = z
  .array(z.coerce.number().int().positive())
  .min(1, "Select at least one card")
  .max(MAX_BULK_WATCHES, `Select no more than ${MAX_BULK_WATCHES} cards`)
  .refine(
    (values) => new Set(values).size === values.length,
    "The card selection contains duplicates",
  );

export function watchInputsFromBulkForm(formData: FormData) {
  const blueprintIds = bulkBlueprintIdsSchema.parse(
    formData.getAll("blueprintIds"),
  );
  const sharedInput = watchInputFromForm(formData);
  return blueprintIds.map((blueprintId) => ({
    ...sharedInput,
    blueprintId,
  }));
}

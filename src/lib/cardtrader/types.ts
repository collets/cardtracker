import { z } from "zod";

export const cardTraderExpansionSchema = z.object({
  id: z.number().int(),
  game_id: z.number().int(),
  code: z.string(),
  name: z.string(),
});

export const cardTraderBlueprintSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  version: z.string().nullable().optional(),
  game_id: z.number().int(),
  category_id: z.number().int(),
  expansion_id: z.number().int(),
  fixed_properties: z.record(z.string(), z.unknown()).default({}),
  editable_properties: z.array(z.unknown()).default([]),
  image_url: z.string().url().nullable().optional(),
});

const moneySchema = z.object({
  cents: z.number().int(),
  currency: z.string(),
  currency_symbol: z.string().optional(),
  formatted: z.string().optional(),
});

const sellerSchema = z.object({
  id: z.number().int(),
  username: z.string(),
  country_code: z.string().nullable().optional(),
  user_type: z.string().optional(),
  can_sell_via_hub: z.boolean().default(false),
  can_sell_sealed_with_ct_zero: z.boolean().default(false),
  one_day_ready: z.boolean().default(false),
  too_many_request_for_cancel_as_seller: z.boolean().default(false),
});

export const cardTraderProductSchema = z.object({
  id: z.number().int(),
  blueprint_id: z.number().int(),
  name_en: z.string(),
  price_cents: z.number().int(),
  price_currency: z.string(),
  quantity: z.number().int(),
  description: z.string().nullable().optional(),
  properties_hash: z.record(z.string(), z.unknown()).default({}),
  graded: z.boolean().default(false),
  on_vacation: z.boolean().default(false),
  user: sellerSchema,
  price: moneySchema,
});

export type CardTraderExpansion = z.infer<typeof cardTraderExpansionSchema>;
export type CardTraderBlueprint = z.infer<typeof cardTraderBlueprintSchema>;
export type CardTraderProduct = z.infer<typeof cardTraderProductSchema>;

export interface MarketListing {
  productId: number;
  blueprintId: number;
  name: string;
  priceCents: number;
  currency: string;
  quantity: number;
  description: string | null;
  condition: string | null;
  language: string | null;
  foil: boolean | null;
  signed: boolean;
  altered: boolean;
  graded: boolean;
  onVacation: boolean;
  seller: {
    id: number;
    username: string;
    countryCode: string | null;
    canSellViaHub: boolean;
    oneDayReady: boolean;
    cancellationRisk: boolean;
  };
}

function stringProperty(
  properties: Record<string, unknown>,
  key: string,
): string | null {
  const value = properties[key];
  return typeof value === "string" ? value : null;
}

function booleanProperty(
  properties: Record<string, unknown>,
  key: string,
): boolean {
  return properties[key] === true;
}

export function normalizeProduct(product: CardTraderProduct): MarketListing {
  return {
    productId: product.id,
    blueprintId: product.blueprint_id,
    name: product.name_en,
    priceCents: product.price_cents,
    currency: product.price_currency,
    quantity: product.quantity,
    description: product.description ?? null,
    condition: stringProperty(product.properties_hash, "condition"),
    language: stringProperty(product.properties_hash, "riftbound_language"),
    foil:
      typeof product.properties_hash.riftbound_foil === "boolean"
        ? product.properties_hash.riftbound_foil
        : null,
    signed: booleanProperty(product.properties_hash, "signed"),
    altered: booleanProperty(product.properties_hash, "altered"),
    graded: product.graded,
    onVacation: product.on_vacation,
    seller: {
      id: product.user.id,
      username: product.user.username,
      countryCode: product.user.country_code ?? null,
      canSellViaHub: product.user.can_sell_via_hub,
      oneDayReady: product.user.one_day_ready,
      cancellationRisk: product.user.too_many_request_for_cancel_as_seller,
    },
  };
}

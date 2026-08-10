import { describe, expect, it } from "vitest";
import {
  cardTraderProductSchema,
  normalizeProduct,
} from "@/lib/cardtrader/types";

describe("CardTrader product normalization", () => {
  it("maps dynamic Riftbound properties and seller flags", () => {
    const product = cardTraderProductSchema.parse({
      id: 441457563,
      blueprint_id: 400528,
      name_en: "Lux - Crownguard",
      price_cents: 3028,
      price_currency: "EUR",
      quantity: 1,
      properties_hash: {
        condition: "Near Mint",
        riftbound_language: "en",
        riftbound_foil: true,
        signed: false,
        altered: false,
      },
      graded: false,
      on_vacation: false,
      user: {
        id: 61104,
        username: "seller",
        country_code: "PT",
        can_sell_via_hub: true,
      },
      price: { cents: 3028, currency: "EUR", formatted: "€30.28" },
    });
    const normalized = normalizeProduct(product);
    expect(normalized).toMatchObject({
      productId: 441457563,
      blueprintId: 400528,
      priceCents: 3028,
      condition: "Near Mint",
      language: "en",
      foil: true,
      seller: { countryCode: "PT", canSellViaHub: true },
    });
  });
});

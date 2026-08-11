import { describe, expect, it } from "vitest";
import { getCardTraderBlueprintUrl } from "@/lib/cardtrader/links";

describe("getCardTraderBlueprintUrl", () => {
  it("builds CardTrader's canonical page for an exact blueprint", () => {
    expect(getCardTraderBlueprintUrl(400_528)).toBe(
      "https://www.cardtrader.com/en/cards/400528",
    );
  });

  it.each([0, -1, 1.5, Number.NaN])(
    "rejects an invalid blueprint ID: %s",
    (blueprintId) => {
      expect(() => getCardTraderBlueprintUrl(blueprintId)).toThrow(
        "CardTrader blueprint ID must be a positive integer",
      );
    },
  );
});

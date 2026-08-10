import { describe, expect, it } from "vitest";
import { getCardTraderOriginalImageUrl } from "@/lib/cardtrader/images";

describe("getCardTraderOriginalImageUrl", () => {
  it("removes the preview prefix from CardTrader image filenames", () => {
    expect(
      getCardTraderOriginalImageUrl(
        "https://cardtrader.com/uploads/blueprints/image/400528/preview_400528-lux-crownguard.webp",
      ),
    ).toBe(
      "https://cardtrader.com/uploads/blueprints/image/400528/400528-lux-crownguard.webp",
    );
  });

  it("supports the www host and preserves URL parameters", () => {
    expect(
      getCardTraderOriginalImageUrl(
        "https://www.cardtrader.com/uploads/blueprints/image/1/preview_card.jpg?version=2#art",
      ),
    ).toBe(
      "https://www.cardtrader.com/uploads/blueprints/image/1/card.jpg?version=2#art",
    );
  });

  it.each([
    "https://cardtrader.com/uploads/blueprints/image/1/card.jpg",
    "https://example.com/uploads/blueprints/image/1/preview_card.jpg",
    "not-a-url",
  ])("leaves unsupported URLs unchanged: %s", (imageUrl) => {
    expect(getCardTraderOriginalImageUrl(imageUrl)).toBe(imageUrl);
  });
});

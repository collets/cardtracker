const CARDTRADER_WEB_ORIGIN = "https://www.cardtrader.com";

export function getCardTraderBlueprintUrl(blueprintId: number): string {
  if (!Number.isSafeInteger(blueprintId) || blueprintId <= 0) {
    throw new RangeError("CardTrader blueprint ID must be a positive integer");
  }

  return `${CARDTRADER_WEB_ORIGIN}/en/cards/${blueprintId}`;
}

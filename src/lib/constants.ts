export const RIFTBOUND_GAME_ID = 22;
export const RIFTBOUND_SINGLES_CATEGORY_ID = 258;
export const CARDTRADER_BASE_URL = "https://api.cardtrader.com/api/v2";

export const EU_EEA_COUNTRY_CODES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IS",
  "IE",
  "IT",
  "LV",
  "LI",
  "LT",
  "LU",
  "MT",
  "NL",
  "NO",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
] as const;

export const SUPPORTED_LANGUAGE_CODES = ["en", "fr", "kr", "zh-CN"] as const;
export const CARD_CONDITIONS = [
  "Mint",
  "Near Mint",
  "Slightly Played",
  "Moderately Played",
  "Played",
  "Poor",
] as const;

export const DEFAULT_LANGUAGES: Array<
  (typeof SUPPORTED_LANGUAGE_CODES)[number]
> = ["en"];
export const DEFAULT_CONDITIONS: Array<(typeof CARD_CONDITIONS)[number]> = [
  "Mint",
  "Near Mint",
];
export const DEFAULT_DISCOUNT_PERCENT = 20;
export const DEFAULT_MIN_SAVINGS_CENTS = 500;
export const MAX_BULK_WATCHES = 500;
export const PRICE_HISTORY_RETENTION_DAYS = 30;

import {
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguageCode,
} from "@/lib/constants";

export const CATALOG_PAGE_SIZES = [24, 48, 96] as const;
export const DEFAULT_CATALOG_PAGE_SIZE = 24;
export const CATALOG_COLUMN_OPTIONS = [2, 3, 4, 6, 8, 12] as const;
export const DEFAULT_CATALOG_COLUMNS = 8;

export const CATALOG_SORTS = [
  "expansion-asc",
  "expansion-desc",
  "name-asc",
  "name-desc",
  "collector-asc",
  "rarity-asc",
] as const;

export const CATALOG_FINISHES = [
  "any",
  "foil",
  "nonfoil",
  "flexible",
  "fixed",
] as const;

export const CATALOG_PRINTINGS = ["any", "standard", "named"] as const;
export const CATALOG_ARTWORK = ["any", "with", "missing"] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number];
export type CatalogFinish = (typeof CATALOG_FINISHES)[number];
export type CatalogPrinting = (typeof CATALOG_PRINTINGS)[number];
export type CatalogArtwork = (typeof CATALOG_ARTWORK)[number];
export type CatalogColumns = (typeof CATALOG_COLUMN_OPTIONS)[number];

export type CatalogSearchParams = Record<string, string | string[] | undefined>;

export type CatalogFilters = {
  query: string;
  expansionIds: number[];
  rarities: string[];
  languages: SupportedLanguageCode[];
  finish: CatalogFinish;
  printing: CatalogPrinting;
  version: string;
  collectorNumber: string;
  artwork: CatalogArtwork;
  sort: CatalogSort;
  page: number;
  perPage: (typeof CATALOG_PAGE_SIZES)[number];
  columns: CatalogColumns;
};

const DEFAULT_SORT: CatalogSort = "expansion-asc";

function valuesOf(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [
    ...new Set(values.map((item) => item.trim()).filter((item) => item.length)),
  ];
}

function firstOf(value: string | string[] | undefined): string {
  return valuesOf(value)[0] ?? "";
}

function enumValue<T extends readonly string[]>(
  value: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : fallback;
}

function positiveInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function parseCatalogFilters(
  searchParams: CatalogSearchParams,
): CatalogFilters {
  const expansionIds = valuesOf(searchParams.expansion)
    .map((value) => positiveInteger(value, 0))
    .filter((value) => value > 0);
  const requestedPageSize = positiveInteger(
    firstOf(searchParams.perPage),
    DEFAULT_CATALOG_PAGE_SIZE,
  );
  const requestedColumns = positiveInteger(
    firstOf(searchParams.columns),
    DEFAULT_CATALOG_COLUMNS,
  );

  return {
    query: firstOf(searchParams.q).slice(0, 120),
    expansionIds: [...new Set(expansionIds)].slice(0, 50),
    rarities: valuesOf(searchParams.rarity)
      .slice(0, 30)
      .map((value) => value.slice(0, 80)),
    languages: valuesOf(searchParams.language).filter(
      (value): value is SupportedLanguageCode =>
        SUPPORTED_LANGUAGE_CODES.includes(value as SupportedLanguageCode),
    ),
    finish: enumValue(firstOf(searchParams.finish), CATALOG_FINISHES, "any"),
    printing: enumValue(
      firstOf(searchParams.printing),
      CATALOG_PRINTINGS,
      "any",
    ),
    version: firstOf(searchParams.version).slice(0, 120),
    collectorNumber: firstOf(searchParams.collector).slice(0, 80),
    artwork: enumValue(firstOf(searchParams.artwork), CATALOG_ARTWORK, "any"),
    sort: enumValue(firstOf(searchParams.sort), CATALOG_SORTS, DEFAULT_SORT),
    page: Math.min(positiveInteger(firstOf(searchParams.page), 1), 10_000),
    perPage: CATALOG_PAGE_SIZES.includes(
      requestedPageSize as (typeof CATALOG_PAGE_SIZES)[number],
    )
      ? (requestedPageSize as (typeof CATALOG_PAGE_SIZES)[number])
      : DEFAULT_CATALOG_PAGE_SIZE,
    columns: CATALOG_COLUMN_OPTIONS.includes(requestedColumns as CatalogColumns)
      ? (requestedColumns as CatalogColumns)
      : DEFAULT_CATALOG_COLUMNS,
  };
}

export function catalogFilterCount(filters: CatalogFilters): number {
  return (
    filters.expansionIds.length +
    filters.rarities.length +
    filters.languages.length +
    Number(filters.finish !== "any") +
    Number(filters.printing !== "any") +
    Number(Boolean(filters.version)) +
    Number(Boolean(filters.collectorNumber)) +
    Number(filters.artwork !== "any")
  );
}

export function catalogFilterEntries(
  filters: CatalogFilters,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  if (filters.query) entries.push(["q", filters.query]);
  for (const id of filters.expansionIds) {
    entries.push(["expansion", String(id)]);
  }
  for (const rarity of filters.rarities) entries.push(["rarity", rarity]);
  for (const language of filters.languages) {
    entries.push(["language", language]);
  }
  if (filters.finish !== "any") entries.push(["finish", filters.finish]);
  if (filters.printing !== "any") {
    entries.push(["printing", filters.printing]);
  }
  if (filters.version) entries.push(["version", filters.version]);
  if (filters.collectorNumber) {
    entries.push(["collector", filters.collectorNumber]);
  }
  if (filters.artwork !== "any") entries.push(["artwork", filters.artwork]);
  if (filters.sort !== DEFAULT_SORT) entries.push(["sort", filters.sort]);
  if (filters.page > 1) entries.push(["page", String(filters.page)]);
  if (filters.perPage !== DEFAULT_CATALOG_PAGE_SIZE) {
    entries.push(["perPage", String(filters.perPage)]);
  }
  if (filters.columns !== DEFAULT_CATALOG_COLUMNS) {
    entries.push(["columns", String(filters.columns)]);
  }
  return entries;
}

export function catalogHref(
  filters: CatalogFilters,
  changes: Partial<CatalogFilters> = {},
): string {
  const nextFilters: CatalogFilters = {
    ...filters,
    ...changes,
    page: changes.page ?? 1,
  };
  const query = new URLSearchParams(catalogFilterEntries(nextFilters));
  return query.size ? `/cards?${query.toString()}` : "/cards";
}

export function toggleCatalogValue<T extends string | number>(
  values: T[],
  value: T,
): T[] {
  return values.includes(value)
    ? values.filter((candidate) => candidate !== value)
    : [...values, value];
}

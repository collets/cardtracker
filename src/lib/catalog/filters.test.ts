import { describe, expect, it } from "vitest";
import {
  CATALOG_COLUMN_OPTIONS,
  CATALOG_PAGE_SIZES,
  catalogFilterCount,
  catalogHref,
  parseCatalogFilters,
  toggleCatalogValue,
} from "@/lib/catalog/filters";

describe("catalog filters", () => {
  it("uses page sizes that produce complete rows at every density", () => {
    for (const pageSize of CATALOG_PAGE_SIZES) {
      for (const columns of CATALOG_COLUMN_OPTIONS) {
        expect(pageSize % columns).toBe(0);
      }
    }
  });

  it("parses repeated filters and rejects unsupported values", () => {
    expect(
      parseCatalogFilters({
        q: " Lux ",
        expansion: ["4521", "bad", "4521"],
        rarity: ["Epic", "Showcase"],
        language: ["en", "invalid"],
        finish: "foil",
        printing: "named",
        artwork: "with",
        sort: "name-desc",
        page: "3",
        perPage: "48",
        columns: "6",
      }),
    ).toMatchObject({
      query: "Lux",
      expansionIds: [4521],
      rarities: ["Epic", "Showcase"],
      languages: ["en"],
      finish: "foil",
      printing: "named",
      artwork: "with",
      sort: "name-desc",
      page: 3,
      perPage: 48,
      columns: 6,
    });
  });

  it("uses safe defaults for malformed pagination and enums", () => {
    expect(
      parseCatalogFilters({
        finish: "glitter",
        sort: "random",
        page: "-2",
        perPage: "5000",
        columns: "5",
      }),
    ).toMatchObject({
      finish: "any",
      sort: "expansion-asc",
      page: 1,
      perPage: 24,
      columns: 8,
    });
  });

  it("creates shareable URLs and resets pagination after filter changes", () => {
    const filters = parseCatalogFilters({
      q: "Lux",
      expansion: ["4521", "4166"],
      language: "en",
      page: "4",
    });

    expect(catalogHref(filters, { finish: "foil" })).toBe(
      "/cards?q=Lux&expansion=4521&expansion=4166&language=en&finish=foil",
    );
    expect(catalogHref(filters, { page: 2 })).toContain("page=2");
  });

  it("counts only filtering dimensions and toggles repeated values", () => {
    const filters = parseCatalogFilters({
      q: "Lux",
      expansion: ["1", "2"],
      rarity: "Epic",
      sort: "name-desc",
      perPage: "96",
      columns: "4",
    });

    expect(catalogFilterCount(filters)).toBe(3);
    expect(catalogHref(filters)).toContain("columns=4");
    expect(toggleCatalogValue(filters.expansionIds, 2)).toEqual([1]);
    expect(toggleCatalogValue(filters.languages, "en")).toEqual(["en"]);
  });
});

import Link from "next/link";
import { eq } from "drizzle-orm";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { getDb } from "@/db";
import { userPreferences } from "@/db/schema";
import { CatalogToolbar } from "@/components/catalog-filters";
import {
  CatalogCardActions,
  CatalogPageSelection,
  CatalogSelectionProvider,
  type CatalogSelectedCard,
} from "@/components/catalog-selection";
import { CardArt } from "@/components/card-art";
import { PageHeading } from "@/components/page-heading";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  catalogHref,
  parseCatalogFilters,
  type CatalogColumns,
  type CatalogFilters,
  type CatalogSearchParams,
} from "@/lib/catalog/filters";
import {
  formatCompactLanguageCode,
  formatLanguageCode,
  getBlueprintFinishLabel,
  getBlueprintLanguageCodes,
} from "@/lib/catalog/metadata";
import {
  searchCatalog,
  type CatalogExpansionOption,
} from "@/lib/catalog/search";
import { requireUser } from "@/lib/auth/guards";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  fr: "French",
  kr: "Korean",
  "zh-CN": "Chinese",
};

const FINISH_LABELS: Record<CatalogFilters["finish"], string> = {
  any: "Any finish",
  foil: "Foil available",
  nonfoil: "Non-foil available",
  flexible: "Foil + non-foil options",
  fixed: "Fixed finish",
};

const PRINTING_LABELS: Record<CatalogFilters["printing"], string> = {
  any: "Any printing",
  standard: "Standard printing",
  named: "Named or special printing",
};

const ARTWORK_LABELS: Record<CatalogFilters["artwork"], string> = {
  any: "Any artwork",
  with: "Artwork available",
  missing: "Missing artwork",
};

const CATALOG_GRID_CLASSES: Record<CatalogColumns, string> = {
  2: "grid-cols-1 min-[360px]:grid-cols-2",
  3: "grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3",
  4: "grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
  6: "grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6",
  8: "grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 min-[1920px]:!grid-cols-8",
  12: "grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6 min-[1920px]:!grid-cols-8 min-[2560px]:!grid-cols-12",
};

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogSearchParams>;
}) {
  const requestedFilters = parseCatalogFilters(await searchParams);
  const user = await requireUser();
  const [result, preferences] = await Promise.all([
    searchCatalog(requestedFilters),
    getDb()
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1)
      .then((rows) => rows[0]),
  ]);
  const filters = { ...requestedFilters, page: result.page };
  const firstResult = result.total
    ? (result.page - 1) * filters.perPage + 1
    : 0;
  const lastResult = Math.min(result.page * filters.perPage, result.total);
  const selectionCards: CatalogSelectedCard[] = result.rows.map(
    ({ card, expansion }) => ({
      id: card.id,
      name: card.name,
      printing: [
        expansion.code.toUpperCase(),
        card.collectorNumber ? `#${card.collectorNumber}` : null,
        card.version?.trim() || "Standard",
      ]
        .filter(Boolean)
        .join(" · "),
    }),
  );

  return (
    <>
      <PageHeading
        eyebrow="Catalog"
        title="Discover Riftbound singles"
        description="Search and filter every active CardTrader printing. Open a card to turn the exact printing into a price watch."
      />

      <CatalogSelectionProvider>
        <CatalogToolbar
          filters={filters}
          expansions={result.expansionOptions}
          rarities={result.rarityOptions}
          watchDefaults={{
            languages: preferences?.languages,
            conditions: preferences?.conditions,
            requireZero: preferences?.requireZero,
          }}
        />
        <ActiveFilters filters={filters} expansions={result.expansionOptions} />

        <section className="min-w-0" aria-label="Catalog results">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
            <div className="space-y-2">
              <p className="text-slate-400" aria-live="polite">
                {result.total ? (
                  <>
                    Showing{" "}
                    <span className="text-slate-200">
                      {firstResult}–{lastResult}
                    </span>{" "}
                    of <span className="text-slate-200">{result.total}</span>{" "}
                    printings
                  </>
                ) : (
                  "No matching printings"
                )}
              </p>
              {selectionCards.length ? (
                <CatalogPageSelection cards={selectionCards} />
              ) : null}
            </div>
            {result.totalPages > 1 ? (
              <p className="text-xs text-slate-500">
                Page {result.page} of {result.totalPages}
              </p>
            ) : null}
          </div>

          {result.rows.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <p className="text-sm text-slate-300">
                  No cards match this combination of filters.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  Try removing a rarity, language, or printing constraint.
                </p>
                <Link
                  href="/cards"
                  className={buttonVariants({
                    variant: "outline",
                    className: "mt-5",
                  })}
                >
                  Clear all filters
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div
              className={`grid gap-4 ${CATALOG_GRID_CLASSES[filters.columns]}`}
              data-card-columns={filters.columns}
            >
              {result.rows.map(({ card, expansion }) => {
                const languages = getBlueprintLanguageCodes(
                  card.editableProperties,
                );
                const finish = getBlueprintFinishLabel(card.editableProperties);
                const printingCode = [
                  expansion.code.toUpperCase(),
                  card.collectorNumber ? `#${card.collectorNumber}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <Card
                    key={card.id}
                    className="group relative h-full overflow-hidden transition hover:-translate-y-1 hover:border-cyan-300/30"
                  >
                    <CatalogCardActions
                      card={selectionCards.find((item) => item.id === card.id)!}
                    />
                    <Link href={`/cards/${card.id}`} className="block h-full">
                      <CardArt
                        src={card.imageUrl}
                        alt={card.name}
                        sizes="(max-width: 359px) 100vw, (max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1535px) 25vw, 12rem"
                        className="aspect-[0.716] rounded-none"
                      />
                      <CardContent className="flex h-52 flex-col p-3">
                        <p className="line-clamp-2 text-sm font-medium">
                          {card.name}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-cyan-200">
                          {expansion.name}
                        </p>
                        <p
                          className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400"
                          title={card.version ?? "Standard printing"}
                        >
                          {card.version?.trim() || "Standard printing"}
                        </p>

                        <div className="mt-auto space-y-2 pt-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="muted">{printingCode}</Badge>
                            {card.rarity ? (
                              <Badge variant="default">{card.rarity}</Badge>
                            ) : null}
                          </div>
                          <p
                            className="line-clamp-1 text-[11px] text-slate-500"
                            title={
                              languages.length > 0
                                ? `Available listing languages: ${languages.map(formatLanguageCode).join(", ")}`
                                : undefined
                            }
                          >
                            {languages.length > 0
                              ? `Lang: ${languages.map(formatCompactLanguageCode).join(" / ")}`
                              : "Language: Not specified"}
                          </p>
                          <p className="line-clamp-1 text-[11px] text-slate-500">
                            Finish: {finish ?? "Fixed by printing"}
                          </p>
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                );
              })}
            </div>
          )}

          <CatalogPagination filters={filters} totalPages={result.totalPages} />
        </section>
      </CatalogSelectionProvider>
    </>
  );
}

function ActiveFilters({
  filters,
  expansions,
}: {
  filters: CatalogFilters;
  expansions: CatalogExpansionOption[];
}) {
  const pills: Array<{ key: string; label: string; href: string }> = [];
  if (filters.query) {
    pills.push({
      key: "query",
      label: `Search: ${filters.query}`,
      href: catalogHref(filters, { query: "" }),
    });
  }
  for (const id of filters.expansionIds) {
    pills.push({
      key: `expansion-${id}`,
      label:
        expansions.find((expansion) => expansion.id === id)?.name ??
        `Expansion ${id}`,
      href: catalogHref(filters, {
        expansionIds: filters.expansionIds.filter((value) => value !== id),
      }),
    });
  }
  for (const rarity of filters.rarities) {
    pills.push({
      key: `rarity-${rarity}`,
      label: rarity,
      href: catalogHref(filters, {
        rarities: filters.rarities.filter((value) => value !== rarity),
      }),
    });
  }
  for (const language of filters.languages) {
    pills.push({
      key: `language-${language}`,
      label: LANGUAGE_LABELS[language] ?? language,
      href: catalogHref(filters, {
        languages: filters.languages.filter((value) => value !== language),
      }),
    });
  }
  if (filters.finish !== "any") {
    pills.push({
      key: "finish",
      label: FINISH_LABELS[filters.finish],
      href: catalogHref(filters, { finish: "any" }),
    });
  }
  if (filters.printing !== "any") {
    pills.push({
      key: "printing",
      label: PRINTING_LABELS[filters.printing],
      href: catalogHref(filters, { printing: "any" }),
    });
  }
  if (filters.version) {
    pills.push({
      key: "version",
      label: `Version: ${filters.version}`,
      href: catalogHref(filters, { version: "" }),
    });
  }
  if (filters.collectorNumber) {
    pills.push({
      key: "collector",
      label: `Collector: ${filters.collectorNumber}`,
      href: catalogHref(filters, { collectorNumber: "" }),
    });
  }
  if (filters.artwork !== "any") {
    pills.push({
      key: "artwork",
      label: ARTWORK_LABELS[filters.artwork],
      href: catalogHref(filters, { artwork: "any" }),
    });
  }

  if (!pills.length) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {pills.map((pill) => (
        <Link
          key={pill.key}
          href={pill.href}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs text-cyan-100 transition-colors hover:border-cyan-300/40 hover:bg-cyan-300/15"
        >
          {pill.label} <X className="size-3" />
        </Link>
      ))}
      <Link
        href="/cards"
        className="px-2 py-1.5 text-xs text-slate-500 transition-colors hover:text-white"
      >
        Clear all
      </Link>
    </div>
  );
}

function CatalogPagination({
  filters,
  totalPages,
}: {
  filters: CatalogFilters;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav
      className="mt-8 flex items-center justify-between gap-3 border-t pt-6"
      aria-label="Catalog pagination"
    >
      {filters.page > 1 ? (
        <Button asChild variant="outline">
          <Link href={catalogHref(filters, { page: filters.page - 1 })}>
            <ChevronLeft className="size-4" /> Previous
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          <ChevronLeft className="size-4" /> Previous
        </Button>
      )}
      <span className="text-xs text-slate-500">
        {filters.page} / {totalPages}
      </span>
      {filters.page < totalPages ? (
        <Button asChild variant="outline">
          <Link href={catalogHref(filters, { page: filters.page + 1 })}>
            Next <ChevronRight className="size-4" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" disabled>
          Next <ChevronRight className="size-4" />
        </Button>
      )}
    </nav>
  );
}

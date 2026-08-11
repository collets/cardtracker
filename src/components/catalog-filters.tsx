"use client";

import Link from "next/link";
import { Minus, Plus, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { CatalogBulkWatchDialog } from "@/components/catalog-selection";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATALOG_PAGE_SIZES,
  CATALOG_COLUMN_OPTIONS,
  catalogFilterCount,
  catalogFilterEntries,
  catalogHref,
  toggleCatalogValue,
  type CatalogFilters,
} from "@/lib/catalog/filters";
import type {
  CatalogExpansionOption,
  CatalogRarityOption,
} from "@/lib/catalog/search";
import { cn } from "@/lib/utils";
import type { WatchFormDefaults } from "@/components/watch-options-fields";

const LANGUAGE_OPTIONS = [
  ["en", "English"],
  ["fr", "French"],
  ["kr", "Korean"],
  ["zh-CN", "Chinese"],
] as const;

type CatalogFilterProps = {
  filters: CatalogFilters;
  expansions: CatalogExpansionOption[];
  rarities: CatalogRarityOption[];
  watchDefaults?: WatchFormDefaults;
};

function QuickFilter({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        buttonVariants({ variant: "outline", size: "sm" }),
        "shrink-0",
        active &&
          "border-cyan-300/40 bg-cyan-300/15 text-cyan-100 shadow-sm shadow-cyan-950/30",
      )}
    >
      {children}
    </Link>
  );
}

function CardDensityControl({ filters }: { filters: CatalogFilters }) {
  const currentIndex = CATALOG_COLUMN_OPTIONS.indexOf(filters.columns);
  const previous = CATALOG_COLUMN_OPTIONS[currentIndex - 1];
  const next = CATALOG_COLUMN_OPTIONS[currentIndex + 1];
  const controlClass =
    "grid size-8 shrink-0 place-items-center text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:outline-none";

  return (
    <div
      className="flex h-8 shrink-0 items-center overflow-hidden rounded-md border bg-slate-950/50"
      role="group"
      aria-label={`Card density, up to ${filters.columns} cards per row`}
    >
      {previous ? (
        <Link
          href={catalogHref(filters, { columns: previous })}
          className={controlClass}
          aria-label="Show fewer cards per row"
          title="Show fewer cards per row"
        >
          <Minus className="size-3.5" />
        </Link>
      ) : (
        <span className={cn(controlClass, "cursor-not-allowed opacity-35")}>
          <Minus className="size-3.5" />
        </span>
      )}
      <span
        className="grid h-full min-w-9 place-items-center border-x px-2 text-xs font-medium text-slate-200 tabular-nums"
        title={`Up to ${filters.columns} cards per row`}
      >
        {filters.columns}
      </span>
      {next ? (
        <Link
          href={catalogHref(filters, { columns: next })}
          className={controlClass}
          aria-label="Show more cards per row"
          title="Show more cards per row"
        >
          <Plus className="size-3.5" />
        </Link>
      ) : (
        <span className={cn(controlClass, "cursor-not-allowed opacity-35")}>
          <Plus className="size-3.5" />
        </span>
      )}
    </div>
  );
}

export function CatalogToolbar({
  filters,
  expansions,
  rarities,
  watchDefaults,
}: CatalogFilterProps) {
  const vendetta = expansions.find((expansion) => expansion.code === "ven");
  const filterCount = catalogFilterCount(filters);
  const preservedSearchEntries = catalogFilterEntries(filters).filter(
    ([name]) => name !== "q" && name !== "page",
  );
  const filterFormKey = new URLSearchParams(
    catalogFilterEntries(filters).filter(([name]) => name !== "page"),
  ).toString();

  return (
    <div className="mb-6">
      <form action="/cards" className="flex min-w-0 gap-2">
        {preservedSearchEntries.map(([name, value]) => (
          <input
            key={`${name}-${value}`}
            type="hidden"
            name={name}
            value={value}
          />
        ))}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500" />
          <Input
            name="q"
            defaultValue={filters.query}
            placeholder="Name, set, rarity, version or collector number…"
            className="pl-10"
            aria-label="Search cards"
          />
        </div>
        <Button type="submit" variant="secondary">
          <Search className="size-4 sm:hidden" />
          <span className="hidden sm:inline">Search</span>
        </Button>
      </form>

      <div className="mt-3 flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto pb-1">
          {vendetta ? (
            <QuickFilter
              active={filters.expansionIds.includes(vendetta.id)}
              href={catalogHref(filters, {
                expansionIds: toggleCatalogValue(
                  filters.expansionIds,
                  vendetta.id,
                ),
              })}
            >
              <Sparkles className="size-3.5" /> Vendetta
            </QuickFilter>
          ) : null}
          <QuickFilter
            active={filters.languages.includes("en")}
            href={catalogHref(filters, {
              languages: toggleCatalogValue(filters.languages, "en"),
            })}
          >
            English
          </QuickFilter>
          <QuickFilter
            active={filters.finish === "foil"}
            href={catalogHref(filters, {
              finish: filters.finish === "foil" ? "any" : "foil",
            })}
          >
            Foil available
          </QuickFilter>
          <QuickFilter
            active={filters.printing === "standard"}
            href={catalogHref(filters, {
              printing: filters.printing === "standard" ? "any" : "standard",
            })}
          >
            Standard
          </QuickFilter>
        </div>
        <CatalogBulkWatchDialog defaults={watchDefaults} />
        <CardDensityControl filters={filters} />
        <Dialog>
          <DialogTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0"
            >
              <SlidersHorizontal className="size-3.5" /> Filters
              {filterCount ? (
                <span className="grid size-5 place-items-center rounded-full bg-cyan-300 text-[11px] font-semibold text-slate-950">
                  {filterCount}
                </span>
              ) : null}
            </Button>
          </DialogTrigger>
          <DialogContent className="inset-y-0 top-0 right-0 left-auto flex h-dvh max-h-none w-full max-w-md translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 p-0 sm:rounded-l-2xl">
            <DialogHeader className="shrink-0 border-b px-5 py-5 pr-14">
              <DialogTitle>Filter the catalog</DialogTitle>
              <DialogDescription>
                Narrow all Riftbound printings. Filters are saved in the URL.
              </DialogDescription>
            </DialogHeader>
            <div className="app-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5">
              <CatalogFilterForm
                key={filterFormKey || "default"}
                idPrefix="drawer"
                filters={filters}
                expansions={expansions}
                rarities={rarities}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function CatalogFilterForm({
  idPrefix,
  filters,
  expansions,
  rarities,
}: Omit<CatalogFilterProps, "watchDefaults"> & { idPrefix: string }) {
  const resetHref = filters.query
    ? `/cards?q=${encodeURIComponent(filters.query)}`
    : "/cards";

  return (
    <form action="/cards" className="space-y-6">
      {filters.query ? (
        <input type="hidden" name="q" value={filters.query} />
      ) : null}
      <input type="hidden" name="columns" value={filters.columns} />

      <fieldset className="min-w-0">
        <legend className="text-sm font-medium">Expansion</legend>
        <div className="app-scrollbar mt-3 max-h-56 min-w-0 space-y-2 overflow-x-hidden overflow-y-auto rounded-xl border bg-black/10 p-3">
          {expansions.map((expansion) => (
            <Checkbox
              key={expansion.id}
              name="expansion"
              value={String(expansion.id)}
              defaultChecked={filters.expansionIds.includes(expansion.id)}
              containerClassName="w-full min-w-0 text-xs"
              labelClassName="min-w-0 flex-1 overflow-hidden"
              label={
                <span className="flex w-full min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-left" title={expansion.name}>
                    {expansion.name}
                  </span>
                  <span className="shrink-0 text-slate-600">
                    {expansion.count}
                  </span>
                </span>
              }
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Rarity</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {rarities.map((rarity) => (
            <Checkbox
              key={rarity.value}
              name="rarity"
              value={rarity.value}
              defaultChecked={filters.rarities.includes(rarity.value)}
              containerClassName="text-xs"
              label={`${rarity.value} (${rarity.count})`}
            />
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium">Language availability</legend>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {LANGUAGE_OPTIONS.map(([value, label]) => (
            <Checkbox
              key={value}
              name="language"
              value={value}
              defaultChecked={filters.languages.includes(value)}
              containerClassName="text-xs"
              label={label}
            />
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-finish`}>Finish availability</Label>
        <Select name="finish" defaultValue={filters.finish}>
          <SelectTrigger id={`${idPrefix}-finish`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any finish</SelectItem>
            <SelectItem value="foil">Foil available</SelectItem>
            <SelectItem value="nonfoil">Non-foil available</SelectItem>
            <SelectItem value="flexible">Foil + non-foil options</SelectItem>
            <SelectItem value="fixed">Fixed by printing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-printing`}>Printing type</Label>
        <Select name="printing" defaultValue={filters.printing}>
          <SelectTrigger id={`${idPrefix}-printing`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any printing</SelectItem>
            <SelectItem value="standard">Standard printing</SelectItem>
            <SelectItem value="named">Named or special printing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-version`}>Version contains</Label>
        <Input
          id={`${idPrefix}-version`}
          name="version"
          defaultValue={filters.version}
          placeholder="Alternate Art, Promo…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-collector`}>Collector number</Label>
        <Input
          id={`${idPrefix}-collector`}
          name="collector"
          defaultValue={filters.collectorNumber}
          placeholder="178a, 042…"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-artwork`}>Artwork</Label>
        <Select name="artwork" defaultValue={filters.artwork}>
          <SelectTrigger id={`${idPrefix}-artwork`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">With or without artwork</SelectItem>
            <SelectItem value="with">Artwork available</SelectItem>
            <SelectItem value="missing">Missing artwork</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-sort`}>Sort by</Label>
        <Select name="sort" defaultValue={filters.sort}>
          <SelectTrigger id={`${idPrefix}-sort`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expansion-asc">Expansion A–Z</SelectItem>
            <SelectItem value="expansion-desc">Expansion Z–A</SelectItem>
            <SelectItem value="name-asc">Card name A–Z</SelectItem>
            <SelectItem value="name-desc">Card name Z–A</SelectItem>
            <SelectItem value="collector-asc">Collector number</SelectItem>
            <SelectItem value="rarity-asc">Rarity</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-per-page`}>Results per page</Label>
        <Select name="perPage" defaultValue={String(filters.perPage)}>
          <SelectTrigger id={`${idPrefix}-per-page`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATALOG_PAGE_SIZES.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} cards
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t pt-5">
        <Link href={resetHref} className={buttonVariants({ variant: "ghost" })}>
          Reset
        </Link>
        <Button type="submit">Apply filters</Button>
      </div>
    </form>
  );
}

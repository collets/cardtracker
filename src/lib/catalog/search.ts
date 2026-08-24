import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "@/db";
import { blueprints, expansions } from "@/db/schema";
import type { CatalogFilters, CatalogSort } from "@/lib/catalog/filters";

export type CatalogExpansionOption = {
  id: number;
  code: string;
  name: string;
  count: number;
};

export type CatalogRarityOption = {
  value: string;
  count: number;
};

function propertyContains(name: string, value: string | boolean): SQL {
  return sql`${blueprints.editableProperties} @> ${JSON.stringify([
    { name, possible_values: [value] },
  ])}::jsonb`;
}

function catalogConditions(filters: CatalogFilters): SQL[] {
  const conditions: SQL[] = [
    eq(blueprints.active, true),
    eq(expansions.active, true),
  ];

  if (filters.query) {
    const query = `%${filters.query}%`;
    const search = or(
      ilike(blueprints.name, query),
      ilike(blueprints.version, query),
      ilike(blueprints.collectorNumber, query),
      ilike(blueprints.rarity, query),
      ilike(expansions.name, query),
      ilike(expansions.code, query),
    );
    if (search) conditions.push(search);
  }

  if (filters.expansionIds.length) {
    conditions.push(inArray(blueprints.expansionId, filters.expansionIds));
  }
  if (filters.rarities.length) {
    conditions.push(inArray(blueprints.rarity, filters.rarities));
  }
  if (filters.languages.length) {
    const languageCondition = or(
      ...filters.languages.map((language) =>
        propertyContains("riftbound_language", language),
      ),
    );
    if (languageCondition) conditions.push(languageCondition);
  }

  const supportsFoil = propertyContains("riftbound_foil", true);
  const supportsNonFoil = propertyContains("riftbound_foil", false);
  if (filters.finish === "foil") conditions.push(supportsFoil);
  if (filters.finish === "nonfoil") conditions.push(supportsNonFoil);
  if (filters.finish === "flexible") {
    conditions.push(supportsFoil, supportsNonFoil);
  }
  if (filters.finish === "fixed") {
    conditions.push(
      sql`NOT (${blueprints.editableProperties} @> ${JSON.stringify([
        { name: "riftbound_foil" },
      ])}::jsonb)`,
    );
  }

  if (filters.printing === "standard") {
    conditions.push(sql`btrim(coalesce(${blueprints.version}, '')) = ''`);
  }
  if (filters.printing === "named") {
    conditions.push(sql`btrim(coalesce(${blueprints.version}, '')) <> ''`);
  }
  if (filters.version) {
    conditions.push(ilike(blueprints.version, `%${filters.version}%`));
  }
  if (filters.collectorNumber) {
    conditions.push(
      ilike(blueprints.collectorNumber, `%${filters.collectorNumber}%`),
    );
  }
  if (filters.artwork === "with") {
    conditions.push(
      isNotNull(blueprints.imageUrl),
      ne(blueprints.imageUrl, ""),
    );
  }
  if (filters.artwork === "missing") {
    const missingArtwork = or(
      isNull(blueprints.imageUrl),
      eq(blueprints.imageUrl, ""),
    );
    if (missingArtwork) conditions.push(missingArtwork);
  }

  return conditions;
}

function catalogOrder(sort: CatalogSort): SQL[] {
  switch (sort) {
    case "expansion-desc":
      return [
        desc(expansions.name),
        asc(blueprints.name),
        asc(blueprints.version),
        asc(blueprints.id),
      ];
    case "name-asc":
      return [
        asc(blueprints.name),
        asc(expansions.name),
        asc(blueprints.version),
        asc(blueprints.id),
      ];
    case "name-desc":
      return [
        desc(blueprints.name),
        asc(expansions.name),
        asc(blueprints.version),
        asc(blueprints.id),
      ];
    case "collector-asc":
      return [
        sql`${blueprints.collectorNumber} ASC NULLS LAST`,
        asc(expansions.name),
        asc(blueprints.name),
        asc(blueprints.id),
      ];
    case "rarity-asc":
      return [
        sql`${blueprints.rarity} ASC NULLS LAST`,
        asc(blueprints.name),
        asc(expansions.name),
        asc(blueprints.id),
      ];
    case "expansion-asc":
      return [
        asc(expansions.name),
        asc(blueprints.name),
        asc(blueprints.version),
        asc(blueprints.id),
      ];
  }
}

export async function searchCatalog(filters: CatalogFilters) {
  return getDb().transaction(async (db) => {
    await db.execute(sql`set transaction read only`);
    await db.execute(sql`
      select
        set_config('statement_timeout', '10s', true),
        set_config('lock_timeout', '3s', true),
        set_config('idle_in_transaction_session_timeout', '15s', true)
    `);
    const where = and(...catalogConditions(filters));

    const totalRows = await db
      .select({ value: count() })
      .from(blueprints)
      .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
      .where(where);
    const [expansionOptions, rarityOptions] = await Promise.all([
      db
        .select({
          id: expansions.id,
          code: expansions.code,
          name: expansions.name,
          count: count(),
        })
        .from(expansions)
        .innerJoin(
          blueprints,
          and(
            eq(blueprints.expansionId, expansions.id),
            eq(blueprints.active, true),
          ),
        )
        .where(eq(expansions.active, true))
        .groupBy(expansions.id, expansions.code, expansions.name)
        .orderBy(asc(expansions.name)),
      db
        .select({ value: blueprints.rarity, count: count() })
        .from(blueprints)
        .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
        .where(
          and(
            eq(blueprints.active, true),
            eq(expansions.active, true),
            isNotNull(blueprints.rarity),
          ),
        )
        .groupBy(blueprints.rarity)
        .orderBy(asc(blueprints.rarity)),
    ]);

    const total = totalRows[0]?.value ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / filters.perPage));
    const page = Math.min(filters.page, totalPages);
    const rows = await db
      .select({ card: blueprints, expansion: expansions })
      .from(blueprints)
      .innerJoin(expansions, eq(expansions.id, blueprints.expansionId))
      .where(where)
      .orderBy(...catalogOrder(filters.sort))
      .limit(filters.perPage)
      .offset((page - 1) * filters.perPage);

    return {
      rows,
      total,
      totalPages,
      page,
      expansionOptions: expansionOptions satisfies CatalogExpansionOption[],
      rarityOptions: rarityOptions
        .filter(
          (option): option is { value: string; count: number } =>
            option.value !== null,
        )
        .map((option) => ({
          value: option.value,
          count: option.count,
        })) satisfies CatalogRarityOption[],
    };
  });
}

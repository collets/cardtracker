#!/usr/bin/env node

import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const args = process.argv.slice(2);

function argument(flag: string, fallback: string) {
  const index = args.indexOf(flag);
  return index >= 0 ? (args[index + 1] ?? fallback) : fallback;
}

function percent(numerator: number, denominator: number) {
  return denominator === 0
    ? "0.0%"
    : `${((numerator / denominator) * 100).toFixed(1)}%`;
}

const expansionName = argument("--expansion", "Vendetta");
const sampleSize = Number(argument("--sample-size", "30"));
if (!Number.isInteger(sampleSize) || sampleSize < 1 || sampleSize > 100) {
  throw new Error("--sample-size must be an integer between 1 and 100");
}

const [
  { and, asc, eq, sql },
  { getDb, getSql },
  schema,
  constants,
  deals,
  clientModule,
] = await Promise.all([
  import("drizzle-orm"),
  import("@/db"),
  import("@/db/schema"),
  import("@/lib/constants"),
  import("@/lib/deals/evaluate"),
  import("@/lib/cardtrader/client"),
]);

const [expansion] = await getDb()
  .select({ id: schema.expansions.id, name: schema.expansions.name })
  .from(schema.expansions)
  .where(
    and(
      eq(schema.expansions.active, true),
      sql`lower(${schema.expansions.name}) = lower(${expansionName})`,
    ),
  )
  .limit(1);

if (!expansion) {
  await getSql().end();
  throw new Error(
    `Active expansion ${JSON.stringify(expansionName)} was not found; synchronize the catalog first`,
  );
}

const cards = await getDb()
  .select({ id: schema.blueprints.id, rarity: schema.blueprints.rarity })
  .from(schema.blueprints)
  .where(
    and(
      eq(schema.blueprints.expansionId, expansion.id),
      eq(schema.blueprints.active, true),
    ),
  )
  .orderBy(asc(schema.blueprints.id));
await getSql().end();

const byRarity = new Map<string, typeof cards>();
for (const card of cards) {
  const rarity = card.rarity ?? "Unknown";
  byRarity.set(rarity, [...(byRarity.get(rarity) ?? []), card]);
}
const rarityGroups = [...byRarity.entries()].sort(([left], [right]) =>
  left.localeCompare(right),
);
const selected: typeof cards = [];
for (let offset = 0; selected.length < sampleSize; offset += 1) {
  let added = false;
  for (const [, group] of rarityGroups) {
    const card = group[offset];
    if (!card || selected.length >= sampleSize) continue;
    selected.push(card);
    added = true;
  }
  if (!added) break;
}

const filters = {
  languages: [...constants.DEFAULT_LANGUAGES],
  conditions: [...constants.DEFAULT_CONDITIONS],
  foil: null,
  graded: false,
  requireZero: false,
  sellerCountries: [...constants.EU_EEA_COUNTRY_CODES],
  discountPercent: constants.DEFAULT_DISCOUNT_PERCENT,
  minSavingsCents: constants.DEFAULT_MIN_SAVINGS_CENTS,
};
const thresholds = [
  { discountPercent: 15, minSavingsCents: 300 },
  { discountPercent: 20, minSavingsCents: 500 },
  { discountPercent: 25, minSavingsCents: 1_000 },
];
const triggerCounts = new Map(thresholds.map((threshold) => [threshold, 0]));
const discounts: number[] = [];
let withEligibleListings = 0;
let withBaseline = 0;
let failures = 0;
const client = new clientModule.CardTraderClient();

let previousStart = 0;
for (const [index, card] of selected.entries()) {
  const waitMs = Math.max(0, previousStart + 200 - Date.now());
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
  previousStart = Date.now();
  process.stderr.write(
    `Sampling ${index + 1}/${selected.length} (${card.rarity ?? "Unknown"})\n`,
  );
  try {
    const listings = await client.marketplaceProducts(card.id);
    const evaluation = deals.evaluateDeal(listings, filters);
    if (evaluation.eligibleListings.length > 0) withEligibleListings += 1;
    if (evaluation.currentBaselineCents !== null) withBaseline += 1;
    if (evaluation.discountBps !== null) discounts.push(evaluation.discountBps);
    for (const threshold of thresholds) {
      const outcome = deals.evaluateDeal(listings, {
        ...filters,
        ...threshold,
      });
      if (outcome.qualifies) {
        triggerCounts.set(threshold, (triggerCounts.get(threshold) ?? 0) + 1);
      }
    }
  } catch (error) {
    failures += 1;
    const status =
      error instanceof clientModule.CardTraderError ? error.status : null;
    process.stderr.write(
      `Sample request failed${status === null ? "" : ` (HTTP ${status})`}\n`,
    );
  }
}

const completed = selected.length - failures;
const medianDiscountBps = deals.median(discounts);
process.stdout.write(`# Vendetta marketplace calibration

- Generated: ${new Date().toISOString()}
- Method: deterministic rarity-stratified snapshot
- Requested sample: ${sampleSize}
- Selected blueprints: ${selected.length}
- Successful responses: ${completed}
- Failed responses: ${failures}
- Cards with at least one eligible listing: ${withEligibleListings} (${percent(withEligibleListings, completed)})
- Cards with a current comparator baseline: ${withBaseline} (${percent(withBaseline, completed)})
- Median candidate discount where measurable: ${medianDiscountBps === null ? "not available" : `${(medianDiscountBps / 100).toFixed(1)}%`}

## Snapshot trigger counts

| Relative discount | Absolute saving | Qualifying cards |
| ---: | ---: | ---: |
${thresholds
  .map(
    (threshold) =>
      `| ${threshold.discountPercent}% | €${(threshold.minSavingsCents / 100).toFixed(2)} | ${triggerCounts.get(threshold) ?? 0} |`,
  )
  .join("\n")}

This report contains aggregate snapshot data only. It does not persist raw marketplace responses or modify Riftwatch's 20% and €5 defaults. A seven-day shadow run is still required before changing production thresholds.
`);

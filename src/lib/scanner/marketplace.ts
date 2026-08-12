import type { MarketListing } from "@/lib/cardtrader/types";

const MARKETPLACE_REQUESTS_PER_SECOND = 5;
export const EXPANSION_FETCH_MIN_BLUEPRINTS = 5;

export interface BlueprintMarketplaceProductClient {
  marketplaceProducts(blueprintId: number): Promise<MarketListing[]>;
}

export interface MarketplaceProductClient extends BlueprintMarketplaceProductClient {
  marketplaceProductsForExpansion(
    expansionId: number,
    blueprintIds: readonly number[],
  ): Promise<Map<number, MarketListing[]>>;
}

export type MarketplaceFetchJob =
  | {
      kind: "expansion";
      expansionId: number;
      blueprintIds: number[];
    }
  | {
      kind: "blueprint";
      blueprintId: number;
    };

export function planMarketplaceFetches(
  rows: ReadonlyArray<{ blueprintId: number; expansionId: number }>,
): MarketplaceFetchJob[] {
  const byExpansion = new Map<number, number[]>();
  for (const row of [...rows].sort(
    (left, right) =>
      left.expansionId - right.expansionId ||
      left.blueprintId - right.blueprintId,
  )) {
    const blueprintIds = byExpansion.get(row.expansionId) ?? [];
    blueprintIds.push(row.blueprintId);
    byExpansion.set(row.expansionId, blueprintIds);
  }

  const jobs: MarketplaceFetchJob[] = [];
  for (const [expansionId, blueprintIds] of byExpansion) {
    if (blueprintIds.length >= EXPANSION_FETCH_MIN_BLUEPRINTS) {
      jobs.push({ kind: "expansion", expansionId, blueprintIds });
    } else {
      jobs.push(
        ...blueprintIds.map((blueprintId): MarketplaceFetchJob => ({
          kind: "blueprint",
          blueprintId,
        })),
      );
    }
  }
  return jobs;
}

export async function fetchMarketplacePlan(
  jobs: readonly MarketplaceFetchJob[],
  client: MarketplaceProductClient,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  const listingsByBlueprint = new Map<number, MarketListing[]>();
  const failures = new Map<number, unknown>();
  const expansionFetches = jobs.filter(
    (job) => job.kind === "expansion",
  ).length;
  const blueprintFetches = jobs.length - expansionFetches;

  for (
    let index = 0;
    index < jobs.length;
    index += MARKETPLACE_REQUESTS_PER_SECOND
  ) {
    const batch = jobs.slice(index, index + MARKETPLACE_REQUESTS_PER_SECOND);
    const outcomes = await Promise.allSettled(
      batch.map(async (job) => {
        if (job.kind === "expansion") {
          return {
            kind: "expansion" as const,
            blueprintIds: job.blueprintIds,
            listings: await client.marketplaceProductsForExpansion(
              job.expansionId,
              job.blueprintIds,
            ),
          };
        }
        return {
          kind: "blueprint" as const,
          blueprintId: job.blueprintId,
          listings: await client.marketplaceProducts(job.blueprintId),
        };
      }),
    );

    outcomes.forEach((outcome, outcomeIndex) => {
      const job = batch[outcomeIndex];
      if (!job) return;
      if (outcome.status === "rejected") {
        const blueprintIds =
          job.kind === "expansion" ? job.blueprintIds : [job.blueprintId];
        for (const blueprintId of blueprintIds) {
          failures.set(blueprintId, outcome.reason);
        }
        return;
      }
      if (outcome.value.kind === "expansion") {
        for (const blueprintId of outcome.value.blueprintIds) {
          listingsByBlueprint.set(
            blueprintId,
            outcome.value.listings.get(blueprintId) ?? [],
          );
        }
      } else {
        listingsByBlueprint.set(
          outcome.value.blueprintId,
          outcome.value.listings,
        );
      }
    });

    if (index + MARKETPLACE_REQUESTS_PER_SECOND < jobs.length) {
      await wait(1_000);
    }
  }

  return {
    listingsByBlueprint,
    failures,
    expansionFetches,
    blueprintFetches,
  };
}

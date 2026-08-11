import { describe, expect, it, vi } from "vitest";
import {
  fetchMarketplacePlan,
  planMarketplaceFetches,
  type MarketplaceFetchJob,
  type MarketplaceProductClient,
} from "@/lib/scanner/marketplace";

function rows(expansionId: number, count: number, start = 1) {
  return Array.from({ length: count }, (_, index) => ({
    blueprintId: start + index,
    expansionId,
  }));
}

describe("marketplace fetch planning", () => {
  it("keeps four blueprints in one expansion as individual fetches", () => {
    expect(planMarketplaceFetches(rows(10, 4))).toEqual([
      { kind: "blueprint", blueprintId: 1 },
      { kind: "blueprint", blueprintId: 2 },
      { kind: "blueprint", blueprintId: 3 },
      { kind: "blueprint", blueprintId: 4 },
    ]);
  });

  it("collapses five blueprints in one expansion into one fetch", () => {
    expect(planMarketplaceFetches(rows(10, 5))).toEqual([
      {
        kind: "expansion",
        expansionId: 10,
        blueprintIds: [1, 2, 3, 4, 5],
      },
    ]);
  });

  it("chooses the strategy independently for each expansion", () => {
    expect(
      planMarketplaceFetches([...rows(20, 2, 20), ...rows(10, 5, 10)]),
    ).toEqual([
      {
        kind: "expansion",
        expansionId: 10,
        blueprintIds: [10, 11, 12, 13, 14],
      },
      { kind: "blueprint", blueprintId: 20 },
      { kind: "blueprint", blueprintId: 21 },
    ]);
  });
});

describe("marketplace fetch execution", () => {
  it("paces mixed marketplace calls in groups of five", async () => {
    const client = marketplaceClient();
    const wait = vi.fn().mockResolvedValue(undefined);
    const jobs: MarketplaceFetchJob[] = [
      { kind: "expansion", expansionId: 10, blueprintIds: [100, 101] },
      ...rows(20, 5).map(({ blueprintId }): MarketplaceFetchJob => ({
        kind: "blueprint",
        blueprintId,
      })),
    ];

    const result = await fetchMarketplacePlan(jobs, client, wait);

    expect(client.marketplaceProductsForExpansion).toHaveBeenCalledOnce();
    expect(client.marketplaceProducts).toHaveBeenCalledTimes(5);
    expect(wait).toHaveBeenCalledOnce();
    expect(wait).toHaveBeenCalledWith(1_000);
    expect(result).toMatchObject({
      expansionFetches: 1,
      blueprintFetches: 5,
    });
  });

  it("marks every bulk member failed without individual fallback", async () => {
    const client = marketplaceClient();
    vi.mocked(client.marketplaceProductsForExpansion).mockRejectedValueOnce(
      new Error("bulk unavailable"),
    );
    const jobs = planMarketplaceFetches(rows(10, 5));

    const result = await fetchMarketplacePlan(jobs, client);

    expect(client.marketplaceProductsForExpansion).toHaveBeenCalledOnce();
    expect(client.marketplaceProducts).not.toHaveBeenCalled();
    expect([...result.failures.keys()]).toEqual([1, 2, 3, 4, 5]);
    expect(result.listingsByBlueprint.size).toBe(0);
  });
});

function marketplaceClient(): MarketplaceProductClient {
  return {
    marketplaceProducts: vi.fn().mockResolvedValue([]),
    marketplaceProductsForExpansion: vi.fn().mockResolvedValue(new Map()),
  };
}

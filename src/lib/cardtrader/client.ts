import { z } from "zod";
import { CARDTRADER_BASE_URL } from "@/lib/constants";
import { requireEnv } from "@/lib/env";
import {
  cardTraderBlueprintSchema,
  cardTraderExpansionSchema,
  cardTraderProductSchema,
  normalizeProduct,
  type CardTraderBlueprint,
  type CardTraderExpansion,
  type MarketListing,
} from "@/lib/cardtrader/types";

const productResponseSchema = z.record(
  z.string(),
  z.array(cardTraderProductSchema),
);

export class CardTraderError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "CardTraderError";
  }
}

export interface CardTraderClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

export class CardTraderClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly retries: number;

  constructor(options: CardTraderClientOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retries = options.retries ?? 2;
  }

  async expansions(): Promise<CardTraderExpansion[]> {
    return z
      .array(cardTraderExpansionSchema)
      .parse(await this.request("/expansions?limit=4000000"));
  }

  async blueprints(expansionId: number): Promise<CardTraderBlueprint[]> {
    return z
      .array(cardTraderBlueprintSchema)
      .parse(
        await this.request(`/blueprints/export?expansion_id=${expansionId}`),
      );
  }

  async marketplaceProducts(blueprintId: number): Promise<MarketListing[]> {
    const response = productResponseSchema.parse(
      await this.request(`/marketplace/products?blueprint_id=${blueprintId}`),
    );
    return (response[String(blueprintId)] ?? []).map(normalizeProduct);
  }

  async marketplaceProductsForExpansion(
    expansionId: number,
    blueprintIds: readonly number[],
  ): Promise<Map<number, MarketListing[]>> {
    const response = productResponseSchema.parse(
      await this.request(`/marketplace/products?expansion_id=${expansionId}`),
    );
    return new Map(
      [...new Set(blueprintIds)].map((blueprintId) => [
        blueprintId,
        (response[String(blueprintId)] ?? []).map(normalizeProduct),
      ]),
    );
  }

  private async request(path: string): Promise<unknown> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(`${CARDTRADER_BASE_URL}${path}`, {
          headers: {
            Authorization: `Bearer ${requireEnv("CARD_TRADER_AUTH_TOKEN")}`,
            Accept: "application/json",
            "User-Agent": "Riftwatch/0.1",
          },
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryable = response.status === 429 || response.status >= 500;
          throw new CardTraderError(
            `CardTrader request failed with HTTP ${response.status}`,
            response.status,
            retryable,
          );
        }

        return (await response.json()) as unknown;
      } catch (error) {
        lastError = error;
        const retryable =
          error instanceof CardTraderError
            ? error.retryable
            : error instanceof DOMException;
        if (!retryable || attempt === this.retries) break;
        await new Promise((resolve) =>
          setTimeout(resolve, 300 * 2 ** attempt + Math.random() * 250),
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError instanceof CardTraderError) throw lastError;
    throw new CardTraderError(
      "CardTrader request timed out or returned invalid data",
      null,
      true,
    );
  }
}

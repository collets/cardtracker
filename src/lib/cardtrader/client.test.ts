import { beforeAll, describe, expect, it, vi } from "vitest";
import { CardTraderClient } from "@/lib/cardtrader/client";

beforeAll(() => {
  process.env.CARD_TRADER_AUTH_TOKEN = "unit-test-token";
});

describe("CardTraderClient", () => {
  it("uses the authenticated server request boundary", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json([
          { id: 4521, game_id: 22, code: "VDT", name: "Vendetta" },
        ]),
      );
    const client = new CardTraderClient({ fetchImpl, retries: 0 });

    await expect(client.expansions()).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toContain("/expansions?limit=4000000");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer unit-test-token",
    );
    expect(init).toMatchObject({ cache: "no-store" });
  });

  it("retries rate limits and succeeds without exposing response bodies", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response("unsafe upstream details", { status: 429 }),
      )
      .mockResolvedValueOnce(
        Response.json([
          { id: 4521, game_id: 22, code: "VDT", name: "Vendetta" },
        ]),
      );
    const client = new CardTraderClient({ fetchImpl, retries: 1 });

    await expect(client.expansions()).resolves.toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("classifies non-retryable responses using only the HTTP status", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response("unsafe upstream details", { status: 400 }),
      );
    const client = new CardTraderClient({ fetchImpl, retries: 2 });

    await expect(client.expansions()).rejects.toMatchObject({
      message: "CardTrader request failed with HTTP 400",
      status: 400,
      retryable: false,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("reduces transport failures to a safe retryable error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("transport internals", "AbortError"));
    const client = new CardTraderClient({ fetchImpl, retries: 0 });

    await expect(client.expansions()).rejects.toMatchObject({
      message: "CardTrader request timed out or returned invalid data",
      status: null,
      retryable: true,
    });
  });
});

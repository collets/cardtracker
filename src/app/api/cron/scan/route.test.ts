import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEnv: vi.fn<(key: string) => string>(),
  runMarketScanner: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ requireEnv: mocks.requireEnv }));
vi.mock("@/lib/scanner/service", () => ({
  runMarketScanner: mocks.runMarketScanner,
}));

import { GET } from "@/app/api/cron/scan/route";

describe("GET /api/cron/scan", () => {
  beforeEach(() => {
    mocks.requireEnv.mockReset();
    mocks.runMarketScanner.mockReset();
    mocks.requireEnv.mockReturnValue("test-cron-secret");
  });

  it("rejects requests without the cron bearer secret before doing work", async () => {
    const response = await GET(
      new Request("http://riftwatch.test/api/cron/scan"),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mocks.runMarketScanner).not.toHaveBeenCalled();
  });

  it("runs the scanner only for an exact bearer secret", async () => {
    mocks.runMarketScanner.mockResolvedValue({ claimed: 3, successes: 3 });

    const response = await GET(
      new Request("http://riftwatch.test/api/cron/scan", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      claimed: 3,
      successes: 3,
    });
    expect(mocks.runMarketScanner).toHaveBeenCalledOnce();
  });
});

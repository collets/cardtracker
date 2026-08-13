import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireEnv: vi.fn<(key: string) => string>(),
  synchronizeCatalog: vi.fn(),
  pruneOperationalData: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ requireEnv: mocks.requireEnv }));
vi.mock("@/lib/catalog/service", () => ({
  synchronizeCatalog: mocks.synchronizeCatalog,
}));
vi.mock("@/lib/scanner/service", () => ({
  pruneOperationalData: mocks.pruneOperationalData,
}));

import { GET } from "@/app/api/cron/catalog/route";

describe("GET /api/cron/catalog", () => {
  beforeEach(() => {
    mocks.requireEnv.mockReset();
    mocks.synchronizeCatalog.mockReset();
    mocks.pruneOperationalData.mockReset();
    mocks.requireEnv.mockReturnValue("test-cron-secret");
  });

  it("keeps catalog synchronization and cleanup behind cron authorization", async () => {
    const response = await GET(
      new Request("http://riftwatch.test/api/cron/catalog"),
    );

    expect(response.status).toBe(401);
    expect(mocks.synchronizeCatalog).not.toHaveBeenCalled();
    expect(mocks.pruneOperationalData).not.toHaveBeenCalled();
  });

  it("runs cleanup after a successful authenticated catalog synchronization", async () => {
    mocks.synchronizeCatalog.mockResolvedValue({
      expansions: 2,
      blueprints: 4,
    });
    mocks.pruneOperationalData.mockResolvedValue(undefined);

    const response = await GET(
      new Request("http://riftwatch.test/api/cron/catalog", {
        headers: { Authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      expansions: 2,
      blueprints: 4,
    });
    expect(mocks.synchronizeCatalog).toHaveBeenCalledOnce();
    expect(mocks.pruneOperationalData).toHaveBeenCalledOnce();
    expect(mocks.synchronizeCatalog.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.pruneOperationalData.mock.invocationCallOrder[0] ?? 0,
    );
  });
});

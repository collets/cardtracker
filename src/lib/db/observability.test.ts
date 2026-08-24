import { afterEach, describe, expect, it, vi } from "vitest";
import {
  observeCancellableDatabaseOperation,
  observeDatabaseOperation,
} from "@/lib/db/observability";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("database operation observability", () => {
  it("logs slow operations without query parameters", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(1_250);
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      observeDatabaseOperation("admin.statistics", async () => 42),
    ).resolves.toBe(42);

    expect(warning).toHaveBeenCalledWith("Slow database operation", {
      operation: "admin.statistics",
      durationMs: 1_150,
    });
  });

  it("logs only safe error metadata and rethrows the original error", async () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(350);
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("sensitive database details"), {
      code: "57014",
    });

    await expect(
      observeDatabaseOperation("admin.recent-runs", async () => {
        throw error;
      }),
    ).rejects.toBe(error);

    expect(failure).toHaveBeenCalledWith("Database operation failed", {
      operation: "admin.recent-runs",
      durationMs: 250,
      name: "Error",
      code: "57014",
    });
    expect(JSON.stringify(failure.mock.calls)).not.toContain(
      "sensitive database details",
    );
  });

  it("cancels operations that are still queued or running at the deadline", async () => {
    vi.useFakeTimers();
    const failure = vi.spyOn(console, "error").mockImplementation(() => {});
    const timeoutError = Object.assign(new Error("cancelled"), {
      code: "57014",
    });
    let rejectQuery: (error: Error) => void = () => {};
    const query = Object.assign(
      new Promise<number>((_resolve, reject) => {
        rejectQuery = reject;
      }),
      {
        cancel: vi.fn(() => rejectQuery(timeoutError)),
      },
    );

    const result = observeCancellableDatabaseOperation(
      "auth.require-user",
      query,
      250,
    );
    const handledResult = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(250);

    await expect(handledResult).resolves.toBe(timeoutError);
    expect(query.cancel).toHaveBeenCalledOnce();
    expect(failure).toHaveBeenCalledWith(
      "Database operation failed",
      expect.objectContaining({
        operation: "auth.require-user",
        code: "57014",
      }),
    );
  });
});

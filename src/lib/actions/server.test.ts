import { describe, expect, it } from "vitest";
import { z } from "zod";
import { actionResult } from "@/lib/actions/server";
import { UserFacingError } from "@/lib/errors";

describe("actionResult", () => {
  it("returns the operation value and a derived success message", async () => {
    await expect(
      actionResult(
        async () => ({ count: 2 }),
        ({ count }) => `Saved ${count} watches`,
      ),
    ).resolves.toEqual({
      ok: true,
      message: "Saved 2 watches",
      data: { count: 2 },
    });
  });

  it("keeps expected validation messages safe and actionable", async () => {
    await expect(
      actionResult(async () => {
        throw new UserFacingError("Watch not found");
      }, "Saved"),
    ).resolves.toEqual({ ok: false, message: "Watch not found" });

    await expect(
      actionResult(async () => {
        z.object({ quantity: z.number().min(1) }).parse({ quantity: 0 });
      }, "Saved"),
    ).resolves.toEqual({
      ok: false,
      message: "Too small: expected number to be >=1",
    });
  });

  it("does not expose unexpected server errors", async () => {
    await expect(
      actionResult(
        async () => {
          throw new Error("database credentials must stay private");
        },
        "Saved",
        "Please retry later.",
      ),
    ).resolves.toEqual({ ok: false, message: "Please retry later." });
  });
});

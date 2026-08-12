import { describe, expect, it } from "vitest";
import { boundedErrorMessage } from "@/lib/errors";

describe("boundedErrorMessage", () => {
  it("preserves an error message within the configured limit", () => {
    expect(boundedErrorMessage(new Error("safe failure"), "fallback")).toBe(
      "safe failure",
    );
  });

  it("uses the fallback for unknown values and bounds persisted text", () => {
    expect(boundedErrorMessage({ reason: "unknown" }, "fallback")).toBe(
      "fallback",
    );
    expect(boundedErrorMessage(new Error("123456"), "fallback", 4)).toBe(
      "1234",
    );
  });
});

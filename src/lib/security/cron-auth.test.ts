import { describe, expect, it } from "vitest";
import { hasValidBearerAuthorization } from "@/lib/security/cron-auth";

describe("cron bearer authentication", () => {
  const secret = "a-secure-cron-secret";

  it("accepts an exact bearer credential", () => {
    expect(hasValidBearerAuthorization(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([
    null,
    "",
    secret,
    `bearer ${secret}`,
    `Bearer  ${secret}`,
    `Bearer ${secret} trailing`,
    "Bearer wrong-secret",
  ])("rejects malformed or incorrect authorization: %s", (authorization) => {
    expect(hasValidBearerAuthorization(authorization, secret)).toBe(false);
  });
});

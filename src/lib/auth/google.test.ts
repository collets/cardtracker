import { describe, expect, it } from "vitest";
import {
  isVerifiedGoogleProfile,
  omitStoredOAuthTokens,
} from "@/lib/auth/google";

describe("Google authentication hardening", () => {
  it("accepts only an explicitly verified Google profile", () => {
    expect(isVerifiedGoogleProfile({ email_verified: true })).toBe(true);
    expect(isVerifiedGoogleProfile({ email_verified: false })).toBe(false);
    expect(isVerifiedGoogleProfile({})).toBe(false);
    expect(isVerifiedGoogleProfile(undefined)).toBe(false);
  });

  it("does not persist unused OAuth token material", () => {
    expect(
      omitStoredOAuthTokens({
        access_token: "secret",
        refresh_token: "secret",
        id_token: "secret",
      }),
    ).toEqual({});
  });
});

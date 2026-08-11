import { describe, expect, it } from "vitest";
import { resolveKnownUserRole } from "@/lib/auth/authorization";

describe("resolveKnownUserRole", () => {
  it("promotes an existing default user when the email is the bootstrap admin", () => {
    expect(resolveKnownUserRole(true, { role: "user", disabled: false })).toBe(
      "admin",
    );
  });

  it("does not let the bootstrap email bypass a disabled account", () => {
    expect(
      resolveKnownUserRole(true, { role: "user", disabled: true }),
    ).toBeNull();
  });

  it("preserves the role of another existing user", () => {
    expect(
      resolveKnownUserRole(false, { role: "admin", disabled: false }),
    ).toBe("admin");
    expect(resolveKnownUserRole(false, { role: "user", disabled: false })).toBe(
      "user",
    );
  });

  it("leaves an unknown non-bootstrap email unresolved for invitation lookup", () => {
    expect(resolveKnownUserRole(false)).toBeUndefined();
  });
});

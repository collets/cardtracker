import { describe, expect, it } from "vitest";
import { guestSessionMaxAge, isGuestSessionActive } from "@/lib/guests/session";

describe("guest session validity", () => {
  const now = new Date("2026-08-13T12:00:00.000Z");

  it("does not place an expiry on member accounts", () => {
    expect(isGuestSessionActive("member", null, now)).toBe(true);
  });

  it("requires a future absolute expiry for guest access", () => {
    expect(
      isGuestSessionActive("guest", new Date("2026-08-13T13:00:00.000Z"), now),
    ).toBe(true);
    expect(
      isGuestSessionActive("guest", new Date("2026-08-13T12:00:00.000Z"), now),
    ).toBe(false);
    expect(isGuestSessionActive("guest", null, now)).toBe(false);
  });

  it("caps the guest JWT to the database access deadline", () => {
    const now = Date.parse("2026-08-13T12:00:00.000Z");
    expect(guestSessionMaxAge(1_786_626_000, now)).toBe(3_600);
    expect(guestSessionMaxAge(1_786_622_400, now)).toBe(0);
    expect(guestSessionMaxAge(undefined, now)).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  ALERT_RENOTIFICATION_INTERVAL_MS,
  isMateriallyBetter,
  shouldCreateAlertEvent,
} from "@/lib/alerts/lifecycle";

const now = new Date("2026-08-12T12:00:00.000Z");
const activeAlert = {
  productId: 101,
  candidatePriceCents: 2_000,
  lastSeenAt: now,
  state: "active" as const,
};

describe("alert lifecycle decisions", () => {
  it("recognizes either a €2 or 10% material price improvement", () => {
    expect(isMateriallyBetter(2_000, 1_800)).toBe(true);
    expect(isMateriallyBetter(1_000, 900)).toBe(true);
    expect(isMateriallyBetter(2_000, 1_950)).toBe(false);
  });

  it("suppresses an unchanged listing while it remains active", () => {
    expect(
      shouldCreateAlertEvent({
        productId: 101,
        candidatePriceCents: 2_000,
        activeAlerts: [activeAlert],
        latestAlertForListing: activeAlert,
        now,
      }),
    ).toBe(false);
  });

  it("creates a new event for a materially cheaper version of the same listing", () => {
    expect(
      shouldCreateAlertEvent({
        productId: 101,
        candidatePriceCents: 1_800,
        activeAlerts: [activeAlert],
        latestAlertForListing: activeAlert,
        now,
      }),
    ).toBe(true);
  });

  it("allows an archived or expired listing to alert again only after a material change or cooldown", () => {
    const dismissed = {
      ...activeAlert,
      state: "dismissed" as const,
      lastSeenAt: new Date(now.getTime() - 60 * 60 * 1_000),
    };
    expect(
      shouldCreateAlertEvent({
        productId: dismissed.productId,
        candidatePriceCents: dismissed.candidatePriceCents,
        activeAlerts: [],
        latestAlertForListing: dismissed,
        now,
      }),
    ).toBe(false);
    expect(
      shouldCreateAlertEvent({
        productId: dismissed.productId,
        candidatePriceCents: 1_800,
        activeAlerts: [],
        latestAlertForListing: dismissed,
        now,
      }),
    ).toBe(true);
    expect(
      shouldCreateAlertEvent({
        productId: dismissed.productId,
        candidatePriceCents: dismissed.candidatePriceCents,
        activeAlerts: [],
        latestAlertForListing: {
          ...dismissed,
          lastSeenAt: new Date(
            now.getTime() - ALERT_RENOTIFICATION_INTERVAL_MS,
          ),
        },
        now,
      }),
    ).toBe(true);
  });

  it("allows a new vendor only when it materially beats the active deal", () => {
    expect(
      shouldCreateAlertEvent({
        productId: 202,
        candidatePriceCents: 1_950,
        activeAlerts: [activeAlert],
        latestAlertForListing: undefined,
        now,
      }),
    ).toBe(false);
    expect(
      shouldCreateAlertEvent({
        productId: 202,
        candidatePriceCents: 1_800,
        activeAlerts: [activeAlert],
        latestAlertForListing: undefined,
        now,
      }),
    ).toBe(true);
  });
});

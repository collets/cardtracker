export const ALERT_RENOTIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const ALERT_MIN_IMPROVEMENT_CENTS = 200;
export const ALERT_MIN_IMPROVEMENT_BPS = 1_000;

type AlertSnapshot = {
  productId: number;
  candidatePriceCents: number;
  lastSeenAt: Date;
  state: "active" | "expired" | "dismissed";
};

export function isMateriallyBetter(
  previousPriceCents: number,
  candidatePriceCents: number,
) {
  const savedCents = previousPriceCents - candidatePriceCents;
  return (
    savedCents >= ALERT_MIN_IMPROVEMENT_CENTS ||
    candidatePriceCents * 10_000 <=
      previousPriceCents * (10_000 - ALERT_MIN_IMPROVEMENT_BPS)
  );
}

export function shouldCreateAlertEvent({
  productId,
  candidatePriceCents,
  activeAlerts,
  latestAlertForListing,
  now,
}: {
  productId: number;
  candidatePriceCents: number;
  activeAlerts: AlertSnapshot[];
  latestAlertForListing: AlertSnapshot | undefined;
  now: Date;
}) {
  const activeForListing = activeAlerts.find(
    (alert) => alert.productId === productId,
  );
  if (activeForListing) {
    return isMateriallyBetter(
      activeForListing.candidatePriceCents,
      candidatePriceCents,
    );
  }

  if (latestAlertForListing) {
    const reappearedAfterCooldown =
      now.getTime() - latestAlertForListing.lastSeenAt.getTime() >=
      ALERT_RENOTIFICATION_INTERVAL_MS;
    return (
      isMateriallyBetter(
        latestAlertForListing.candidatePriceCents,
        candidatePriceCents,
      ) || reappearedAfterCooldown
    );
  }

  if (activeAlerts.length === 0) return true;
  const bestActivePriceCents = Math.min(
    ...activeAlerts.map((alert) => alert.candidatePriceCents),
  );
  return isMateriallyBetter(bestActivePriceCents, candidatePriceCents);
}

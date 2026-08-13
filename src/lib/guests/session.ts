export function isGuestSessionActive(
  kind: "member" | "guest",
  expiresAt: Date | null,
  now = new Date(),
) {
  return kind !== "guest" || (expiresAt !== null && expiresAt > now);
}

export function guestSessionMaxAge(expiresAt: unknown, now = Date.now()) {
  if (typeof expiresAt !== "number" || !Number.isFinite(expiresAt)) {
    return undefined;
  }
  return Math.max(0, Math.floor(expiresAt - now / 1_000));
}

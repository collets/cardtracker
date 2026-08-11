import { createHash, timingSafeEqual } from "node:crypto";

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function hasValidBearerAuthorization(
  authorization: string | null,
  expectedSecret: string,
) {
  const match = authorization?.match(/^Bearer ([^\s]+)$/);
  const token = match?.[1];
  if (!token) return false;
  return timingSafeEqual(digest(token), digest(expectedSecret));
}

export function isVerifiedGoogleProfile(profile: unknown) {
  if (!profile || typeof profile !== "object") return false;
  return Reflect.get(profile, "email_verified") === true;
}

export function omitStoredOAuthTokens(tokens?: unknown) {
  void tokens;
  return {};
}

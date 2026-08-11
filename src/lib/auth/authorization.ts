export type AuthorizedRole = "admin" | "user";

type ExistingAuthorization = {
  role: AuthorizedRole;
  disabled: boolean;
};

export function resolveKnownUserRole(
  isBootstrapAdmin: boolean,
  existing?: ExistingAuthorization,
): AuthorizedRole | null | undefined {
  if (existing?.disabled) return null;
  if (isBootstrapAdmin) return "admin";
  return existing?.role;
}

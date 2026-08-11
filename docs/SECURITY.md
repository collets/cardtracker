# Riftwatch security

This document describes the security controls implemented by Riftwatch and the
operator work required to preserve them. It is a practical control inventory,
not a formal compliance certification or a replacement for an independent
penetration test.

## Security goals and assets

Riftwatch protects:

- Auth.js sessions, Google identities, invitation state, and administrator roles.
- User watch filters, preferences, alerts, and notification configuration.
- The CardTrader token, cron secret, database credentials, OAuth secret, and
  optional Telegram credentials.
- Marketplace evidence, operational leases, scan capacity, and external API
  quotas.
- The integrity and append-only history of privileged administrator changes.

The primary threats are unauthorized sign-in, cross-user object access,
privilege escalation, stolen credentials or cookies, forged scheduled jobs,
database exposure, XSS/CSRF, resource abuse, supply-chain compromise, and unsafe
operational mistakes.

## Trust boundaries

The browser is untrusted. It receives rendered data and invokes Server Actions,
but it never receives a database credential, CardTrader token, cron secret,
Google client secret, or privileged Supabase key.

Next.js is the trusted backend-for-frontend. It authenticates and authorizes
requests, validates external input, scopes database access, and calls CardTrader.
Server Actions are treated as public POST endpoints even when their controls are
rendered only on protected pages.

PostgreSQL is reached through two distinct identities:

- `riftwatch_app` is the production login used by Vercel through the Supavisor
  transaction pooler. It inherits only the non-login `riftwatch_runtime` role.
- `postgres` is the migration owner. Its direct or session-pooler credential is
  used only in a trusted migration shell and is never configured in Vercel.

Supabase's Data API is disabled. Riftwatch does not use `supabase-js`, an anon
key, authenticated database JWTs, Storage, or Realtime.

CardTrader and Google are external trust boundaries. CardTrader payloads are
validated before use. Google is accepted only when it explicitly reports a
verified email belonging to the configured administrator, an existing enabled
user, or a pending invitation.

## HTTP and action authentication

| Boundary             | Authentication                         | Authorization                                |
| -------------------- | -------------------------------------- | -------------------------------------------- |
| `/api/health`        | Public                                 | Minimal readiness query only                 |
| `/api/auth/*`        | Auth.js OAuth protocol                 | Invite/existing-user allowlist               |
| `/api/cron/catalog`  | Timing-safe `CRON_SECRET` Bearer check | Catalog job lease                            |
| `/api/cron/scan`     | Timing-safe `CRON_SECRET` Bearer check | Blueprint leases                             |
| User Server Actions  | Auth.js session cookie                 | Current enabled DB user and record ownership |
| Admin Server Actions | Auth.js session cookie                 | Current enabled DB administrator             |
| Telegram webhook     | Deferred until Telegram is enabled     | Deferred dedicated review                    |

Frontend and Server Actions do not exchange a custom bearer token. Auth.js uses
an encrypted/signed session in an `HttpOnly`, `Secure` production cookie with
`SameSite=Lax`. Lax is required for the OAuth redirect flow. Sessions expire
after 24 hours.

Every protected layout, action, and private page calls `requireUser()` or
`requireAdmin()`. These guards decode the Auth.js session and reload the user by
ID from PostgreSQL. Disabling a user or changing a role therefore takes effect
at the next protected request even if an older JWT cookie still exists.

Google sign-in fails closed when `email_verified` is false or absent. OAuth
access, refresh, and ID tokens are not persisted because Riftwatch does not call
Google APIs after identity verification. Existing stored token material was
cleared by the security migration.

The development credentials provider is available only when explicitly enabled
outside production. Both configuration validation and application startup reject
it in production.

## Authorization and object ownership

User-provided identifiers are parsed as UUIDs or bounded numeric identifiers at
the Server Action boundary. Watch updates/deletes include both the watch ID and
current user ID. Alert changes require an alert whose watch belongs to the
current user. Missing and foreign records produce the same not-found behavior.

Administrator updates are serialized in a transaction. An administrator cannot
disable or demote their own account, and no concurrent updates can remove the
last active administrator. The configured `ADMIN_EMAIL` remains the bootstrap
identity but a disabled database user is denied before bootstrap promotion.

Watch creation takes a transaction-scoped advisory lock before checking and
consuming per-user quota and global unique-blueprint capacity. Parallel requests
therefore cannot exceed either limit through a check-then-insert race.

## Database security

Every application table has RLS enabled and forced. Only policies for
`riftwatch_runtime` exist because authorization is performed in the trusted
Next.js layer and browsers cannot assume that database role. The policy allows
the backend to operate across rows; user ownership must still be enforced by the
application data-access query.

The migration:

- Creates `riftwatch_runtime` with no login, superuser, database creation, role
  creation, replication, or RLS-bypass capability.
- Revokes schema, table, sequence, and function access from `PUBLIC` and the
  Supabase `anon`, `authenticated`, and `service_role` roles when present.
- Revokes corresponding default privileges so later migrations do not silently
  expose new objects.
- Grants explicit schema, table, and sequence privileges to the runtime role.
- Restricts `admin_audit_events` to runtime `SELECT` and `INSERT`; runtime cannot
  update, delete, or truncate its history.

The production login must be created interactively after the migration:

```sql
create role riftwatch_app
  with login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant riftwatch_runtime to riftwatch_app;
\password riftwatch_app
```

Run this through `psql` so `\password` prompts without placing the password in
shell history or a committed SQL file. For Supavisor use the username
`riftwatch_app.<project-ref>`, port `6543`, and `sslmode=require`. Percent-encode
only the password when constructing a URL.

`pnpm prod:check-env` rejects a privileged runtime username, missing TLS, and a
runtime environment containing `DATABASE_URL_DIRECT`. The migration check mode
requires the direct URL explicitly. `pnpm db:security-audit -- --allow-hosted`
performs a read-only check of role flags, TLS, grants, and RLS without displaying
credential values.

The Data API must remain disabled. Grants and RLS are defense-in-depth and do not
replace that operator setting. Relevant platform guidance is in the Supabase
[Data API security](https://supabase.com/docs/guides/api/securing-your-api),
[database roles](https://supabase.com/docs/guides/database/postgres/roles), and
[connection](https://supabase.com/docs/guides/database/connecting-to-postgres)
documentation.

## Browser and CSRF defenses

Next.js Server Actions accept POST and compare `Origin` with `Host` or
`X-Forwarded-Host`. Riftwatch does not configure alternate allowed origins.
Auth.js applies its OAuth state, PKCE, and CSRF protections. Authentication and
authorization inside each action remain mandatory because UI visibility and
encrypted action IDs are not access controls.

Server Action bodies are capped at 64 KB. Riftwatch has no upload endpoint.

A fresh CSP nonce is generated for each HTML request. The production policy:

- Uses nonce-based `script-src` with `strict-dynamic` and no script
  `unsafe-inline`.
- Allows stylesheets only from self with a nonce. `style-src-attr
'unsafe-inline'` is retained for Radix positioning styles and does not permit
  script execution.
- Limits browser connections, fonts, workers, and manifests to self.
- Allows images from self, data/blob URLs, and the two CardTrader artwork hosts.
- Denies objects, frames, media, foreign form targets, and embedding.
- Upgrades insecure production requests.

Nonce CSP requires dynamic HTML rendering. This intentionally trades static CDN
rendering for stronger XSS resistance. See the installed/current Next.js
[CSP guide](https://nextjs.org/docs/app/guides/content-security-policy).

Responses also set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a
strict-origin referrer policy, restrictive Permissions Policy, COOP, and CORP.
Vercel supplies HTTPS and HSTS for the hosted deployment.

## Abuse and availability controls

Cron credentials are parsed using the exact Bearer scheme and compared as
SHA-256 digests with a constant-time primitive. Unauthorized and authorized cron
responses are not cached.

Blueprint scanners use atomic PostgreSQL row leases. Manual watch scans use the
same due-time and lease claim as scheduled scans, so repeated clicks or parallel
requests do not create extra CardTrader calls. Successful scans schedule the
next scan five minutes later; abandoned leases recover automatically.

Catalog synchronization uses a separate ten-minute recoverable lease and a
five-minute completion cooldown. Concurrent or repeated requests return a safe
skipped result.

CardTrader calls stay server-side, validate response shapes, use timeouts and
bounded retries, and begin at no more than five requests per second. Raw
authorization headers and unsafe external response bodies are never logged.

The recommended Vercel WAF rule applies a fixed window of 120 non-static
requests per minute per source IP and returns 429. Publish it in log mode first.
Do not accept a plan upgrade or paid overage to enable it without explicit owner
approval.

## Audit, logging, and privacy

`admin_audit_events` records successful and failed invitation changes, user
administration, catalog requests, and manual scanner requests. Each event has an
actor ID, action, target type/ID, outcome, minimal safe metadata, and UTC time.
It never stores email addresses, credentials, authorization headers, raw errors,
or external payloads. Actor email is joined only when an administrator views the
recent activity table.

Database-backed mutations and their success audit event share a transaction.
Failed operations record only the error class. Vercel and Supabase platform logs
remain operational evidence but are not a substitute for the application audit
trail.

Marketplace payloads are normalized in memory. Riftwatch persists only the
fields required to evaluate and explain a deal. Prices are integer cents; no
payment information or purchasing credential is stored.

## Secret management

Production and Preview require distinct Auth.js, cron, database, OAuth, and
integration credentials. Preview must never use production data. Secrets have no
`NEXT_PUBLIC_` prefix and must be stored in Vercel environment variables or the
operator password manager.

Do not keep production database URLs in `.zshrc` or another globally inherited
shell file. Load them only into the trusted command's environment and unset them
afterward. `DATABASE_URL_DIRECT` must never be configured in Vercel.

Rotate a credential immediately when it appears in a commit, log, issue, chat,
terminal recording, or unauthorized environment. Deleting the visible value is
not revocation. Redeploy after rotating Vercel variables because existing
deployments do not receive changed values retroactively.

## Secure development lifecycle

- Direct dependencies are exactly pinned and `pnpm-lock.yaml` is committed.
- Dependabot checks npm and GitHub Actions weekly.
- CI installs with `--frozen-lockfile`, audits production dependencies, runs the
  full test/build suite, and scans complete Git history with Gitleaks.
- GitHub Actions use immutable commit SHAs and least-privilege workflow tokens.
- Database changes require a generated, reviewed, forward-only migration.
- Integration and browser fixtures reject non-loopback databases.
- Production mutations, migrations, webhook changes, WAF publication, and paid
  plan changes require explicit operator authorization.

The minimum code check is `pnpm check`; authentication, routing, infrastructure,
or security changes require `pnpm check:all` and focused negative-path tests.

## Verification

Local verification:

```sh
pnpm local:setup
pnpm check
pnpm test:integration
pnpm build
pnpm test:e2e
pnpm audit --prod --audit-level high
```

Hosted read-only verification after an authorized migration and deployment:

```sh
pnpm prod:check-env
pnpm db:security-audit -- --allow-hosted
pnpm smoke:hosted -- --url https://your-deployment.example
```

The smoke test checks readiness, anonymous redirects, cron rejection, strict
CSP/security headers, and Auth.js production cookie attributes. Authorized cron
flags are separate mutations and are not part of a safe smoke run.

## Incident response

1. Stop or isolate the affected path. Disable cron or roll back the application
   without resetting hosted data.
2. Revoke and rotate exposed credentials before editing logs or code.
3. Preserve sanitized audit, deployment, and database evidence.
4. Determine affected identities, data, time window, and external calls.
5. Restore from the approved backup procedure if integrity is uncertain; never
   run `pnpm local:reset` against hosted data.
6. Validate the fix with negative-path tests and safe hosted checks.
7. Record cause, impact, recovery, and follow-up without credentials or personal
   identifiers.

## Residual and deferred risks

- Google account MFA and recovery policy are controlled by each Google account;
  Riftwatch does not currently impose step-up authentication.
- A compromised Next.js runtime can exercise the backend's broad row policies;
  least-privilege database roles limit infrastructure administration but cannot
  replace application authorization.
- WAF publication is an operator-controlled hosted setting.
- Telegram is disabled/deferred. Its webhook, linking race behavior, delivery,
  and credential lifecycle require a dedicated review before enablement.
- Backup retention and point-in-time recovery depend on the selected Supabase
  plan and must be reviewed before broader user onboarding.

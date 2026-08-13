# Application and integration endpoints

Riftwatch is a backend-for-frontend application. These routes support the web UI,
scheduled jobs, authentication, health checks, and Telegram; they are not a
general public API. Unless stated otherwise, responses are JSON and secrets must
remain server-side.

## Endpoint summary

| Method     | Path                      | Authentication                        | Purpose                                               |
| ---------- | ------------------------- | ------------------------------------- | ----------------------------------------------------- |
| `GET`      | `/api/health`             | None                                  | Report application/database readiness                 |
| `GET/POST` | `/api/auth/[...nextauth]` | Auth.js protocol                      | Sign-in, callbacks, session handling                  |
| `GET`      | `/api/cron/catalog`       | `Authorization: Bearer <CRON_SECRET>` | Sync Riftbound catalog and prune old operational data |
| `GET`      | `/api/cron/scan`          | `Authorization: Bearer <CRON_SECRET>` | Claim and scan due watched blueprints                 |
| `POST`     | `/api/telegram/webhook`   | `X-Telegram-Bot-Api-Secret-Token`     | Process verified Telegram updates                     |

All dynamic endpoints run in the Node.js server runtime. Cron routes allow up to
240 seconds and rely on database leases for retry/overlap safety.

## Health

`GET /api/health` performs a minimal database query.

Healthy response, HTTP 200:

```json
{
  "status": "ok",
  "database": "connected",
  "checkedAt": "2026-08-10T12:00:00.000Z"
}
```

Database failure, HTTP 503:

```json
{
  "status": "degraded",
  "database": "unavailable",
  "checkedAt": "2026-08-10T12:00:00.000Z"
}
```

The route intentionally omits connection strings, exception details, versions,
and credentials.

## Cron endpoints

Use the local helpers while `pnpm dev` is running:

```sh
pnpm cron:catalog
pnpm cron:scan
```

The helpers load `.env.local`, add the authorization header without printing it,
and call `NEXT_PUBLIC_APP_URL`. A 401 indicates that the helper and running app
do not share the same `CRON_SECRET`.

For an explicitly selected HTTPS deployment, the safe boundary check is:

```sh
pnpm smoke:hosted -- --url https://your-deployment.example
```

It intentionally calls both cron routes without authorization and expects 401.
Authorized catalog or scanner execution requires the separate `--run-catalog`
or `--run-scan` flag plus a matching `CRON_SECRET`; those flags mutate database
state and may call CardTrader.

Catalog success resembles:

```json
{ "expansions": 17, "blueprints": 1521 }
```

Counts vary as CardTrader changes. Market scan responses report claimed,
successful, and failed blueprint work plus logical CardTrader fetch counts:

```json
{
  "claimed": 12,
  "successes": 12,
  "failures": 0,
  "watches": 18,
  "alerts": 1,
  "marketplaceFetches": { "expansions": 2, "blueprints": 2 }
}
```

The fetch counts represent client operations, not internal HTTP retries.
Operational details, including the same fetch breakdown, are stored in
`scan_runs.details`.

Vercel calls these same GET routes according to `vercel.json`. The market route
is daily on Hobby. The optional Cloudflare scheduler calls this same protected
route every five minutes; the database only claims each blueprint every five
minutes, so a no-work invocation makes no CardTrader request. See [Cloudflare
five-minute scheduler](CLOUDFLARE_SCHEDULER.md). Do not expose an unprotected
alternate path for local convenience.

## Telegram webhook

Telegram sends update JSON to `/api/telegram/webhook`. The handler rejects a
request unless `X-Telegram-Bot-Api-Secret-Token` exactly matches
`TELEGRAM_WEBHOOK_SECRET`. Register the webhook using HTTPS; localhost requires a
tunnel.

The handler supports the one-time account-link flow. Link tokens are stored only
as hashes, expire after ten minutes, and are consumed once. Notification delivery
is idempotently tracked in PostgreSQL.

Administrator-managed guest links use the same hashed-capability principle but
redeem through the Auth.js guest Credentials callback. The `/guest` page accepts
the raw token only from the URL fragment and shows a safe unavailable page when
the token is missing, expired, revoked, malformed, or exhausted.

## Server actions

Authenticated UI mutations use server actions rather than public REST routes.
Actions recheck the database user and role, validate form data, and scope
user-owned objects by `userId`. Important actions include watch creation/update,
manual watch scans, preference changes, Telegram linking, invitations, user
administration, alert feedback, catalog synchronization, and scanner execution.
Guest users can use the normal watch and alert actions within their quota, but
manual-scan and Telegram actions enforce a member-only check at the server
boundary as well as hiding their controls in the UI.

Riftwatch does not treat a browser request as a distinct security principal:
any request a browser can make can be reproduced by another HTTP client that has
the same authenticated session. Server actions receive Next.js same-origin/CSRF
protections, but authorization is always enforced again in the action itself.
Guest sessions have no guest-capable REST mutation endpoints; replaying a guest
session through curl or Postman therefore cannot bypass the same quota,
ownership, expiry, or member-only checks used by the web UI. Cron and Telegram
routes use their separate secrets and never accept a guest session.

Alert feedback accepts one fixed outcome for an alert owned by the authenticated
user. Saving feedback also marks that alert as read. A later answer replaces the
earlier answer so each alert contributes only its latest outcome to aggregate
validation.

The Alerts page has an Inbox (active unread events) and History (read, archived,
or expired events). Archiving dismisses only that alert event and leaves the
underlying watch active; restoring an archived event returns it to Inbox. The
scanner does not re-alert an unchanged listing. It creates a new event when the
same listing improves by at least €2 or 10%, reappears after 24 hours, or a
different listing materially beats the best active alert. This keeps alert
feedback attached to the original event rather than overwriting it.

An invitation is an administrator-managed allowlist record for Google sign-in;
Riftwatch does not send invitation email. Administrators can revoke a pending
invitation, while accepted invitation history remains retained.

When adding an action, treat it as an externally callable mutation: authenticate,
authorize, validate, perform the smallest mutation, and revalidate or redirect
only the affected UI paths.

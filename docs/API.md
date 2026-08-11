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
240 seconds, use timing-safe bearer verification, disable response caching, and
rely on database leases for retry/overlap safety.

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
{ "status": "succeeded", "expansions": 17, "blueprints": 1521 }
```

A concurrent or recently completed catalog request returns `status: "skipped"`
without calling CardTrader again.

Counts vary as CardTrader changes. Market scan responses report claimed,
successful, and failed work. Operational details are also stored in `scan_runs`.

Vercel calls these same GET routes according to `vercel.json`. Do not expose an
unprotected alternate path for local convenience.

## Telegram webhook

Telegram sends update JSON to `/api/telegram/webhook`. The handler rejects a
request unless `X-Telegram-Bot-Api-Secret-Token` exactly matches
`TELEGRAM_WEBHOOK_SECRET`. Register the webhook using HTTPS; localhost requires a
tunnel.

The handler supports the one-time account-link flow. Link tokens are stored only
as hashes, expire after ten minutes, and are consumed once. Notification delivery
is idempotently tracked in PostgreSQL.

## Server actions

Authenticated UI mutations use server actions rather than public REST routes.
The frontend does not attach a custom bearer token. Auth.js sends its signed,
encrypted, `HttpOnly` session cookie; actions then recheck the database user and
role, validate form data, and scope user-owned objects by `userId`. Important
actions include watch creation/update,
manual watch scans, preference changes, Telegram linking, invitations, user
administration, catalog synchronization, and scanner execution.

An invitation is an administrator-managed allowlist record for Google sign-in;
Riftwatch does not currently send invitation email. Administrators can revoke a
pending invitation, while accepted invitation history remains retained.
Privileged administrator outcomes are appended to the database audit trail.

When adding an action, treat it as an externally callable mutation: authenticate,
authorize, validate, perform the smallest mutation, and revalidate or redirect
only the affected UI paths.

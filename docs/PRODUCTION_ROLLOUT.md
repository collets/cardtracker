# Production rollout checklist

This is the operator handoff for the first hosted Riftwatch deployment. Repository
automation is safe to prepare locally, but every checkbox below changes an
external account, hosted database, credential, deployment, webhook, billing
plan, or production schedule and therefore requires the project owner.

The initial rollout uses Vercel's daily Hobby-compatible smoke schedule. Do not
enable minute-level scanning until the daily deployment is healthy and the
Vercel plan change has been approved.

Status updated **2026-08-11**: repository controls, the initial Supabase
database migration, and the production Vercel database connection are complete.
Production Google authentication and the isolated Preview environment remain to
be configured before the hosted smoke rollout.

## 1. Review and repository controls

- [x] Review and merge `agent/production-readiness` into `main` after CI passes.
- [x] Confirm GitHub secret scanning reports no exposed credential.
- [x] Protect `main` and require the CI `verify` and `secrets` jobs.
- [x] Record who can administer GitHub, Vercel, Supabase, Google OAuth, and the
      Telegram bot.

## 2. Provision PostgreSQL

- [x] Create one Supabase project in **Central EU (Frankfurt)** or another
      explicitly selected EU region.
- [x] Generate a unique database password.
- [x] Confirm the database password is stored in the team's password manager.
- [x] Copy the transaction-mode pooler URL on port `6543` for `DATABASE_URL`.
- [x] Copy the direct URL on port `5432` for `DATABASE_URL_DIRECT`. If the
      migration workstation cannot reach the IPv6 direct endpoint, use the
      session-mode pooler on port `5432` for this one-session operation.
- [x] Confirm Supabase enforces SSL for incoming database connections.
- [x] Apply committed migrations with `pnpm db:migrate` from a trusted machine
      where `DATABASE_URL_DIRECT` is present in the process environment. Do not
      paste either URL into shell history, logs, issues, or chat.
- [x] Confirm the migration command reports success, the Riftwatch tables exist
      in `public`, and `drizzle.__drizzle_migrations` contains both committed
      migrations.
- [x] After the first Vercel deployment, confirm `/api/health` reports
      `database: "connected"` through the pooled production `DATABASE_URL`.
- [ ] Review Supabase backup and restore coverage before inviting users. Point-in-
      time recovery is a separate paid capability and must not be enabled without
      approval.

Supabase recommends transaction pooling for temporary/serverless application
traffic and direct connections for migrations and native PostgreSQL tools:
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
Region availability is documented in the
[Supabase region guide](https://supabase.com/docs/guides/platform/regions).

### Secure migration-shell procedure

The trusted migration shell is a terminal on an operator-controlled workstation
with the Riftwatch repository checked out. Keep the canonical password and
connection strings in the team's password manager. Do not save hosted database
URLs in `.env.local`, because local lifecycle commands must remain connected to
Docker PostgreSQL.

Percent-encode a database password without placing the raw value in shell
history:

```sh
read -rs 'DB_PASSWORD?Supabase database password: '
echo
DB_PASSWORD="$DB_PASSWORD" node -e 'console.log(encodeURIComponent(process.env.DB_PASSWORD))'
unset DB_PASSWORD
```

Encode only the password component—never pass the complete connection URL to
`encodeURIComponent`. The `postgresql://` scheme, username, `@`, hostname, port,
and database path must remain literal. The encoded output remains a credential.
Insert it into the direct connection string in the password manager, ensure the
URL enables SSL, and do not paste the completed URL into chat, logs, or
repository files.

Load the completed direct URL invisibly for one migration session:

```sh
read -rs 'DATABASE_URL_DIRECT?Supabase direct connection URL: '
echo
export DATABASE_URL_DIRECT
node -e 'const u = new URL(process.env.DATABASE_URL_DIRECT); console.log({ hostname: u.hostname, port: u.port, database: u.pathname })'
pnpm db:migrate
unset DATABASE_URL_DIRECT
```

The verification command deliberately prints only the non-secret destination.
It must show either the expected `db.<project-ref>` direct hostname or the
expected `aws-<region>.pooler.supabase.com` session-pooler hostname, together
with port `5432` and database `/postgres`. Stop if it instead shows a local host,
an unexpected project reference or region, port `6543`, or an empty value.

If the direct endpoint fails with `connect ENETUNREACH` and an IPv6 address, the
workstation has no route to Supabase's IPv6-only direct endpoint. Do not keep
retrying it and do not purchase an IPv4 add-on merely for migrations. Copy the
project's **session-mode pooler** URL from Supabase Connect, ensure it uses port
`5432`, and load that complete URL as `DATABASE_URL_DIRECT` with the same
procedure. The session pooler is suitable for this one-session migration; the
transaction pooler on port `6543` remains the application runtime URL.

Drizzle may report that the `drizzle` schema and `__drizzle_migrations` relation
already exist. Those idempotent PostgreSQL notices are expected and do not prove
that the application tables were created. Supabase's migration UI and CLI track
only Supabase CLI migrations in `supabase_migrations.schema_migrations`; they do
not display the repository's Drizzle migration history. For Riftwatch,
`drizzle.__drizzle_migrations` is the authoritative remote ledger. In the
Supabase SQL Editor, verify the remote catalog without modifying it:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema in ('public', 'drizzle')
order by table_schema, table_name;

select count(*) as applied_migrations
from drizzle.__drizzle_migrations;
```

The current repository contains two migrations. A successful initial migration
therefore produces the Riftwatch tables in `public` and reports two applied
migrations. If the `drizzle` objects are absent, the command likely connected to
a different database. If two migrations are recorded but the public tables are
absent, stop and investigate the inconsistent migration metadata; do not delete
or rewrite it.

## 3. Configure the Vercel project

- [x] Import `collets/cardtracker` into Vercel and select `main` as the production
      branch.
- [x] Confirm the function region is `fra1`, as committed in `vercel.json`.
- [ ] Keep the committed daily catalog and market cron schedules for the first
      deployment.
- [ ] Configure the variables below separately for Production and Preview.
      Preview must use isolated data and credentials; never point a preview at
      the production database.
- [ ] Deploy once after changing environment variables; Vercel does not apply
      new values retroactively to existing deployments.

| Variable                                                                   | Production value                                                 | Preview rule                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------------- |
| `NEXT_PUBLIC_APP_URL`                                                      | Final HTTPS production origin                                    | Preview/branch HTTPS origin   |
| `DATABASE_URL`                                                             | Supabase transaction pooler                                      | Isolated preview database     |
| `DATABASE_URL_DIRECT`                                                      | Do not grant to runtime; use only in the trusted migration shell | Same rule                     |
| `AUTH_SECRET`                                                              | Random 32+ character secret                                      | Different random secret       |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`                                    | Production web client                                            | Separate test client or unset |
| `AUTH_ENABLE_DEV_PROVIDER`                                                 | `false`                                                          | `false`                       |
| `ADMIN_EMAIL`                                                              | Owner's verified Google email                                    | Preview administrator         |
| `CARD_TRADER_AUTH_TOKEN`                                                   | Server-only token                                                | Separate token if available   |
| `CRON_SECRET`                                                              | Random 32+ character secret                                      | Different random secret       |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_BOT_USERNAME` / `TELEGRAM_WEBHOOK_SECRET` | One complete bot configuration                                   | Separate bot or all unset     |
| `SCAN_BATCH_SIZE`                                                          | `50` initially                                                   | `10`                          |
| `MAX_ACTIVE_BLUEPRINTS`                                                    | `250` initially                                                  | Small test capacity           |
| `DEFAULT_WATCH_QUOTA`                                                      | `50`                                                             | Small test quota              |

Before deployment, run `pnpm prod:check-env` in a secure shell containing the
intended production values. Before migration, also run
`pnpm prod:check-env -- --require-direct`. The command reports names and
validation errors only; it never prints values. See
[Vercel environment variables](https://vercel.com/docs/environment-variables)
for environment scoping.

## 4. Configure Google sign-in

- [ ] Create a Google OAuth **Web application** client for the owned production
      domain.
- [ ] Configure the authorized JavaScript origin as the exact HTTPS origin.
- [ ] Configure the exact redirect URI as
      `https://<production-host>/api/auth/callback/google`.
- [ ] Configure the OAuth consent screen, homepage, privacy policy, support
      contact, and test/published audience required by Google.
- [ ] Store the client ID and secret only in Vercel Production variables.
- [ ] Sign in with `ADMIN_EMAIL` and confirm the user is provisioned as an
      administrator.
- [ ] Invite a second test address and confirm an uninvited address is rejected.

Google requires exact, HTTPS production redirect URI matching; see the
[Google web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)
and [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## 5. Daily hosted smoke rollout

- [ ] Deploy `main` with the daily schedules in `vercel.json`.
- [ ] Run `pnpm smoke:hosted -- --url https://<production-host>` without an
      authorization flag. Confirm health, public pages, sign-in redirects, and
      cron rejection all pass.
- [ ] Run `pnpm smoke:hosted -- --url https://<production-host> --run-catalog`
      from a secure shell containing the matching `CRON_SECRET`.
- [ ] Sign in, confirm the Riftbound catalog is populated, and create one watch.
- [ ] Run an explicit market scan with
      `pnpm smoke:hosted -- --url https://<production-host> --run-scan`.
- [ ] Confirm the watch metric, observation, and scan run are present.
- [ ] Run `pnpm ops:status -- --allow-hosted` with the production pooled
      `DATABASE_URL` in a secure environment and save only its aggregate output.
- [ ] Leave the daily schedule active for at least one observation window and
      review Vercel function logs and Supabase connection usage.

Vercel Cron invokes production GET routes, does not retry failures, may overlap,
and may deliver an event more than once. Riftwatch's PostgreSQL leases and
idempotent notification records protect those cases. See
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 6. Configure Telegram

- [ ] Create the production bot with BotFather and record its token and username
      in the password manager.
- [ ] Generate a unique webhook secret and set all three Telegram variables in
      Vercel Production.
- [ ] Redeploy so the new variables reach the functions.
- [ ] In a secure local shell containing the same Telegram variables, run
      `pnpm telegram:webhook:set -- --url https://<production-host>`.
- [ ] Run `pnpm telegram:webhook:status` and confirm the webhook is configured
      with no pending error.
- [ ] Link the administrator account through Settings and confirm the one-time
      token cannot be reused.
- [ ] Trigger a controlled qualifying test alert and confirm exactly one Telegram
      delivery is recorded as sent.

Telegram sends the configured secret in `X-Telegram-Bot-Api-Secret-Token`; see
the official [Bot API `setWebhook` documentation](https://core.telegram.org/bots/api#setwebhook).
Use `pnpm telegram:webhook:delete` during shutdown or credential rotation.

## 7. Promote to five-minute scanning

- [ ] Obtain explicit approval for the Vercel Pro plan and expected function
      usage. Hobby permits only daily cron schedules; minute-level expressions
      fail deployment.
- [ ] Change only the market entry in `vercel.json` from `0 6 * * *` to
      `* * * * *`; keep catalog synchronization daily.
- [ ] Review and deploy that commit. Confirm the Cron Jobs page shows one market
      invocation per minute in UTC.
- [ ] Confirm the database still advances each successful blueprint's
      `next_scan_at` by five minutes and overlapping calls do not double-claim.
- [ ] Observe the first hour, first day, and first seven days. Review stale
      blueprints, partial/failed runs, notification failures, CardTrader errors,
      function duration, and database connections.
- [ ] Keep the current 20% and €5 thresholds during the shadow period. Revisit
      them only with multi-day evidence.

Current plan limits and cron precision are documented in
[Vercel cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 8. Rollback and incident checklist

- [ ] For scanner trouble, restore the daily schedule or remove the market cron
      entry and deploy before changing application code.
- [ ] For notification trouble, remove the Telegram webhook and disable affected
      channels while retaining delivery evidence.
- [ ] For a bad application deployment, use Vercel rollback and separately verify
      the active cron configuration; rolling back code does not automatically
      restore prior cron settings.
- [ ] For a database migration failure, stop writes and restore from the approved
      backup procedure. Never run `pnpm local:reset` against hosted data.
- [ ] Rotate any credential that appeared in logs or an unauthorized location;
      removing it from a file is not sufficient.
- [ ] Record the incident window, affected scans/deliveries, recovery action, and
      remaining follow-up without including credentials or user identifiers.

## Completion gate

The MVP production roadmap is complete only when every applicable checkbox above
is closed, the five-minute schedule has completed a stable observation period,
and the hosted Google, CardTrader, database, and Telegram paths have each been
verified. Local tests and a successful Vercel build are not substitutes for this
operator validation.

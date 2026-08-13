# Production rollout checklist

This is the operator handoff for the first hosted Riftwatch deployment. Repository
automation is safe to prepare locally, but every checkbox below changes an
external account, hosted database, credential, deployment, webhook, billing
plan, or production schedule and therefore requires the project owner.

The initial rollout uses Vercel's daily Hobby-compatible smoke schedule. Do not
enable minute-level scanning until the daily deployment is healthy and the
Vercel plan change has been approved.

Status updated **2026-08-12**: repository controls, the initial Supabase
database migration, the production Vercel database connection, production
Google authentication, and the daily hosted smoke checks are complete. Preview
Google authentication is intentionally deferred until the project adopts a
stable Preview origin and an isolated OAuth client. The initial production
telemetry review is complete. The production Telegram bot, webhook, account
link, and controlled alert delivery are operational. The daily scan schedule is
intentionally retained while a small friends-and-family cohort validates demand;
five-minute scanning is deferred and no paid-plan change is currently planned.

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
      in `public`, and `drizzle.__drizzle_migrations` contains all migrations
      deployed at that point.
- [x] After the first Vercel deployment, confirm `/api/health` reports
      `database: "connected"` through the pooled production `DATABASE_URL`.
- [x] Review Supabase backup and restore coverage. The current Free project has
      no managed scheduled backups or downloadable platform backup.
- [x] Choose the no-cost manual logical-backup position and add guarded backup,
      checksum, disposable local restore verification, and operator
      documentation in [Database recovery](DATABASE_RECOVERY.md).
- [x] Install PostgreSQL 17 client tools on the trusted operator workstation,
      run `pnpm db:backup -- --output <external-directory> --allow-hosted`, and
      verify that archive with `pnpm db:restore:verify -- --file <archive>`.
      Record only the archive and verification timestamps in private operator
      notes. Do not invite the validation cohort until this succeeds.

Recovery evidence recorded **2026-08-12**: a production logical archive and its
integrity manifest were created at 17:48 UTC with owner-only file permissions.
At 17:49 UTC, its checksum, application schema, Drizzle migration history, and
core data queries passed a disposable local PostgreSQL 17 restore. The verifier
then removed the temporary database. No hosted write or restore was performed.

Supabase recommends transaction pooling for temporary/serverless application
traffic and direct connections for migrations and native PostgreSQL tools:
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
Region availability is documented in the
[Supabase region guide](https://supabase.com/docs/guides/platform/regions).
Current managed backup availability is documented in
[Supabase pricing](https://supabase.com/pricing); manual logical backup and
restore are documented in the
[Supabase CLI backup guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

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
- [x] Keep the committed daily catalog and market cron schedules for the first
      deployment.
- [x] Configure the Production variables below without granting
      `DATABASE_URL_DIRECT` to the runtime.
- [ ] Complete and verify the isolated Preview variable set. Preview must use
      isolated data and credentials; never point a preview at the production
      database. Preview Google authentication remains explicitly deferred and
      does not block the friends-and-family production validation.
- [x] Deploy once after changing environment variables; Vercel does not apply
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

- [x] Create a Google OAuth **Web application** client for the owned production
      domain.
- [x] Configure the authorized JavaScript origin as the exact HTTPS origin.
- [x] Configure the exact redirect URI as
      `https://<production-host>/api/auth/callback/google`.
- [x] Configure the OAuth consent screen, homepage, privacy policy, support
      contact, and test/published audience required by Google.
- [x] Store the client ID and secret only in Vercel Production variables.
- [x] Sign in with `ADMIN_EMAIL` and confirm the user is provisioned as an
      administrator.
- [x] Invite a second test address and confirm an uninvited address is rejected.

Production Google sign-in is operational. Preview Google sign-in is deferred:
before enabling it, choose a stable branch or custom Preview origin, create a
separate Google OAuth client, and use isolated Preview credentials. Do not add
arbitrary deployment URLs to the production client's allowlist and do not reuse
its secret in Preview.

Google requires exact, HTTPS production redirect URI matching; see the
[Google web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server)
and [OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

## 5. Daily hosted smoke rollout

- [x] Deploy `main` with the daily schedules in `vercel.json`.
- [x] Run `pnpm smoke:hosted -- --url https://<production-host>` without an
      authorization flag. Confirm health, public pages, sign-in redirects, and
      cron rejection all pass.
- [x] Run `pnpm smoke:hosted -- --url https://<production-host> --run-catalog`
      from a secure shell containing the matching `CRON_SECRET`.
- [x] Sign in, confirm the Riftbound catalog is populated, and create one watch.
- [x] Run an explicit market scan with
      `pnpm smoke:hosted -- --url https://<production-host> --run-scan`.
- [x] Confirm the watch metric, observation, and scan run are present.
- [x] Run `pnpm ops:status -- --allow-hosted` with the production pooled
      `DATABASE_URL` in a secure environment and save only its aggregate output.
- [x] Leave the daily schedule active for at least one observation window and
      confirm scheduled catalog and market runs succeed.
- [x] Review Vercel function logs and Supabase connection usage in their
      provider dashboards.

Smoke evidence recorded **2026-08-12**: the public boundary checks passed, an
authorized catalog run synchronized 1,521 blueprints, and an authorized market
run successfully scanned both due blueprints with no failures. Three current
watch metrics, three hourly observations, and one recent successful market run
were present. The aggregate status reported three active watches across two
blueprints, zero stale blueprints, zero failed or partial runs in the preceding
24 hours, and zero failed notification deliveries. The retained daily catalog
and market jobs also had successful runs in their scheduled observation windows.
The reviewed Vercel window contained only expected successful responses, the
unauthenticated dashboard redirect, and deliberate cron-authentication
rejections; it contained no warnings, errors, or server failures. Supabase had
no connection-exhaustion evidence. Its repeated `3F000` entries were the known
PostgREST placeholder-schema noise caused by the intentionally disabled Data
API, not application database failures. No credential values or user-level
records were included in the evidence.

Vercel Cron invokes production GET routes, does not retry failures, may overlap,
and may deliver an event more than once. Riftwatch's PostgreSQL leases and
idempotent notification records protect those cases. See
[Vercel cron management](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

## 6. Configure Telegram

- [x] Create the production bot with BotFather and record its token and username
      in the password manager.
- [x] Generate a unique webhook secret and set all three Telegram variables in
      Vercel Production.
- [x] Redeploy so the new variables reach the functions.
- [x] In a secure local shell containing the same Telegram variables, run
      `pnpm telegram:webhook:set -- --url https://<production-host>`.
- [x] Run `pnpm telegram:webhook:status` and confirm the webhook is configured
      with no pending error.
- [x] Link the administrator account through Account settings.
- [x] Confirm one-time link consumption is an atomic database claim. A concurrent
      integration test submits the same token twice and proves exactly one
      request links the account and sends confirmation.
- [x] Trigger a controlled qualifying test alert and confirm exactly one Telegram
      message is received with the expected deal evidence and CardTrader button.
- [x] Confirm the corresponding production notification-delivery record is
      `sent` and no duplicate delivery was created.

Production evidence recorded **2026-08-12**: the bot was configured as
`RiftwatchAlertsBot`, the webhook reported healthy, the administrator linked the
account, and one controlled qualifying alert arrived with the expected card,
pricing, and direct CardTrader action. The Riftwatch application link initially
contained a duplicate slash; the URL join was fixed, merged, deployed, and the
application build subsequently succeeded. No bot credential or webhook secret
was included in the evidence. A read-only database audit subsequently confirmed
one enabled Telegram channel, consumed state for both retained link-token rows,
and exactly one delivery for the controlled alert: `sent`, one attempt, a send
timestamp, no recorded error, and no duplicate dedupe key.

Token consumption and channel linking now share one transaction. The conditional
`UPDATE ... RETURNING` is the claim: after one transaction consumes the row,
concurrent and sequential attempts return no link and send no confirmation.

Telegram sends the configured secret in `X-Telegram-Bot-Api-Secret-Token`; see
the official [Bot API `setWebhook` documentation](https://core.telegram.org/bots/api#setwebhook).
Use `pnpm telegram:webhook:delete` during shutdown or credential rotation.

### Deploy structured validation feedback

- [x] Before deploying the feedback UI, create and locally verify the first
      manual production backup described in Section 2.
- [x] Apply migration `0002_rare_klaw.sql` from the trusted migration shell. It
      adds one outcome enum and the RLS-enabled `alert_feedback` table; it does
      not rewrite existing alert rows.
- [x] Deploy the matching application commit and confirm `/api/health` remains
      healthy.
- [x] Have one invited user rate an alert from a mobile viewport, change the
      answer once, and confirm the alert is marked read.
- [ ] Confirm Administration shows exactly one latest response for that alert
      and no free-form or credential data is stored.

Repository evidence recorded **2026-08-12**: ownership enforcement and editable
one-row-per-alert feedback pass PostgreSQL integration tests. The mobile-first
bottom sheet, desktop dialog, shared success feedback, administrator aggregate,
and horizontal-overflow checks pass Playwright across every application page.
These local checks do not mark the hosted migration or user validation complete.

Preview evidence recorded **2026-08-12**: all committed migrations were applied
through the non-production session-mode connection. A read-only query confirmed
the `alert_feedback` table, enabled RLS, all six outcome values, and three
Drizzle migration-history rows. The production migration remains a separate
operator gate.

Production evidence recorded **2026-08-12**: migration `0002_rare_klaw.sql`
completed successfully through the verified `aws-0-eu-central-1` session pooler.
A read-only query confirmed the `alert_feedback` table, enabled RLS, all six
outcome values, and three Drizzle migration-history rows. No application data was
rewritten; the matching application deployment and invited-user validation are
complete. Administration aggregate validation remains outstanding.

### Deploy alert Inbox and event lifecycle

- [ ] Apply migration `0003_absurd_slipstream.sql` to Preview and Production
      from their respective trusted migration sessions. It removes the old
      per-watch/listing uniqueness constraint, adds `archived_at`, and adds a
      lookup index so historical feedback remains attached to each alert event.
- [ ] Deploy the matching application commit and confirm `/api/health` remains
      healthy in both environments.
- [ ] Verify on mobile: archive an Inbox alert, confirm the watch remains
      active, restore it from History, and confirm it returns to Inbox.
- [ ] Trigger local integration coverage for unchanged, improved, and different
      listing cases before considering any scanner schedule change.

## 7. Five-minute scheduled scanning

The source and local verification are ready, but neither clock is enabled by
this repository work. Choose exactly one option after the alert lifecycle
deployment is healthy. Do not advertise five-minute coverage until the selected
clock completes its observation period.

### 7a. Cloudflare Workers Free bridge

This is the no-cost friends-and-family option. It uses the existing protected
Riftwatch scan route, keeps Vercel on Hobby’s daily schedule, and makes no
CardTrader request when no blueprint is due.

- [x] Keep `vercel.json` on the daily Hobby-compatible market schedule and
      retain the five-minute scanner cadence and overlap-safe leases in code.
- [x] Prepare the disabled scheduler source, local validation, and complete
      operator runbook in [Cloudflare five-minute scheduler](CLOUDFLARE_SCHEDULER.md).
- [ ] Create the Worker on the Cloudflare Workers Free plan and deploy it while
      `SCHEDULER_ENABLED=false`. This is an external production action.
- [ ] Add the canonical scan URL and matching `CRON_SECRET` as encrypted Worker
      secrets; never put either in source, a command line, or a local Worker
      file.
- [ ] Verify disabled ticks make no request, then explicitly set
      `SCHEDULER_ENABLED=true` when the limited cohort is ready.
- [ ] Observe the first hour, first day, and first seven days: scan requests,
      stale blueprints, partial/failed runs, notification failures, CardTrader
      errors, function duration, database connections, and Cloudflare usage.
- [ ] Set `SCHEDULER_ENABLED=false` immediately for scheduler trouble. Retain
      the daily Vercel fallback and record the incident.

### 7b. Vercel Pro replacement

Use this only once product demand and the recurring budget justify replacing the
free bridge. Disable the Cloudflare Worker before deploying the Vercel change.

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

- [ ] For Cloudflare bridge trouble, set `SCHEDULER_ENABLED=false` before
      changing application code. For Vercel-native cron trouble, restore the
      daily schedule or remove the market entry and deploy.
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

## Completion gates

The current friends-and-family validation gate does not require Section 7. It
requires the applicable items in Sections 1–6, a reviewed backup/recovery
position, and working hosted Google, CardTrader, database, and Telegram paths.
The remaining Preview configuration does not block this production-only cohort.

The later five-minute MVP gate requires the Section 7 promotion and observation
period plus an applicable Section 8 incident response. Local tests and a
successful Vercel build are not substitutes for either operator validation.

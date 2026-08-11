# Production rollout checklist

This is the operator handoff for the first hosted Riftwatch deployment. Repository
automation is safe to prepare locally, but every checkbox below changes an
external account, hosted database, credential, deployment, webhook, billing
plan, or production schedule and therefore requires the project owner.

The initial rollout uses Vercel's daily Hobby-compatible smoke schedule. Do not
enable minute-level scanning until the daily deployment is healthy and the
Vercel plan change has been approved.

## 1. Review and repository controls

- [ ] Review and merge `agent/production-readiness` into `main` after CI passes.
- [ ] Confirm GitHub secret scanning reports no exposed credential.
- [ ] Protect `main` and require the CI `verify` and `secrets` jobs.
- [ ] Record who can administer GitHub, Vercel, Supabase, Google OAuth, and the
      Telegram bot.

## 2. Provision PostgreSQL

- [ ] Create one Supabase project in **Central EU (Frankfurt)** or another
      explicitly selected EU region.
- [ ] Generate a unique database password and store it in the team's password
      manager.
- [ ] Copy the transaction-mode pooler URL on port `6543` for `DATABASE_URL`.
- [ ] Copy the direct URL on port `5432` for `DATABASE_URL_DIRECT`. If the
      migration workstation cannot reach the IPv6 direct endpoint, use the
      session-mode pooler on port `5432` for this one-session operation.
- [ ] Confirm SSL is enabled in both connection strings.
- [x] Disable the Supabase Data API. Riftwatch does not use PostgREST,
      Supabase browser keys, Storage, or Realtime.
- [ ] Apply committed migrations with `pnpm db:migrate` from a trusted machine
      where `DATABASE_URL_DIRECT` is present in the process environment. Do not
      paste either URL into shell history, logs, issues, or chat.
- [ ] Confirm the migration command reports success and `/api/health` can query
      the resulting schema after deployment.
- [ ] After the security migration, create `riftwatch_app` interactively with
      login and no elevated role flags, grant it `riftwatch_runtime`, and set its
      password with `psql`'s `\password` prompt. Never commit the password or put
      it in SQL history.
- [ ] Replace the transaction-pooler username with
      `riftwatch_app.<project-ref>`, keep port `6543` and `sslmode=require`, then
      update only Vercel `DATABASE_URL` and redeploy.
- [ ] Remove the `postgres` runtime URL from Vercel and shell startup files.
      Retain the migration credential only in the password manager and trusted
      migration shell.
- [ ] Run `pnpm db:security-audit -- --allow-hosted` with the new pooled runtime
      URL. Confirm the role is unprivileged, TLS is active, every application
      table forces RLS, Supabase API grants are zero, and audit mutation grants
      are zero.
- [ ] Review Supabase backup and restore coverage before inviting users. Point-in-
      time recovery is a separate paid capability and must not be enabled without
      approval.

Supabase recommends transaction pooling for temporary/serverless application
traffic and direct connections for migrations and native PostgreSQL tools:
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).
Region availability is documented in the
[Supabase region guide](https://supabase.com/docs/guides/platform/regions).

## 3. Configure the Vercel project

- [ ] Import `collets/cardtracker` into Vercel and select `main` as the production
      branch.
- [ ] Confirm the function region is `fra1`, as committed in `vercel.json`.
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
| `DATABASE_URL`                                                             | `riftwatch_app` Supabase transaction pooler                      | Isolated preview database     |
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
intended production runtime values and no `DATABASE_URL_DIRECT`. Before
migration, use a separate shell containing the direct URL and run
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
      cron rejection all pass. The command also verifies the strict CSP,
      security headers, and secure Auth.js cookie attributes.
- [ ] In Vercel Firewall, prepare one fixed-window rule for non-static traffic:
      120 requests per minute per source IP. Publish in log mode, review normal
      traffic, then enforce 429. Skip the rule if the dashboard requires a paid
      opt-in; do not approve billing implicitly.
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

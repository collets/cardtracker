# Production rollout checklist

This is the operator runbook for deploying the security baseline from
`security/hardening-baseline` to the existing Riftwatch production environment.
It replaces the original first-deployment checklist: production, Supabase, and
Google OAuth are already running.

The current production origin is
[`https://cardtracker-liart.vercel.app`](https://cardtracker-liart.vercel.app).
Vercel tracks `main` as the production branch, so merging the pull request
automatically creates a production deployment. Do not merge until the pre-merge
database and runtime-role canary below are complete.

Every unchecked item changes an external account, hosted database, credential,
deployment, production job, or billing setting and requires the project owner.
Repository automation may prepare and verify changes locally, but it must not
perform those hosted operations implicitly.

## 1. Confirmed current state

The following items were completed and confirmed before the security release:

- [x] Merge the original production-readiness work into `main`.
- [x] Configure repository review controls and GitHub secret scanning.
- [x] Create the Supabase project in Central EU (Frankfurt), store its database
      password, and collect transaction-pooler and migration connection URLs.
- [x] Apply the baseline migrations and confirm the application tables exist.
- [x] Require SSL for incoming Supabase database connections.
- [x] Disable the Supabase Data API. Riftwatch does not use PostgREST,
      Supabase browser keys, Storage, or Realtime.
- [x] Import `collets/cardtracker` into Vercel with `main` as the production
      branch and `fra1` as the function region.
- [x] Deploy production with the Hobby-compatible daily catalog and scan jobs
      committed in `vercel.json`.
- [x] Configure the production application, database, Auth.js, CardTrader, cron,
      capacity, and administrator variables.
- [x] Configure Google OAuth for the production origin and verify administrator
      sign-in.
- [x] Verify the administrator area and manual catalog synchronization.

These confirmations do not cover the new security migration, the
`riftwatch_app` runtime login, an isolated Preview database, or the security
deployment itself.

## 2. Pull request and Preview gate

- [ ] Open a pull request from `security/hardening-baseline` to `main`.
- [ ] Confirm the GitHub Actions `verify` and `secrets` jobs pass on the exact
      commit intended for merge.
- [ ] Review the authentication, authorization, CSP, production tooling, and
      `drizzle/0002_spicy_mulholland_black.sql` changes in the pull request.
- [ ] Confirm the Vercel Preview build completes.
- [ ] Choose and record one Preview strategy for this release:
  - Provision an isolated Preview PostgreSQL database, apply the committed
    migrations to it, and configure branch-specific Preview credentials; or
  - Leave database-backed Preview routes intentionally unavailable and rely on
    the completed local integration/E2E suite for this release.
- [ ] Confirm no Preview variable points to the production database, Auth.js
      secret, cron secret, OAuth secret, or Telegram configuration.

Do not make Preview functional by reusing production data. Vercel creates
Preview deployments for non-production branches, and environment variables can
be scoped to a specific Preview branch. See the
[Vercel environment documentation](https://vercel.com/docs/environment-variables).

Do not merge after CI passes. Continue with the controlled production database
change below while the pull request remains open.

## 3. Prepare the trusted migration shell

Use a dedicated shell whose history and output are not recorded. Do not keep
production database URLs in `.zshrc`, `.env.local`, repository files, issues, or
chat. Load credential values from the password manager and unset them when the
change is complete.

The migration shell must contain the complete intended production environment:

- `NEXT_PUBLIC_APP_URL`
- `DATABASE_URL` using the planned
  `riftwatch_app.<project-ref>` transaction-pooler login, port `6543`, and
  `sslmode=require`
- `DATABASE_URL_DIRECT` using the privileged direct connection or the
  IPv4-compatible session pooler on port `5432`
- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET`
- `AUTH_ENABLE_DEV_PROVIDER=false`
- `ADMIN_EMAIL`
- `CARD_TRADER_AUTH_TOKEN`
- `CRON_SECRET`
- the intended scanner and quota values
- either all three Telegram variables or none; Telegram remains unset for this
  release

Generate and store the new `riftwatch_app` password before constructing the
planned runtime URL. Percent-encode only the password component in that URL.
The role does not have to exist yet for the environment validation command.

- [ ] Confirm the direct/session migration URL uses SSL and is reachable from
      the trusted shell.
- [ ] Confirm the planned runtime URL uses the shared transaction pooler and the
      `riftwatch_app.<project-ref>` username.
- [ ] Run the migration-mode environment check:

  ```sh
  pnpm prod:check-env -- --require-direct
  ```

- [ ] Confirm the command reports a complete, internally consistent production
      environment without displaying values.

Supabase recommends a direct connection for migrations and native PostgreSQL
tools. When the workstation cannot reach the direct IPv6 endpoint, the shared
pooler's session mode on port `5432` is the IPv4-compatible migration option.
Vercel runtime traffic should use transaction mode on port `6543`. See the
[Supabase connection guide](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 4. Apply security migration `0002`

This is the first production mutation in this runbook. Start a short change
window and avoid new Google sign-ins until the security deployment is live: the
old application version can still persist OAuth token material that migration
`0002` clears.

- [ ] Confirm `0002_spicy_mulholland_black` is the only unapplied committed
      migration.
- [ ] In the trusted `psql` session, record the current Drizzle migration count:

  ```sql
  select count(*) as applied_drizzle_migrations
  from drizzle.__drizzle_migrations;
  ```

- [ ] Confirm the current Supabase backup/restore coverage is understood. Do not
      enable a paid backup or point-in-time-recovery feature without approval.
- [ ] Apply the committed migration from the trusted shell:

  ```sh
  pnpm db:migrate
  ```

- [ ] Confirm the command exits successfully and the count in
      `drizzle.__drizzle_migrations` increased by exactly one.
- [ ] Confirm `admin_audit_events`, `job_leases`, and `riftwatch_runtime` now
      exist.
- [ ] If migration fails, stop. Do not edit the applied migration, rerun it
      blindly, reset the hosted database, or proceed to deployment.

The migration is forward-only. It creates the non-login runtime role, enables
and forces RLS on application tables, removes public/Supabase API object access,
adds leases and the append-only administrator audit table, and clears unused
stored OAuth tokens.

Drizzle migrations are not listed in Supabase's migration UI. The authoritative
application migration history for this repository is
`drizzle.__drizzle_migrations`; the Supabase Table Editor showing the resulting
tables is not a substitute for checking that history.

## 5. Create and verify the application login

Open `psql` using `DATABASE_URL_DIRECT`. Create the login without embedding a
password in SQL or shell history, then use `\password` for the prompt:

```sql
create role riftwatch_app
  with login inherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant riftwatch_runtime to riftwatch_app;
\password riftwatch_app
```

Use the same password stored for the planned `DATABASE_URL`. Supavisor custom
login usernames use the form `riftwatch_app.<project-ref>`.

- [ ] Confirm `riftwatch_app` can log in through the transaction pooler.
- [ ] Confirm it is not a superuser, cannot create databases or roles, cannot
      replicate, and cannot bypass RLS.
- [ ] Remove `DATABASE_URL_DIRECT` from the shell, leaving `DATABASE_URL` set to
      the new pooled runtime URL.
- [ ] Validate the runtime environment:

  ```sh
  unset DATABASE_URL_DIRECT
  pnpm prod:check-env
  ```

- [ ] Run the read-only database security audit:

  ```sh
  pnpm db:security-audit -- --allow-hosted
  ```

- [ ] Confirm TLS is active, all application tables force RLS, unsafe
      `PUBLIC`/Supabase API grants are zero, unsafe default grants are zero, and
      the audit table has no update/delete/truncate grant.
- [ ] Run the read-only operational query through the same role:

  ```sh
  pnpm ops:status -- --allow-hosted
  ```

Stop if either read-only command fails. Do not compensate by granting
`riftwatch_app` broad privileges or `BYPASSRLS`.

Supabase recommends a distinct database user for each external service rather
than giving it the `postgres` credential. See the
[Supabase role guide](https://supabase.com/docs/guides/database/postgres/roles).

## 6. Canary the runtime role before merging

Vercel environment changes apply only to new deployments. Update the Production
variable, then redeploy the latest existing `main` production deployment before
merging the security pull request. This isolates the database-role switch from
the application-code switch.

- [ ] Replace only the Vercel Production `DATABASE_URL` with the verified
      `riftwatch_app` transaction-pooler URL and mark it sensitive.
- [ ] Confirm `DATABASE_URL_DIRECT` is not configured in Vercel Production,
      Preview, or Development.
- [ ] Redeploy the latest existing `main` production deployment so it receives
      the new runtime URL. Do not deploy the security branch as Production yet.
- [ ] Confirm the redeployment becomes Ready and the current production alias
      still resolves to the existing `main` code.
- [ ] Verify database readiness without signing in:

  ```sh
  curl --fail --silent --show-error \
    https://cardtracker-liart.vercel.app/api/health
  ```

- [ ] Confirm the response reports `status: ok` and `database: connected`.
- [ ] Review Vercel function logs and Supabase connections for authentication,
      permission, RLS, or pooler errors.

Do not remove the privileged `postgres` password from the password manager. It
remains the migration/incident credential, but it must no longer be a Vercel
runtime variable or a shell-startup variable.

If the canary fails, restore the previous Vercel `DATABASE_URL` value and
redeploy the previous Production deployment. Keep the new schema and audit the
failed permission or connection path; do not reset or reverse the database.

## 7. Merge and deploy the security release

Only continue when the pull request checks, database audit, operational query,
and runtime-role canary all pass.

- [ ] Reconfirm the pull request head SHA has not changed since CI review.
- [ ] Merge `security/hardening-baseline` into `main`.
- [ ] Confirm Vercel creates a Production deployment from the merge commit using
      the verified `riftwatch_app` runtime URL.
- [ ] Confirm the deployment becomes Ready before performing mutations.
- [ ] Run the safe hosted smoke suite without cron mutation flags:

  ```sh
  pnpm smoke:hosted -- --url https://cardtracker-liart.vercel.app
  ```

- [ ] Confirm health, landing page, anonymous redirect, cron rejection, strict
      CSP/security headers, and secure Auth.js cookie checks pass.
- [ ] Sign in with the verified `ADMIN_EMAIL` and confirm `/admin` loads.
- [ ] Perform one controlled administrator action and confirm its success event
      appears in the administrator audit table.
- [ ] Confirm an invalid or unauthorized administrator action is rejected and a
      safe failure event is recorded where applicable.
- [ ] Run this count-only query from a trusted database session and confirm it
      returns zero after the new Google sign-in:

  ```sql
  select count(*) as accounts_with_stored_oauth_tokens
  from accounts
  where refresh_token is not null
     or access_token is not null
     or id_token is not null;
  ```

- [ ] Review Vercel logs for CSP, Auth.js, database permission, and Server Action
      errors without copying credentials or user data into the rollout record.

Vercel automatically creates a Production deployment when a commit reaches the
configured production branch. See the
[Vercel Git deployment guide](https://vercel.com/docs/git). Environment changes
are deployment-scoped and do not alter existing deployments retroactively.

## 8. Controlled catalog and scanner verification

The commands in this section mutate hosted state and call CardTrader. Run them
only after the safe deployment checks pass and only with explicit production
authorization.

- [ ] Run one authenticated catalog job from the trusted shell:

  ```sh
  pnpm smoke:hosted -- \
    --url https://cardtracker-liart.vercel.app \
    --run-catalog
  ```

- [ ] Confirm the catalog job succeeds or returns the expected recent/busy skip,
      records an administrator/operational event where applicable, and does not
      overlap another catalog job.
- [ ] Confirm Discover remains populated and create or inspect one controlled
      watch.
- [ ] Run one authenticated market job:

  ```sh
  pnpm smoke:hosted -- \
    --url https://cardtracker-liart.vercel.app \
    --run-scan
  ```

- [ ] Confirm the watch metric, observation, scan run, and lease behavior are
      correct.
- [ ] Run `pnpm ops:status -- --allow-hosted` again and retain only its aggregate
      output.
- [ ] Leave the daily Hobby schedule active for at least one observation window
      and review Vercel function logs and Supabase connection usage.

Vercel Cron can overlap or deliver an event more than once. Riftwatch's database
leases and idempotent notification records protect these cases. Vercel Hobby
permits daily schedules but not more frequent cron expressions; execution may
occur at any point within the selected hour. See the
[Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

## 9. Optional WAF follow-up

- [ ] If available without a paid opt-in, create a fixed-window Vercel Firewall
      rule for non-static traffic at 120 requests per minute per source IP.
- [ ] Publish it in log mode first, review legitimate traffic, and only then
      enforce HTTP 429.
- [ ] Skip and record the item when Vercel requires a plan change or paid
      overage. Do not approve billing implicitly.

WAF publication is not a merge gate when it requires payment. Authentication,
authorization, quotas, leases, and cron secrets remain the application-level
controls.

## 10. Deferred work: Telegram

Telegram is disabled and explicitly outside this security release. Keep
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and
`TELEGRAM_WEBHOOK_SECRET` all unset in Production and Preview.

Do not register a webhook or treat Telegram verification as a completion gate.
Before enabling it later, perform the dedicated webhook, one-time-link race,
delivery-idempotency, credential-rotation, and abuse review described in
[`docs/SECURITY.md`](SECURITY.md).

## 11. Deferred work: five-minute scanning

The committed schedules remain daily:

- catalog: `0 3 * * *`
- market scan: `0 6 * * *`

Promotion to minute-level invocation requires separate approval for Vercel Pro
and expected function usage. After approval, change only the market schedule to
`* * * * *`, observe capacity and CardTrader behavior, and confirm successful
blueprints continue advancing `next_scan_at` by five minutes.

This paid-plan promotion is not a merge or security-release completion gate.

## 12. Rollback and incident paths

- **Before merge, runtime-role canary fails:** restore the previous Production
  `DATABASE_URL`, redeploy the previous Production deployment, and diagnose the
  role/pooler/grant failure. Do not remove RLS or grant bypass privileges.
- **New application deployment fails:** use Vercel rollback to the runtime-role
  canary deployment. The old application was verified against the new role
  before merge.
- **Cron or scanner trouble:** disable the affected Vercel Cron Job or redeploy
  without that cron entry before changing evidence tables.
- **Database integrity is uncertain:** stop application writes and cron jobs,
  preserve logs/audit evidence, and use the approved backup procedure. Never run
  `pnpm local:reset` or an ad hoc destructive repair against hosted data.
- **Credential exposure:** revoke and rotate the credential, update the correct
  Vercel environment, and redeploy. Removing a value from a file or log is not
  revocation.

Vercel code rollback does not automatically restore cron configuration. Verify
the active Cron Jobs page separately after every rollback. Record incident time,
impact, recovery, and follow-up without credentials or personal identifiers.

## Security release completion gate

The security release is complete only when:

- the exact reviewed commit passed both GitHub Actions jobs;
- migration `0002` was applied once without unresolved errors;
- Vercel runs through `riftwatch_app`, not `postgres`;
- the hosted database security audit reports no unsafe role, TLS, RLS, default
  grant, Supabase API grant, or audit-mutation condition;
- the safe hosted smoke suite passes on the production deployment;
- Google sign-in, administrator authorization, ownership checks, CSP, audit
  events, catalog, and one controlled scan are verified; and
- production logs show no unresolved permission, authentication, CSP, scanner,
  or connection-pool errors.

Preview isolation, WAF publication, Telegram, and five-minute scanning remain
separately recorded follow-ups as described above. Local tests and a successful
Vercel build are necessary evidence, but they are not substitutes for this
operator validation.

# Future improvements and deferred work

This register preserves product, architecture, and operational ideas that were
deliberately left outside the current MVP. An entry is not a commitment or an
authorization to change hosted systems, enable a paid plan, or migrate data.
Move an item into `implementation.md` only after its scope and acceptance
criteria have been agreed.

Last reviewed: **2026-08-12**.

## How to use this register

- **Candidate** means the idea is useful but still needs a product or technical
  decision.
- **Parked implementation** means code exists on a branch but must be reconciled
  with current `main`; it is not ready to merge as-is.
- **Operational gate** means the repository is prepared, but an owner decision,
  external account change, or paid capability is required.
- Keep production mutations, credential changes, migrations, webhook changes,
  and paid services in the operator rollout rather than treating this file as
  authorization.

## Candidate roadmap

| Area                   | Status                | Candidate outcome                                                                                                                         | Resume when                                                                           |
| ---------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Production delivery    | Candidate             | Trunk-based, manually approved production releases from a verified `main` Preview deployment                                              | Preview variables and stable `main` Preview authentication are finalized              |
| Security baseline      | Parked implementation | Stronger database, HTTP, audit, authorization, and abuse controls                                                                         | The parked branch is rebased and reviewed control by control                          |
| CardTrader credentials | Candidate             | Each user supplies a personal CardTrader token for user-initiated market scans; a service credential remains responsible for catalog work | Credential storage, ownership, fair scheduling, and revocation are designed           |
| Background processing  | Candidate             | Durable scan jobs, retries, progress reporting, and live UI updates                                                                       | Serverless request limits or scan volume make synchronous orchestration unreliable    |
| Cardmarket             | Candidate             | Add Cardmarket as a distinct marketplace provider                                                                                         | API access, terms, normalization, and provider-specific deal semantics are understood |
| Invitation delivery    | Candidate             | Send an actual invitation email while preserving the database allowlist as the authorization source                                       | A transactional email provider and sender domain are approved                         |
| Telegram diagnostics   | Candidate             | Let a linked user send a safe test notification from Account settings                                                                     | The desired abuse controls and audit behavior are agreed                              |
| Deal calibration       | Candidate             | Tune thresholds and confidence using multi-day evidence, without weakening sparse-data rejection                                          | Enough observations and false-positive/false-negative feedback exist                  |
| Faster scanning        | Operational gate      | Move from the daily smoke schedule to five-minute market coverage                                                                         | The paid Vercel plan and usage budget are explicitly approved                         |
| Recovery               | Operational gate      | Define and test hosted backup restoration; optionally add point-in-time recovery                                                          | Retention requirements and any Supabase paid-plan change are approved                 |

## Automated manual production releases

The preferred direction is trunk-based development with `main` as the only
active integration branch:

1. Every feature branch receives GitHub and Vercel Preview checks using isolated
   Preview data.
2. A merge to `main` creates a stable Preview deployment and does not implicitly
   modify production.
3. An operator manually starts a GitHub Actions release workflow for the exact
   verified `main` commit.
4. The workflow validates the intended Vercel Production environment, applies
   pending Drizzle migrations through a trusted direct or session-pooler
   connection, promotes the Preview, waits for the Production rebuild, and runs
   safe hosted smoke checks.

The workflow should own promotion rather than run migrations inside the Vercel
build command. It needs a production concurrency lock, an exact commit/deployment
match, immutable action pins, minimal permissions, protected secrets, and a
human-readable release summary. `DATABASE_URL_DIRECT` must remain outside the
Vercel runtime and be available only to the migration job. Migrations preceding
promotion must remain backward compatible with the currently running release.
An automatic rollback is intentionally excluded because a completed database
migration may require operator assessment.

Potential GitHub secrets are `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
`VERCEL_PROJECT_ID`, and `DATABASE_URL_DIRECT`. Before implementation, confirm
which GitHub environment protections are available on the repository's plan.
The ordinary release smoke must not invoke catalog or market jobs; those remain
separate, explicit operational mutations.

The existing `staging` branch was created for a long-lived branch-preview model.
That model is superseded by this proposed trunk workflow. Do not add work to or
delete the branch until the new Vercel production-branch and promotion settings
are adopted and verified.

## Parked security hardening

Branch `security/hardening-baseline` is intentionally preserved. It contains:

- administrator invitation revocation;
- append-only administrator audit events;
- a least-privilege PostgreSQL runtime role, explicit grants, forced RLS, and a
  hosted database security audit;
- stronger user/admin authorization transactions and capacity locking;
- Google token minimization and verified-email checks;
- timing-safe cron authentication and shared catalog/manual-scan leases;
- nonce-based CSP and additional browser security headers;
- security-focused integration, browser, and unit coverage;
- dependency hardening and a complete security/runbook document.

The branch is based on an older application shape and touches 54 files. Later
bulk-watch, scanning, navigation, rollout, dependency, and Telegram work landed
on `main`, so the branch must **not** be merged directly. Its migration also
creates roles, grants, RLS policies, audit storage, and job leases; regenerate
and review the next forward-only migration from the then-current schema rather
than assuming the parked migration is still correct.

When resumed:

1. Create a fresh branch from current `main`.
2. Inventory which controls current `main` already implements.
3. Port small controls independently, preserving current behavior and tests.
4. Re-evaluate the CSP against current Next.js documentation and the Radix UI.
5. Review the database role/RLS design with the current Supabase configuration.
6. Generate a new migration and test it against disposable local PostgreSQL.
7. Run `pnpm check:all`, `pnpm test:integration`, the security audit, and
   negative hosted checks before considering production rollout.

Branch `feature/pending-invite-deletion` contains the smaller invitation-only
ancestor of this work. Treat it as subsumed by the parked security effort rather
than merging both branches.

## Per-user CardTrader credentials

The current server-held CardTrader credential is simple and appropriate for the
catalog and the small MVP. At larger user counts, user-initiated market scans
would otherwise share one external quota. A future model may require an invited
user to register and validate their own CardTrader token during onboarding.

The service credential would continue to perform catalog synchronization and
possibly scheduled maintenance. User tokens would be used only for work owned
by that user. Before implementation, decide:

- whether scheduled scans use the user token, service token, or a fair hybrid;
- how a shared blueprint scan is allocated when several users watch it;
- encrypted-at-rest storage and key rotation, without exposing tokens to the
  browser after submission;
- token validation, revocation, deletion, and safe failure messages;
- per-user rate limits, backoff, quota visibility, and audit metadata;
- behavior when a token expires or is absent;
- whether CardTrader's terms permit this credential model.

Do not implement this as plain-text token storage or log authorization headers.
It is a security and scheduling change, not just an Account form.

## Durable background jobs and live progress

The current scanner deliberately avoids queue infrastructure. PostgreSQL leases,
bounded batches, and adaptive CardTrader expansion requests are sufficient for
the MVP. A real job system becomes worthwhile when operations regularly exceed
serverless request duration, require independent retry/dead-letter handling, or
need progress that survives navigation and process restarts.

A future design may add:

- durable scan/catalog job and item records;
- an idempotent worker with leases, retry policy, cancellation, and dead-letter
  inspection;
- fair per-user scheduling and concurrency/rate limits;
- Server-Sent Events for one-way progress, with polling fallback; or a hosted
  realtime transport only if its operational value justifies it;
- progress, partial-failure, retry, and completion states in the shared UI
  notification system;
- retention and pruning for job events and operational metrics.

Prefer PostgreSQL-backed jobs first so the project does not immediately require
a separate queue provider. Re-evaluate managed queues, workers, and realtime
services only with measured load and a written cost estimate.

## Additional product and integration ideas

### Cardmarket provider

Cardmarket is intentionally outside the current CardTrader integration. Adding
it requires confirmed API access and terms, a provider boundary for catalog and
listing identifiers, currency/shipping normalization, provider-specific links,
and tests proving that listings from different markets are not silently treated
as equivalent evidence. Do not rename CardTrader concepts into ambiguous generic
models until a second provider is actually approved.

### Invitation email

An invitation currently authorizes an email address but does not send mail. A
future delivery flow should use a transactional provider, contain no privileged
token beyond what is necessary, remain idempotent, expose delivery state to an
administrator, and preserve pending-invitation deletion. Email delivery failure
must not accidentally revoke or grant authorization.

### Telegram test notification

The production webhook, account linking, and real deal delivery are operational.
A future Account action could send one clearly labeled test message without
creating an alert or marketplace scan. It must require the current enabled user,
target only that user's linked channel, be rate-limited, avoid a reusable public
route, and record only minimal delivery evidence.

### Pricing and market evidence

Keep the current median comparator, minimum listing count, absolute saving,
relative discount, historical baseline, and integer-cent storage until real
observations justify a change. Candidate refinements include per-rarity or
price-band defaults, seller-quality evidence, staleness weighting, and clearer
false-positive feedback. Shipping remains excluded until a provider exposes it
reliably.

## Paid and operator-controlled improvements

These items are documented but remain unauthorized:

- Vercel Pro for minute-level cron scheduling;
- Supabase Pro or point-in-time recovery;
- paid WAF or advanced deployment-protection features;
- managed queues, workers, realtime infrastructure, email delivery, or
  observability beyond existing free allowances.

Each requires an explicit cost estimate, owner approval, rollback plan, and
update to `docs/PRODUCTION_ROLLOUT.md` before activation.

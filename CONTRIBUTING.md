# Contributing to Riftwatch

Thank you for improving Riftwatch. This project handles private credentials,
external marketplace data, user identities, and potentially time-sensitive deal
alerts, so correctness and operational safety matter as much as UI behavior.

## Start here

1. Read [Development and local environment](docs/DEVELOPMENT.md).
2. Read the relevant decision records in [docs/plan](docs/plan/README.md).
3. Run `pnpm local:setup` and `pnpm check`.
4. Synchronize the local catalog when the work needs real card data.

Coding agents must also follow [AGENTS.md](AGENTS.md) and the project-local
[Riftwatch development skill](skills/riftwatch-development/SKILL.md).

## Working agreement

- Keep changes focused. Avoid unrelated formatting or dependency churn.
- Preserve uncommitted developer work and never reset files you do not own.
- Use the current Next.js 16 App Router APIs and Turbopack. Read the matching
  guide under `node_modules/next/dist/docs/` before changing Next.js behavior.
- Keep TypeScript strict and use TypeScript 6; do not suppress build errors.
- Put trusted integration and persistence logic on the server.
- Validate all server-action and route-handler input at the trust boundary.
- Authorize every user-specific mutation and query by the current database user.
- Store money as integer cents and percentages as integer basis points where the
  existing model does so.
- Use UTC timestamps in persistence and deterministic time buckets.

## Branches and commits

Create a short-lived branch from the current main branch. Use small commits with
imperative subjects that explain the outcome, for example:

```text
Add scanner lease recovery
Validate watch country filters
Document Telegram webhook setup
```

Do not commit `.env*` secrets, local databases, build artifacts, Playwright
reports, or the raw CardTrader Postman collection.

## Change workflow

1. Reproduce or define the expected behavior.
2. Identify the smallest relevant application boundary.
3. Add or update tests for calculation and validation behavior.
4. Implement the change using existing services and components.
5. Generate and inspect a migration when persistence changes.
6. Run the proportional checks described below.
7. Update developer, operations, API, or agent documentation when behavior or
   workflow changes.

## Architecture boundaries

- `src/app`: routes, pages, layouts, server actions, and HTTP handlers.
- `src/components`: reusable UI and chart components.
- `src/db`: schema, connection factory, migrations, and seed entry points.
- `src/lib/cardtrader`: typed CardTrader client and response normalization.
- `src/lib/catalog`: Riftbound catalog synchronization.
- `src/lib/deals`: pure deal eligibility and pricing calculations.
- `src/lib/scanner`: leases, batch execution, observations, and alert lifecycle.
- `src/lib/recommendations`: pure threshold suggestions and authorized,
  optimistic recommendation resolution.
- `src/lib/admin`: bounded, administrator-only operational read models.
- `src/lib/db`: sanitized database timing and failure diagnostics.
- `src/lib/telegram`: linking, webhook processing, and delivery.
- `src/lib/watches`: watch validation and authorized persistence.
- `scripts`: deterministic local development orchestration.

Prefer pure functions for pricing rules. Keep external payload parsing in the
integration layer and database transactions in services. Client components must
not import server-only modules.

For server-rendered data, deduplicate repeated authorization/read-model calls
within the React render pass. Keep production connection pools small because
each serverless instance owns its own pool. Avoid wide `Promise.all` query
fan-out on pages; use a bounded transaction or a consolidated query, and provide
route loading and retry states for hosted dependencies.

Threshold recommendations must reuse scanner evidence rather than add a
CardTrader call. Preserve one recommendation per member watch, guest exclusion,
idempotent Telegram delivery, cent precision for low-value cards, and the
optimistic check that protects manual threshold edits.

## Database changes

Change `src/db/schema.ts`, then run:

```sh
pnpm db:generate
pnpm db:migrate
```

For an explicitly approved hosted migration from a reviewed branch, export that
environment's `DATABASE_URL_DIRECT` and run
`pnpm db:migrate:remote -- --allow-hosted`. The command refuses local targets,
does not accept or display connection strings, and is never a substitute for
reviewing the generated SQL and rollout plan.

Review generated SQL. Call out destructive operations, long locks, data
backfills, and rollback considerations in the PR. Commit generated SQL and
Drizzle metadata. Never rewrite an already-shared migration.

Use `pnpm local:reset` only for your own disposable local volume. It must never
be pointed at Supabase or another shared PostgreSQL instance.
The local orchestrator rejects non-loopback database URLs; do not weaken or
bypass that guard.

## Security and privacy

- Never read, display, log, snapshot, or paste credential values.
- Use `CARD_TRADER_AUTH_TOKEN` only in the server-side Authorization header.
- Never add `NEXT_PUBLIC_` to a secret.
- Reduce external error responses to safe status/context before persistence or
  logging.
- Do not store complete CardTrader marketplace payloads when normalized fields
  are sufficient.
- Keep cron endpoints protected by `CRON_SECRET` and Telegram webhooks protected
  by Telegram's secret-token header.
- Keep the optional Cloudflare scheduler isolated under `cloudflare/`; it may
  only call the existing cron route with encrypted Worker secrets and must stay
  disabled by default. Never put its secrets in Wrangler configuration or run
  its deploy/secret commands without explicit environment approval.
- Keep Auth.js development credentials disabled in production.
- Keep the production build wrapper's development-provider override intact.
- Guest links are hashed, limited-use bearer capabilities. Keep their raw token
  in the URL fragment until redemption; do not expose guest-capable REST
  mutations or rely on the client to enforce guest restrictions. Server actions
  must recheck guest expiry, ownership, quotas, and member-only capabilities.
- Treat listing links and prices as advisory; Riftwatch never purchases items.

If a secret is accidentally committed, stop, revoke it, and follow repository
owner instructions. Removing it from the latest commit is not sufficient.

## Tests required by change type

| Change                              | Minimum verification                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| Documentation only                  | `pnpm format:check` and link/command review                   |
| Pure calculation or validation      | `pnpm check` with focused Vitest coverage                     |
| UI component/page                   | `pnpm check` and relevant Playwright/manual viewport check    |
| Route, action, auth, or integration | `pnpm check`, build, and targeted runtime smoke test          |
| Database schema                     | migration generation/review, local migrate, and affected flow |
| Build/tooling/dependency            | `pnpm check:all` and clean-install reasoning                  |

Database-backed service changes must also pass `pnpm test:integration`. The
integration and Playwright fixture loaders reject non-loopback database URLs;
do not weaken that guard for convenience.

Use `pnpm test:coverage` when changing fast-testable logic, components, or route
boundaries. Its V8 report is intentionally limited to the fast Vitest suite;
database transactions, browser journeys, and hosted topology are covered by
their corresponding integration, Playwright, and safe-smoke layers. Do not add
tests merely to inflate a global percentage—cover authorization, validation,
error handling, and business decisions at the narrowest useful layer.

Production preparation and operator actions are separate. Repository work may
add or test `prod:check-env`, `ops:status`, and safe hosted smoke behavior, but
deployments, hosted migrations, authorized cron calls, webhook mutations, and
plan upgrades require explicit environment-specific approval and follow
[the production rollout checklist](docs/PRODUCTION_ROLLOUT.md).

Manual backups are the exception only in that they are read-only: use the
guarded `pnpm db:backup` command and its explicit `--allow-hosted` flag, then
verify the archive against disposable local PostgreSQL as described in
[Database recovery](docs/DATABASE_RECOVERY.md). A hosted restore always requires
separate production authorization.

Before requesting review, run at least:

```sh
pnpm check
```

## Pull request checklist

- The change has a clear user or operational outcome.
- Inputs are validated and authorization is enforced at the server boundary.
- Tests cover failure paths and edge cases appropriate to the risk.
- Migrations are included and locally applied when needed.
- No credential, raw authorization header, or unsafe fixture is present.
- Documentation and `.env.example` reflect configuration changes.
- `pnpm check` passes; build/E2E evidence is included when relevant.
- Deployment or cron implications are described.

## Dependency updates

Use pnpm and keep `pnpm-lock.yaml` synchronized. Avoid introducing a package when
the platform or an existing dependency already covers the need. For Next.js
changes, check the installed documentation rather than relying on older framework
knowledge. Do not switch the project to webpack or downgrade TypeScript to work
around a tooling or sandbox limitation.

GitHub Actions must remain pinned to immutable commit SHAs with an adjacent
release-version comment. Dependabot checks those pins weekly; verify the upstream
release notes, Node.js action runtime, and compatibility with Node.js 24 and pnpm
10 before merging an update.

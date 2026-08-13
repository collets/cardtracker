---
name: riftwatch-development
description: Develop, debug, test, document, and operate the Riftwatch Next.js application and its local PostgreSQL, CardTrader, Auth.js, scanner, alert, and Telegram workflows. Use for repository setup, feature work, API or server-action changes, database migrations, local-stack management, pricing-rule changes, integration troubleshooting, test failures, and deployment preparation in the Riftwatch repository.
---

# Riftwatch development

Work from the repository root and preserve unrelated developer changes.

## Establish context

1. Read `AGENTS.md` and retain its generated Next.js rule block.
2. Read `docs/DEVELOPMENT.md` for commands and environment behavior.
3. Read `CONTRIBUTING.md` for security, architecture, and verification rules.
4. Read only the relevant decision record under `docs/plan/`.
5. For the optional Cloudflare scheduler, read
   `docs/CLOUDFLARE_SCHEDULER.md` before changing its Worker, command, secret,
   or rollout behavior.
6. Before changing Next.js behavior, read the relevant installed guide under
   `node_modules/next/dist/docs/`; do not rely on older framework knowledge.

## Choose the workflow

- For local setup or failures, run `pnpm local:doctor`, then use the documented
  `local:*` command. Do not replace the orchestration with ad hoc shell state.
- For normal feature work, use `pnpm dev`; it prepares PostgreSQL and starts
  Next.js with Turbopack.
- For schema work, change `src/db/schema.ts`, generate a new migration, inspect
  its SQL, migrate locally, and commit schema plus generated migration metadata.
- For an owner-approved hosted migration, require a reviewed branch and an
  exported `DATABASE_URL_DIRECT`, then use
  `pnpm db:migrate:remote -- --allow-hosted`. Never supply a URL as a command
  argument, print it, or substitute the command for migration/rollout review.
- For catalog or scanner work, keep the CardTrader call server-side and exercise
  the authenticated local cron helper while the app is running. Preserve the
  adaptive marketplace strategy: expansion fetches for five or more claimed
  blueprints in one expansion, individual fetches for smaller groups and manual
  single-watch scans, with no same-run fan-out after a bulk failure.
- For the Cloudflare five-minute scheduler, keep the Worker as a disabled-by-
  default, single-request clock only. It may hold the existing `CRON_SECRET` and
  canonical scan URL as encrypted Worker secrets, but never a CardTrader token,
  database URL, or marketplace logic. Run `pnpm cloudflare:scheduler:check`
  locally; never run deploy, secret, tail, or an enabled scheduled test without
  explicit authorization for that Cloudflare environment.
- For pricing work, preserve integer cents/basis points and add focused tests to
  the pure deal evaluator.
- For integration work, use `pnpm test:integration`; its fixtures must retain the
  non-loopback database guard and deterministic cleanup.
- Use `pnpm test:coverage` to audit pure, component, and route-boundary tests.
  Do not use its percentage as a substitute for database integration, browser,
  or hosted-smoke coverage.
- For deployment preparation, use `pnpm prod:check-env`, `pnpm ops:status`, and
  `pnpm smoke:hosted`. Do not add an authorized hosted flag or Telegram webhook
  mutation unless the operator explicitly authorizes that environment.
- For recovery work, use `pnpm db:backup` with an external directory and
  explicit read-only hosted opt-in, then use `pnpm db:restore:verify` only with
  loopback PostgreSQL. Never treat backup authorization as restore
  authorization.
- For route handlers and server actions, authenticate, authorize, and validate
  at the boundary. Scope user data by the current database user.

## Protect invariants

- Use Next.js 16 App Router, Turbopack, React 19, Tailwind 4, and TypeScript 6.
- Never introduce a webpack fallback or suppress/downgrade TypeScript errors.
- Never read, print, log, expose, or commit credential values. Use
  `CARD_TRADER_AUTH_TOKEN` only in the server-side Authorization header.
- Never commit the raw Postman collection; it contains an embedded credential.
- Never enable the development auth provider in production.
- Keep guest links as hashed, bounded-use capabilities. Their raw token belongs
  only in a URL fragment until server-side redemption; do not treat a browser
  request as a security boundary or add guest-capable REST mutations.
- Never run `local:reset` against a shared or hosted database.
- Never use integration or E2E fixtures against a shared or hosted database.
- Preserve the local lifecycle command's non-loopback database guard.
- Never persist full marketplace responses when normalized evidence suffices.
- Keep scanner leases, idempotent notifications, alert evidence snapshots, and
  two-miss expiry behavior intact unless the product decision changes.

## Verify proportionally

Run `pnpm check` for all code changes. Add `pnpm build`, targeted runtime checks,
and `pnpm test:e2e` for routing, auth, infrastructure, or UI changes. Use
`pnpm check:all` for tooling or broad changes. Report tests that could not run and
the exact external prerequisite; do not claim hosted verification from local
evidence.

Update human docs and this skill when commands, configuration, integrations,
architecture, or operational invariants change.

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
5. Before changing Next.js behavior, read the relevant installed guide under
   `node_modules/next/dist/docs/`; do not rely on older framework knowledge.

## Choose the workflow

- For local setup or failures, run `pnpm local:doctor`, then use the documented
  `local:*` command. Do not replace the orchestration with ad hoc shell state.
- For normal feature work, use `pnpm dev`; it prepares PostgreSQL and starts
  Next.js with Turbopack.
- For schema work, change `src/db/schema.ts`, generate a new migration, inspect
  its SQL, migrate locally, and commit schema plus generated migration metadata.
- For catalog or scanner work, keep the CardTrader call server-side and exercise
  the authenticated local cron helper while the app is running.
- For pricing work, preserve integer cents/basis points and add focused tests to
  the pure deal evaluator.
- For route handlers and server actions, authenticate, authorize, and validate
  at the boundary. Scope user data by the current database user.

## Protect invariants

- Use Next.js 16 App Router, Turbopack, React 19, Tailwind 4, and TypeScript 6.
- Never introduce a webpack fallback or suppress/downgrade TypeScript errors.
- Never read, print, log, expose, or commit credential values. Use
  `CARD_TRADER_AUTH_TOKEN` only in the server-side Authorization header.
- Never commit the raw Postman collection; it contains an embedded credential.
- Never enable the development auth provider in production.
- Never run `local:reset` against a shared or hosted database.
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

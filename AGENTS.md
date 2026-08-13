<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Riftwatch project instructions

Riftwatch is a Next.js 16 App Router application that monitors Riftbound card
listings through CardTrader. It uses React 19, TypeScript 6, Tailwind CSS 4,
Auth.js, Drizzle ORM, PostgreSQL 17, Vitest, and Playwright. Next.js runs with
Turbopack; do not add webpack configuration or downgrade TypeScript.

## Required project context

For any non-trivial repository task, use the project-local skill at
`skills/riftwatch-development/SKILL.md`. Read the referenced human documentation
that matches the task:

- `docs/DEVELOPMENT.md` for local commands, environment, tests, and debugging.
- `CONTRIBUTING.md` for architecture, security, migrations, and review standards.
- `docs/API.md` for route and integration contracts.
- `docs/plan/` for product, pricing, architecture, and operations decisions.

## Working commands

- `pnpm dev` owns the normal local workflow: prerequisites, PostgreSQL, migrate,
  seed, and Next.js.
- `pnpm dev:app` starts only Next.js and is intended for CI or controlled use.
- `pnpm local:doctor` diagnoses environment and service health.
- `pnpm check` is the minimum code-change verification.
- `pnpm check:all` adds production build and browser tests.
- `pnpm test:integration` uses disposable, local-only PostgreSQL fixtures.
- `pnpm prod:check-env`, `pnpm ops:status`, and `pnpm smoke:hosted` are the
  production-readiness interfaces; hosted mutations always require explicit
  operator flags.
- `pnpm cloudflare:scheduler:check` validates the isolated scheduler locally;
  its deploy, secret, and log commands are external operator actions only.
- `pnpm db:backup` creates a read-only logical dump only with explicit hosted
  opt-in; `pnpm db:restore:verify` restores only to disposable loopback
  PostgreSQL.
- `pnpm db:migrate:remote -- --allow-hosted` requires an exported non-loopback
  `DATABASE_URL_DIRECT`; it is an explicit hosted write and must never be run
  without environment-specific operator authorization.
- `pnpm local:reset` deletes local database data and requires explicit consent.

Use `rg`/`rg --files` for discovery. Use `apply_patch` for intentional edits.
Preserve unrelated work and generated Drizzle migrations.

## Security and data rules

- Do not read, print, log, expose, or commit secret values.
- Use `CARD_TRADER_AUTH_TOKEN` only through the existing server-side client.
- Do not inspect or commit `card_trader_postman_collection.json`; it is ignored
  because the downloaded collection contains a credential.
- Keep server-only integration code out of client components.
- Treat server actions and route handlers as public trust boundaries: authenticate,
  authorize, validate, and scope user-owned records.
- Keep production development-auth rejection, cron authentication, Telegram
  webhook verification, hashed one-time link tokens, and idempotent deliveries.
- Keep `cloudflare/market-scheduler` disabled unless an operator explicitly
  enables it with encrypted Worker secrets. It must never receive CardTrader or
  database credentials.
- Store prices as integer cents. Do not introduce floating-point persistence for
  money.

## Change-specific requirements

- Next.js: read the relevant installed Next.js guide before editing.
- Database: generate and inspect a new migration; never rewrite a shared applied
  migration or reset a hosted database.
- Preserve the local orchestrator's non-loopback database guard.
- Deal logic: update focused Vitest cases, including rejection paths and sparse
  market data.
- CardTrader: validate external data, respect request pacing, and never log
  authorization headers or unsafe raw error bodies.
- UI/auth/routes: run build and targeted browser/runtime checks in addition to
  `pnpm check`.
- Commands/env/docs: keep README, development docs, `.env.example`,
  `CONTRIBUTING.md`, AGENTS.md, and the project skill mutually consistent.
- Scheduler: update `docs/CLOUDFLARE_SCHEDULER.md` and the production rollout
  whenever its clock, secret boundary, or enablement path changes.
- Never run hosted smoke mutation flags, hosted migrations, webhook mutations,
  or paid-plan changes without explicit production authorization.

# Development and local environment

This guide covers a fresh checkout, daily development, environment variables,
database work, local integrations, testing, and troubleshooting.

## Contents

- [Local architecture](#local-architecture)
- [Prerequisites](#prerequisites)
- [First-time setup](#first-time-setup)
- [Daily workflow](#daily-workflow)
- [Command reference](#command-reference)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Catalog and market scanning](#catalog-and-market-scanning)
- [Telegram development](#telegram-development)
- [Database development](#database-development)
- [Testing and builds](#testing-and-builds)
- [Troubleshooting](#troubleshooting)

## Local architecture

| Component       | Local implementation                               | Lifecycle                                   |
| --------------- | -------------------------------------------------- | ------------------------------------------- |
| Web UI and APIs | Next.js 16 App Router at `localhost:3000`          | Started by `pnpm dev`                       |
| Bundler         | Turbopack                                          | Owned by Next.js; webpack is not configured |
| Styles          | Tailwind CSS 4 CLI output in `src/app/globals.css` | Compiled before dev/build                   |
| Database        | PostgreSQL 17 Alpine at `localhost:5432`           | Docker Compose service `postgres`           |
| ORM/migrations  | Drizzle ORM and SQL files in `drizzle/`            | Applied on setup and dev startup            |
| Authentication  | Auth.js; development credentials provider locally  | Runs in Next.js                             |
| Card data       | CardTrader API v2                                  | External; server-only token required        |
| Scheduling      | Manual local cron commands                         | Vercel Cron in production                   |
| Notifications   | Telegram Bot API and webhook                       | Optional external integration               |

`pnpm dev` starts or reuses PostgreSQL, waits for health, applies migrations,
seeds the configured administrator, and then starts Next.js. Stopping the dev
server does not stop PostgreSQL or delete its data.
When the development authentication provider is enabled, its startup banner
prints the configured login email, the sign-in URL, and that no password is
required. It never prints `AUTH_SECRET` or integration credentials.

## Prerequisites

- Node.js 24.x. The expected version is recorded in `.nvmrc` and `package.json`.
- Corepack and pnpm 10.30.3.
- Docker Engine or Docker Desktop with the `docker compose` plugin.
- Git.
- A CardTrader API token for catalog and price operations.
- Optional: Google OAuth credentials and a Telegram bot for integration work.
- Optional: Chrome/Chromium for Playwright browser tests.

On WSL, start Docker Desktop and enable integration for the active distribution.
Confirm the prerequisites with:

```sh
node --version
pnpm --version
docker --version
docker compose version
docker info
```

## First-time setup

From the repository root:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm local:setup
```

The setup command is idempotent. It:

1. Checks Node, pnpm, Docker, Compose, and Docker daemon access.
2. Copies `.env.example` to `.env.local` only when `.env.local` is absent.
3. Replaces the auth and cron placeholders with randomly generated local values.
4. Starts PostgreSQL and waits for its health check.
5. Applies all committed Drizzle migrations.
6. Creates or updates the configured administrator and default preferences.
7. Prints database and application health without printing secrets.

It never overwrites an existing `.env.local`, never copies the CardTrader token
from the environment into a file, and never resets an existing database volume.
Local lifecycle commands also reject a non-local `DATABASE_URL` to prevent an
accidental migrate, seed, or reset against a hosted database.

Add the CardTrader token to `.env.local`, or export it in the shell that launches
Riftwatch. Shell environment variables take precedence over `.env.local`. Keep
the variable server-only—never prefix it with `NEXT_PUBLIC_`.

Start the complete development stack:

```sh
pnpm dev
```

Then visit [http://localhost:3000](http://localhost:3000).

## Daily workflow

Normally only this is required:

```sh
pnpm dev
```

The database preparation steps are safe to repeat. In a second terminal, common
operations are:

```sh
pnpm local:status
pnpm cron:catalog
pnpm cron:scan
pnpm test:watch
```

Press Ctrl+C to stop Next.js. Stop PostgreSQL while retaining its volume with:

```sh
pnpm local:down
```

## Command reference

### Stack lifecycle

| Command                     | Behavior                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| `pnpm dev`                  | Full developer entry point: prerequisites, env, DB, migrations, seed, Next.js |
| `pnpm dev:app`              | Next.js only; intended for CI or when infrastructure is managed separately    |
| `pnpm local:setup`          | First-run/bootstrap operation without keeping Next.js running                 |
| `pnpm local:doctor`         | Validate prerequisites, env, Docker, DB, and HTTP health                      |
| `pnpm local:up`             | Start only PostgreSQL and wait until healthy                                  |
| `pnpm local:down`           | Stop and remove containers/network; preserve the named volume                 |
| `pnpm local:restart`        | Restart PostgreSQL without changing its data                                  |
| `pnpm local:status`         | Show Compose status, DB readiness, and `/api/health` status                   |
| `pnpm local:logs`           | Follow PostgreSQL logs; exit with Ctrl+C                                      |
| `pnpm local:reset`          | Delete the DB volume and rebuild; requires typing `reset`                     |
| `pnpm local:reset -- --yes` | Non-interactive destructive reset for disposable environments                 |

### Data and integrations

| Command             | Behavior                                               |
| ------------------- | ------------------------------------------------------ |
| `pnpm db:generate`  | Generate a migration from schema changes               |
| `pnpm db:migrate`   | Apply pending committed migrations                     |
| `pnpm db:seed`      | Idempotently seed/update the development administrator |
| `pnpm db:studio`    | Open Drizzle Studio                                    |
| `pnpm db:shell`     | Open `psql` inside the PostgreSQL container            |
| `pnpm cron:catalog` | Call the authenticated local catalog cron endpoint     |
| `pnpm cron:scan`    | Call the authenticated local market scanner endpoint   |

The cron helpers require a running Next.js server because they exercise the same
HTTP boundary used by Vercel. They read `CRON_SECRET` internally and never print
it. Catalog and scan commands also require `CARD_TRADER_AUTH_TOKEN`.

### Quality

| Command             | Behavior                                                 |
| ------------------- | -------------------------------------------------------- |
| `pnpm format`       | Apply Prettier formatting                                |
| `pnpm format:check` | Verify formatting without changing files                 |
| `pnpm lint`         | Run ESLint                                               |
| `pnpm typecheck`    | Run TypeScript 6 in strict no-emit mode                  |
| `pnpm test`         | Run Vitest once                                          |
| `pnpm test:watch`   | Run Vitest in watch mode                                 |
| `pnpm test:e2e`     | Run Playwright browser tests                             |
| `pnpm build`        | Compile Tailwind and create a Turbopack production build |
| `pnpm docs:check`   | Validate local Markdown links and documented commands    |
| `pnpm check`        | Formatting, lint, typecheck, and unit tests              |
| `pnpm check:all`    | `check` plus build and browser tests                     |

## Environment variables

Next.js loads `.env*` files from the repository root. Standalone Drizzle commands
use `@next/env`, so they follow the same files instead of requiring shell prefixes.
The relevant precedence is: existing process environment, environment-specific
local file, `.env.local`, environment-specific file, then `.env`.

Never commit `.env.local`. Values without a `NEXT_PUBLIC_` prefix remain on the
server. `NEXT_PUBLIC_` values are embedded into browser output at build time.

| Variable                   | Local requirement                             | Purpose                                                   |
| -------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`      | Required; defaults to `http://localhost:3000` | Canonical app URL and local cron target                   |
| `DATABASE_URL`             | Required                                      | Runtime pooled PostgreSQL connection                      |
| `DATABASE_URL_DIRECT`      | Recommended                                   | Direct connection for migration tooling                   |
| `AUTH_SECRET`              | Required, 16+ characters                      | Auth.js signing/encryption secret; generated by setup     |
| `AUTH_GOOGLE_ID`           | Optional locally                              | Google OAuth client ID                                    |
| `AUTH_GOOGLE_SECRET`       | Optional locally                              | Google OAuth client secret                                |
| `AUTH_ENABLE_DEV_PROVIDER` | `true` locally only                           | Enables email-based development sign-in                   |
| `ADMIN_EMAIL`              | Required for seed                             | Bootstrap administrator and development login             |
| `CARD_TRADER_AUTH_TOKEN`   | Required for catalog/scans                    | Server-only CardTrader bearer credential                  |
| `CRON_SECRET`              | Required, 16+ characters                      | Authenticates catalog and scan routes; generated by setup |
| `TELEGRAM_BOT_TOKEN`       | Optional                                      | Telegram Bot API credential                               |
| `TELEGRAM_BOT_USERNAME`    | Optional                                      | Bot username used in connection links                     |
| `TELEGRAM_WEBHOOK_SECRET`  | Optional                                      | Verifies Telegram webhook requests                        |
| `SCAN_BATCH_SIZE`          | Optional; default `50`                        | Maximum claimed blueprints per scanner run                |
| `MAX_ACTIVE_BLUEPRINTS`    | Optional; default `250`                       | Application-wide active blueprint capacity                |
| `DEFAULT_WATCH_QUOTA`      | Optional; default `50`                        | New/default per-user watch limit                          |

Do not set `NODE_ENV` in `.env.local`; Next.js selects it for dev, test, and build.
Production validation rejects `AUTH_ENABLE_DEV_PROVIDER=true`.
The build wrapper forces that one flag to `false`, so a local production build
cannot accidentally include the development sign-in provider.

## Authentication

Local setup defaults to the development provider. Open `/sign-in`, enter the
`ADMIN_EMAIL` value (initially `admin@riftwatch.com`), and choose Development sign
in. The address must already be the seeded admin or an invited user.

To exercise Google locally:

1. Configure a Google OAuth web application.
2. Add the Auth.js callback URL for localhost.
3. Set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
4. Keep or disable the dev provider according to the test you are performing.

Never enable the credentials-based development provider in production.

## Catalog and market scanning

Start Riftwatch in one terminal, then synchronize the catalog in another:

```sh
pnpm dev
pnpm cron:catalog
```

The catalog job synchronizes Riftbound game `22`, restricts blueprints to the
Riftbound Singles category `258`, and records a catalog run. It is safe to repeat.

After adding watches through the UI, run due scans with:

```sh
pnpm cron:scan
```

The scanner deduplicates watches by blueprint, uses PostgreSQL leases for overlap
safety, and starts CardTrader requests at no more than five per second. It stores
normalized metrics and hourly observations, not full raw marketplace responses.
Local scans are manual; `vercel.json` defines production schedules.

## Telegram development

Telegram is optional for normal UI work. To test it end to end:

1. Create a bot with BotFather.
2. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and a random
   `TELEGRAM_WEBHOOK_SECRET`.
3. Expose local port 3000 through a trusted HTTPS tunnel.
4. Register `<public-url>/api/telegram/webhook` with Telegram and provide the same
   webhook secret as Telegram's secret-token header.
5. Use Settings in Riftwatch to generate a one-time bot link.

Do not commit tunnel URLs or bot credentials. Linking tokens are hashed, expire
after ten minutes, and can be used once.

## Database development

The Drizzle schema is in `src/db/schema.ts`; generated SQL and snapshots are in
`drizzle/`. For a schema change:

1. Update `src/db/schema.ts`.
2. Run `pnpm db:generate`.
3. Review the generated SQL for locks, data loss, defaults, and backfills.
4. Run `pnpm db:migrate` against the local database.
5. Exercise the affected UI/API path and run the relevant tests.
6. Commit the schema, SQL migration, and Drizzle metadata together.

Do not modify a migration that may already have been applied by another
developer or environment; create a follow-up migration. Do not use destructive
reset commands against shared, preview, or production databases.

For disposable local data only:

```sh
pnpm local:reset
```

The reset command removes the named Compose volume, recreates PostgreSQL, applies
migrations, and seeds the administrator. It deliberately requires confirmation.

## Testing and builds

Run the fast pre-commit suite with `pnpm check`. Use `pnpm check:all` before a PR
that changes routing, authentication, infrastructure, build behavior, or major UI
flows.

Playwright downloads its own browser in CI. Locally, if the bundled browser is
unavailable, point it to an installed Chrome-compatible binary:

```sh
PLAYWRIGHT_CHROME_PATH=/usr/bin/google-chrome pnpm test:e2e
```

The Playwright server uses `pnpm dev:app` with isolated fallback values, so it
does not start or reset Docker. CI starts PostgreSQL, migrates, and seeds before
browser tests.

## Troubleshooting

### Docker daemon permission denied

Confirm Docker Desktop/Engine is running and that your user or WSL distribution
can access it. `docker info` must succeed before `pnpm dev` can prepare the stack.

### Port 5432 is already in use

Stop the other PostgreSQL instance or change both the Compose port mapping and
local database URLs. Do not change only one side.

### Port 3000 is already in use

Stop the existing Next.js process. If intentionally using another port, launch
`pnpm dev -- --port 3001` and update `NEXT_PUBLIC_APP_URL`; Next.js reads the
server port from the CLI or `PORT`, not from `.env.local`.

### Missing database or Auth.js environment errors

Run `pnpm local:doctor`. Confirm `.env.local` is in the repository root, not
inside `src/`, and rerun `pnpm local:setup` to prepare PostgreSQL.

### Catalog or scanner authentication failure

Confirm the app and helper command load the same `CRON_SECRET`. Run helpers from
the repository root. A CardTrader failure additionally requires a non-empty
server-only token.

### Catalog is empty

Start the app, run `pnpm cron:catalog`, and inspect the latest catalog run on the
admin page. CardTrader outages and schema changes are recorded as failed runs
without exposing the bearer token.

### Browser test cannot launch

Install the Playwright browser with `pnpm exec playwright install chromium`, or
set `PLAYWRIGHT_CHROME_PATH` to a compatible local browser.

### Complete diagnostics

Collect `pnpm local:doctor`, `docker compose logs postgres`, the failing command,
and a sanitized stack trace. Remove credentials, authorization headers, database
URLs containing passwords, Telegram chat IDs, and raw Postman content before
sharing diagnostics.

# Riftwatch

Riftwatch is an invite-only Riftbound price tracker. It synchronizes the
CardTrader catalog, evaluates comparable marketplace listings, records price
history, and creates in-app and Telegram alerts for unusually cheap listings.

The application is a single Next.js 16 repository. The frontend, server actions,
Auth.js handlers, cron endpoints, and Telegram webhook all run in the Next.js
process; PostgreSQL runs locally through Docker Compose.

## Quick start

Requirements: Node.js 24, pnpm 10.30.3, and Docker with Compose.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm local:setup
pnpm dev
```

`pnpm local:setup` creates `.env.local` when absent, generates safe local auth
and cron secrets, starts PostgreSQL, applies migrations, and seeds
`admin@riftwatch.com`. Add `CARD_TRADER_AUTH_TOKEN` to `.env.local` or export it in
your shell before synchronizing the catalog or scanning prices. Never commit or
print that token.

Open [http://localhost:3000](http://localhost:3000). In local development, sign
in with `admin@riftwatch.com` using the development provider.

`pnpm dev` prepares the database and starts the frontend and API server with
Turbopack. PostgreSQL remains running after the Next.js process stops. Use
`pnpm local:down` when you want to stop it.

## Common commands

| Command                  | Purpose                                                   |
| ------------------------ | --------------------------------------------------------- |
| `pnpm dev`               | Prepare PostgreSQL, migrate, seed, and start Next.js      |
| `pnpm local:doctor`      | Validate tools, Docker, environment, DB, and app health   |
| `pnpm local:status`      | Show container, PostgreSQL, and HTTP health               |
| `pnpm cron:catalog`      | Synchronize Riftbound expansions and blueprints           |
| `pnpm cron:scan`         | Scan all due watched blueprints                           |
| `pnpm test:integration`  | Exercise scanner persistence against local PostgreSQL     |
| `pnpm prod:check-env`    | Validate production configuration without printing values |
| `pnpm ops:status`        | Report local operational capacity and failures            |
| `pnpm db:security-audit` | Audit the configured runtime role, TLS, grants, and RLS   |
| `pnpm smoke:hosted`      | Run safe checks against an explicitly selected deployment |
| `pnpm market:calibrate`  | Sample aggregate CardTrader signal quality                |
| `pnpm db:shell`          | Open a local `psql` session                               |
| `pnpm docs:check`        | Validate documentation links and package commands         |
| `pnpm check`             | Run formatting, lint, types, and unit tests               |
| `pnpm check:all`         | Also run the production build and browser tests           |

Run `pnpm local:reset` only when you intend to delete the local PostgreSQL
volume. It requires interactive confirmation; automation must pass `--yes`.

## Documentation

- [Development and local environment](docs/DEVELOPMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Application and integration endpoints](docs/API.md)
- [Production rollout operator checklist](docs/PRODUCTION_ROLLOUT.md)
- [Security controls and operations](docs/SECURITY.md)
- [Vulnerability reporting policy](SECURITY.md)
- [Architecture and product decisions](docs/plan/README.md)
- [Project instructions for coding agents](AGENTS.md)
- [Reusable Riftwatch agent skill](skills/riftwatch-development/SKILL.md)

The downloaded Postman collection is intentionally ignored because it contains
an embedded credential. Replace its credential with a Postman variable before
sharing any sanitized copy.

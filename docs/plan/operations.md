# Operations

## Environments

- Local: Docker PostgreSQL and an optional development-only credentials provider.
- Preview: Vercel with isolated configuration and no production cron delivery.
- Production: Vercel in `fra1` and an EU Supabase project.

`AUTH_ENABLE_DEV_PROVIDER=true` is forbidden when `NODE_ENV=production`.

## Scheduling

Vercel Hobby invokes catalog and market cron routes daily for smoke testing.
For the friends-and-family MVP, an optional Cloudflare Workers Free bridge can
invoke the existing protected market route every five minutes without changing
the Vercel plan. It contains no CardTrader or database credential and defaults
to disabled. The database claims each unique blueprint only every five minutes;
empty invocations make no CardTrader request. Requests start at no more than
five per second, and five-minute database leases prevent overlaps.

Vercel Pro remains the simpler long-term option: it can replace the bridge with
a per-minute Vercel Cron trigger while retaining the same five-minute due-work
cadence. Do not enable both clocks in steady state. The bridge’s deployment,
secret, enable, rollback, and observation procedure is in
[Cloudflare five-minute scheduler](../CLOUDFLARE_SCHEDULER.md).

## Expected base cost

- Development: Vercel Hobby and Supabase Free, USD 0 before domain costs.
- Five-minute MVP bridge: Cloudflare Workers Free within its then-current free
  allowance; observe usage and do not add a paid plan.
- Five-minute Vercel option: one Vercel Pro seat, approximately USD 20/month.
- Production database upgrade: Supabase Pro adds approximately USD 25/month.

Administrators inspect recent runs and capacity in the application. Operators
use `pnpm ops:status -- --allow-hosted` for an aggregate report of stale scans,
failed runs, active unique blueprints, and notification failures. Capacity
defaults to 250 unique active blueprints.

For short scheduler observation windows, an administrator can enable a compact
Telegram completion heartbeat for their own linked account or any linked member
from the Users panel. It is off by default, is emitted only after protected cron
scans complete, and should be disabled after testing because the five-minute
clock makes it intentionally noisy.

The daily-to-five-minute promotion, hosted smoke sequence, and rollback gates are
defined in `docs/PRODUCTION_ROLLOUT.md`.

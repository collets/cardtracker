# Operations

## Environments

- Local: Docker PostgreSQL and an optional development-only credentials provider.
- Preview: Vercel with isolated configuration and no production cron delivery.
- Production: Vercel in `fra1` and an EU Supabase project.

`AUTH_ENABLE_DEV_PROVIDER=true` is forbidden when `NODE_ENV=production`.

## Scheduling

Vercel Hobby invokes catalog and market cron routes daily for smoke testing.
After upgrading to Pro, the market route runs every minute and claims up to 50
blueprints due every five minutes. Requests start at no more than five per second.
Database leases make retries and overlapping invocations safe.

## Expected base cost

- Development: Vercel Hobby and Supabase Free, USD 0 before domain costs.
- Five-minute MVP: one Vercel Pro seat, approximately USD 20/month.
- Production database upgrade: Supabase Pro adds approximately USD 25/month.

Administrators monitor stale scans, failed runs, active unique blueprints, and
notification failures in the application. Capacity defaults to 250 unique active
blueprints.

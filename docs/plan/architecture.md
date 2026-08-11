# Architecture

Riftwatch is a single Next.js repository deployed to Vercel. Route handlers and
server actions contain all trusted logic. The browser never calls CardTrader and
never receives the CardTrader token.

Supabase hosts production PostgreSQL; local development uses a plain PostgreSQL
container and the same Drizzle migrations. Auth.js provides Google OAuth and an
invite allowlist. PostgreSQL leases coordinate scan work without an external
queue. Telegram sends notifications through a verified webhook and bot API.

The scanner deduplicates active watches by CardTrader blueprint, fetches a
blueprint once, and evaluates the result against every interested user's filters.
Cron endpoints require `CRON_SECRET`; administrative operations additionally
require an authenticated administrator.

Secrets must never be logged. Raw marketplace payloads are processed in memory,
and external error bodies are reduced to status and a safe message.

Production database access separates the migration owner from a non-privileged
`riftwatch_app` login inheriting `riftwatch_runtime`. Every application table
forces RLS; Supabase API roles have no grants and the Data API remains disabled.
Auth.js sessions expire after 24 hours, privileged actions are append-only
audited, and HTML uses a request nonce with a strict CSP. The complete control
inventory is in [Security](../SECURITY.md).

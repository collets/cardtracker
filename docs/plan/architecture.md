# Architecture

Riftwatch is a single Next.js repository deployed to Vercel. Route handlers and
server actions contain all trusted logic. The browser never calls CardTrader and
never receives the CardTrader token.

Supabase hosts production PostgreSQL; local development uses a plain PostgreSQL
container and the same Drizzle migrations. Auth.js provides Google OAuth and an
invite allowlist. PostgreSQL leases coordinate scan work without an external
queue. Telegram sends notifications through a verified webhook and bot API.

The scanner deduplicates active watches by CardTrader blueprint and evaluates
each result against every interested user's filters. Multi-blueprint scans,
including scheduled, administrative, and user watchlist refreshes, group
blueprints by expansion: groups of five or more use one expansion marketplace
request, while smaller groups and explicit single-watch scans use individual
blueprint requests. Cron endpoints require `CRON_SECRET`; administrative
operations additionally require an authenticated administrator.

Secrets must never be logged. Raw marketplace payloads are processed in memory,
and external error bodies are reduced to status and a safe message.

# Architecture

Riftwatch is a single Next.js repository deployed to Vercel. Route handlers and
server actions contain all trusted logic. The browser never calls CardTrader and
never receives the CardTrader token.

Supabase hosts production PostgreSQL; local development uses a plain PostgreSQL
container and the same Drizzle migrations. Auth.js provides Google OAuth and an
invite allowlist, plus a Credentials provider that redeems limited-use guest
links. PostgreSQL leases coordinate scan work without an external queue.
Telegram sends notifications through a verified webhook and bot API.

The scanner deduplicates active watches by CardTrader blueprint and evaluates
each result against every interested user's filters. Multi-blueprint scans,
including scheduled, administrative, and user watchlist refreshes, group
blueprints by expansion: groups of five or more use one expansion marketplace
request, while smaller groups and explicit single-watch scans use individual
blueprint requests. Cron endpoints require `CRON_SECRET`; administrative
operations additionally require an authenticated administrator.

Guest links are opaque 32-byte bearer capabilities stored only as SHA-256
hashes. The raw capability remains in a URL fragment until it is POSTed to the
Auth.js credentials callback, avoiding normal request-path and referrer logs.
Redemption uses one conditional database update to enforce the configured use
limit under concurrency, then creates a distinct guest user with a two-watch
quota and one-hour absolute access expiry. Every authenticated page rechecks
that expiry in PostgreSQL; expired guest watches are excluded from scheduling
and deactivated during scanner runs.

Secrets must never be logged. Raw marketplace payloads are processed in memory,
and external error bodies are reduced to status and a safe message.

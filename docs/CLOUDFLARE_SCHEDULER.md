# Cloudflare five-minute scheduler

This optional, no-cost MVP bridge supplies a precise five-minute clock while
Riftwatch remains hosted on Vercel Hobby. It is deliberately a tiny Worker, not
a second application or a marketplace integration.

```text
Cloudflare Cron Trigger (every 5 minutes)
  -> authenticated GET /api/cron/scan on Riftwatch
  -> PostgreSQL leases claim due blueprints
  -> Riftwatch paces and calls CardTrader only for claimed work
```

The Worker never receives the CardTrader credential or database connection
string. It stores only the existing `CRON_SECRET` and the canonical scan URL as
encrypted Cloudflare Worker secrets. The Next.js route remains the sole place
that can call CardTrader.

## Boundaries

- This directory is deployment source only; it is not included in `pnpm dev`,
  the Next.js build, or browser tests.
- `vercel.json` stays on its daily Hobby-compatible market schedule. Do not
  change it while this bridge is active.
- The Worker is disabled unless its `SCHEDULER_ENABLED` secret is exactly
  `true`. A disabled scheduled trigger makes no network request.
- The Worker sends one authenticated request per trigger and does not retry
  configuration/authentication failures. PostgreSQL leases make overlapping
  successful requests safe.
- The Worker records no secret values, request headers, CardTrader data, or
  response body. Its only error detail is an HTTP status code.

Cloudflare Workers Free currently permits five Cron Triggers and 100,000 Worker
requests per day. A five-minute schedule is 288 requests/day. Verify the
current plan and usage in the Cloudflare dashboard before enabling it; do not
add a paid plan or payment method for this MVP bridge.

## Repository commands

These commands use an isolated Wrangler 4 CLI download. It is intentionally not
a Riftwatch runtime dependency: the deployed Worker has no package dependency
and the Next.js application never imports it.

| Command                                      | Effect                                                                           |
| -------------------------------------------- | -------------------------------------------------------------------------------- |
| `pnpm cloudflare:scheduler:dev`              | Start a local Worker with a test-only scheduled endpoint.                        |
| `pnpm cloudflare:scheduler:dry-run`          | Validate the Worker configuration without deployment.                            |
| `pnpm cloudflare:scheduler:deploy`           | Deploy or update the Worker and its trigger. External mutation; operator only.   |
| `pnpm cloudflare:scheduler:secret -- <NAME>` | Interactively set one encrypted Worker secret. External mutation; operator only. |
| `pnpm cloudflare:scheduler:tail`             | Stream Worker logs; never paste secrets into the terminal.                       |

The first command may download Wrangler. Do not run deploy, secret, or tail
commands from an agent session unless the operator explicitly authorizes the
specific Cloudflare environment.

## Local validation

This validates the disabled guard and scheduled-handler wiring without calling
Vercel, CardTrader, or a hosted database:

```sh
cp cloudflare/market-scheduler/.dev.vars.example \
  cloudflare/market-scheduler/.dev.vars
pnpm cloudflare:scheduler:dev
```

In a second terminal, invoke the local scheduled endpoint shown by Wrangler:

```sh
curl "http://localhost:8787/__scheduled?cron=*/5+*+*+*+*"
```

Keep `SCHEDULER_ENABLED=false`. Stop the process and remove the local
`.dev.vars` file when finished. It is ignored by Git.

## Manual deployment path

Perform these steps only after the application commit containing the scanner
lease safeguards has been reviewed and deployed to the intended production
host. They are external production operations and are intentionally not
automated by CI.

1. Create or select a Cloudflare account on the Workers Free plan. Confirm it
   has no paid Workers plan, payment commitment, route, or custom domain needed
   for this bridge.
2. Authenticate Wrangler interactively when prompted, then run:

   ```sh
   pnpm cloudflare:scheduler:dry-run
   pnpm cloudflare:scheduler:deploy
   ```

   The first deployment creates a disabled Worker named
   `riftwatch-market-scheduler` with a `*/5 * * * *` UTC trigger. It has no
   public `workers.dev` endpoint.

3. Set the three encrypted Worker secrets interactively. Enter values only at
   the prompt; never put them on the command line, in shell history, source,
   or a checked-in file.

   ```sh
   pnpm cloudflare:scheduler:secret -- RIFTWATCH_SCAN_URL
   pnpm cloudflare:scheduler:secret -- CRON_SECRET
   pnpm cloudflare:scheduler:secret -- SCHEDULER_ENABLED
   ```

   Use the canonical production URL ending exactly in `/api/cron/scan`, the
   matching production `CRON_SECRET`, and initially `false` for
   `SCHEDULER_ENABLED`.

4. Confirm the Worker is visible in Cloudflare, the Cron Trigger is every five
   minutes in UTC, and it is disabled by the secret. Check Vercel logs for at
   least one five-minute interval: there must be no `/api/cron/scan` request
   from the Worker while disabled.
5. Confirm the existing safe hosted boundary smoke remains healthy. Do **not**
   use `--run-scan` merely as a reachability test.

   ```sh
   pnpm smoke:hosted -- --url https://your-production-host
   ```

6. Enable only when ready to begin the limited friends-and-family observation:

   ```sh
   pnpm cloudflare:scheduler:secret -- SCHEDULER_ENABLED
   ```

   Enter `true` at the prompt. Setting a Worker secret creates a new Worker
   version, so the next scheduled tick can call the production scan route.

7. Observe the first hour in both Cloudflare and Vercel. Confirm a request about
   every five minutes, no 401 responses, no overlapping duplicate claims, and
   no CardTrader pacing or function-duration errors. Then complete the first
   day and first week checks in the production rollout.

## Disable and rollback

To immediately stop the bridge without changing application code, set
`SCHEDULER_ENABLED` to `false` using the interactive secret command. The Cron
Trigger can remain registered; disabled invocations perform no network work.

If the scheduler itself must be removed, delete or disable the Cron Trigger in
the Cloudflare Worker dashboard, then record the action in the incident log.
Do not reintroduce minute-level Vercel cron until the explicit Pro-plan rollout
is approved. The daily Vercel scan remains a separate, existing schedule.

## Upgrade path

When Vercel Pro is explicitly approved, disable the Cloudflare bridge first,
observe that no further Worker requests arrive, then replace only the market
cron entry in `vercel.json` with `* * * * *` and follow the Vercel promotion
checks in [Production rollout](PRODUCTION_ROLLOUT.md). Do not run both clocks
as a steady-state configuration.

## Authoritative references

- [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
- [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [Cloudflare Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)

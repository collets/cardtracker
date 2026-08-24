# Implementation checklist

## Foundation

- [x] Next.js, TypeScript, pnpm, Tailwind, lint, test, and formatting setup.
- [x] Local PostgreSQL Compose definition and Drizzle setup.
- [x] Product, architecture, data, operations, and implementation documents.
- [x] CI and Vercel environment configuration.

## Vertical slice

- [x] Invite-only Google authentication and administration.
- [x] Riftbound catalog synchronization and search.
- [x] Watch creation, manual scan, deal evaluation, and dashboard metric.

## Full MVP

- [x] Scheduled scanning, leases, history, pruning, and alert lifecycle.
- [x] Telegram linking and idempotent delivery.
- [x] Admin health and capacity controls.
- [x] Authenticated browser coverage and scanner/database integration tests.
- [x] Consistent mutation feedback, persistent catalog selection, and atomic
      bulk watch creation.
- [x] Production diagnostics, hosted smoke tooling, and operator runbook.
- [x] Bounded marketplace calibration workflow with aggregate-only reporting.
- [x] Hosted production smoke test on the daily validation schedule.
- [x] Atomic Telegram link-token consumption with concurrent replay coverage.
- [x] Structured one-tap alert outcomes, administrator aggregates, and a
      mobile-layout browser audit across all application pages.
- [x] Alert Inbox/History, reversible event archiving, and material-improvement
      re-alert suppression with local browser and PostgreSQL coverage.
- [x] Guarded no-cost logical backup and disposable local restore tooling; the
      first operator backup remains a production rollout gate.
- [x] Five-minute scanner cadence, overlap-safe leases, and an optional
      disabled Cloudflare Workers Free scheduler bridge with local validation.
- [x] One-time price-aware threshold recommendations using existing scan data,
      with in-app review, Telegram delivery, ownership checks, guest exclusion,
      and optimistic apply/dismiss handling.
- [x] Opt-in scheduled-scan Telegram diagnostics for administrators and selected
      linked members, including zero-work runs and per-user admin controls.
- [ ] Hosted five-minute scheduler enablement and observation, deliberately
      deferred until the owner completes the operator runbook.

The remaining item requires project-owner access to Cloudflare and explicit
production authorization. A later Vercel-native scheduler additionally requires
paid-plan approval. Follow `docs/CLOUDFLARE_SCHEDULER.md` and
`docs/PRODUCTION_ROLLOUT.md`; do not infer hosted completion from local checks.

Ideas that are deliberately outside this checklist, together with the parked
security branch, are recorded in [Future improvements](future-improvements.md).

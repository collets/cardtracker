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
- [x] Guarded no-cost logical backup and disposable local restore tooling; the
      first operator backup remains a production rollout gate.
- [ ] Five-minute production rollout, deliberately deferred during the
      friends-and-family product-validation phase.

The remaining item requires a product decision, explicit paid-plan approval,
and project-owner access to Vercel. Follow `docs/PRODUCTION_ROLLOUT.md`; do not
infer hosted completion from local checks.

Ideas that are deliberately outside this checklist, together with the parked
security branch, are recorded in [Future improvements](future-improvements.md).

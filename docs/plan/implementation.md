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
- [ ] Hosted smoke test and five-minute production rollout.

The remaining item requires project-owner access to Supabase, Vercel, Google,
and Telegram. Follow `docs/PRODUCTION_ROLLOUT.md`; do not infer hosted completion
from local checks.

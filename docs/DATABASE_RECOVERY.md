# Database backup and restore verification

Riftwatch uses a manual logical-backup workflow while production remains on the
Supabase Free plan. The workflow is free, does not change the hosted database,
and verifies every archive by restoring it into a disposable local PostgreSQL
database.

This is an operator procedure. It does not authorize a hosted restore, project
replacement, paid-plan change, or any other production mutation.

## Prerequisites

- PostgreSQL 17 client tools (`pg_dump` and `pg_restore`) on the operator
  workstation.
- A local PostgreSQL server for restore verification. `pnpm local:up` provides
  the expected PostgreSQL 17 instance.
- `DATABASE_URL` or `DATABASE_URL_DIRECT` for the source database. For Supabase
  on an IPv4-only network, use the session-mode pooler on port 5432.
- An external directory that is not inside the repository. Prefer an encrypted
  disk or encrypted cloud-synchronized directory with access limited to the
  operator.

The commands never print database credentials. Backup files contain user and
application data, so treat the archive as confidential even though file
permissions are restricted to the current user.

## Create a production backup

Load the production connection string into the current shell without printing
it, then run:

```sh
pnpm db:backup -- --output "$HOME/secure-backups/riftwatch" --allow-hosted
```

The hosted opt-in is required even though `pg_dump` is read-only. The command:

1. Prefers `DATABASE_URL_DIRECT`, then falls back to `DATABASE_URL`.
2. Verifies that `pg_dump` is new enough for the source PostgreSQL server.
3. Uses encrypted transport for hosted connections.
4. Dumps the `public` application schema and Drizzle migration history in a
   compressed custom-format archive.
5. Writes through a partial file and renames it only after `pg_dump` succeeds.
6. Creates a matching manifest containing the archive size and SHA-256 digest.

The result is a pair such as:

```text
riftwatch-2026-08-12T14-30-00-000Z.dump
riftwatch-2026-08-12T14-30-00-000Z.manifest.json
```

Keep both files together. Copy them to a second encrypted location so a lost
workstation or Supabase project does not remove the only recovery copy.

## Verify a local restore

Start local PostgreSQL and ensure the command sees a loopback connection. If the
shell exports the production `DATABASE_URL`, provide the local target through
the dedicated variable:

```sh
pnpm local:up
DATABASE_URL_RECOVERY='postgresql://riftwatch:riftwatch@127.0.0.1:5432/riftwatch' \
  pnpm db:restore:verify -- --file "$HOME/secure-backups/riftwatch/<archive>.dump"
```

Restore verification refuses every non-loopback database. It validates the
manifest checksum, creates a randomly named `riftwatch_restore_verify_*` local
database, restores the archive, queries the core application tables and Drizzle
migration history, and removes the disposable database in a `finally` cleanup.
It does not alter the normal local `riftwatch` database.

If the process is interrupted before cleanup, inspect local databases and remove
only the exact generated `riftwatch_restore_verify_*` database after confirming
that no verification process is still running.

## Suggested schedule and evidence

During friends-and-family validation:

- create a backup before every production migration and at least weekly;
- run restore verification for every newly created archive;
- retain at least four verified weekly pairs in two encrypted locations;
- record the archive timestamp, verification date, and operator in the private
  rollout notes without recording connection strings or credentials.

Revisit managed daily backups before the data becomes difficult to recreate or
the acceptable recovery point drops below one week. Supabase recommends regular
CLI logical exports for Free projects; paid plans add managed retention, but a
plan change still requires explicit approval.

## Actual recovery incident

Do not restore this archive directly over production. For a real incident:

1. Stop or isolate application writes.
2. Preserve the affected database and current logs.
3. Create a separate recovery project or PostgreSQL database.
4. Restore and validate there first.
5. Compare migration history, row counts, authentication, and critical user
   flows.
6. Decide the cutover and rollback procedure explicitly.

Follow the incident section of [Production rollout](PRODUCTION_ROLLOUT.md) and
the current Supabase backup/restore guidance before performing any hosted
mutation.

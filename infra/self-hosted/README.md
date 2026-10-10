# Full self-hosted rehearsal

This environment runs the official Supabase Docker stack and the production Admin image entirely
on localhost. It is the final local gate before provisioning a VPS; it is separate from the faster
Supabase CLI development stack.

## Boundaries

- Supabase is pinned to `self-hosted/v0.8.2` at commit `564eab8ad7840b13324f68b1bfac074ef8d51c21`.
- The runtime checkout, generated secrets, data volumes, and backup drill artifacts are Git ignored.
- API gateway `58000`, direct Postgres `55433`, pooler `55432`/`56543`, and Admin `3200` bind to
  `127.0.0.1` only.
- Admin receives a publishable key. The secret/service-role keys stay in the ignored server runtime.
- This is a rehearsal environment, not an Internet-facing production deployment.

## Commands

```powershell
pnpm selfhost:prepare
pnpm selfhost:up
pnpm selfhost:db:test
pnpm selfhost:check
pnpm selfhost:persistence
pnpm selfhost:backup-restore
pnpm selfhost:storage:backup-restore
pnpm selfhost:load-test
```

Open Admin at `http://127.0.0.1:3200/login`. Studio and other internal services remain local.

`selfhost:persistence` restarts the stack without deleting volumes and compares a database
fingerprint. `selfhost:backup-restore` restores a PostgreSQL dump into a temporary database and
compares the same fingerprint. `selfhost:storage:backup-restore` uploads a temporary object through
the Storage API, copies and restores the file tree into an isolated directory, verifies SHA-256,
and removes all fixtures. A production restore must restore a coordinated database and Storage
snapshot from the same recovery point because database backups contain object metadata, not files.

Stop the rehearsal without deleting data:

```powershell
pnpm selfhost:down
```

Do not add `-v`, run the upstream reset script, or delete `runtime/docker/volumes` unless the data
is intentionally disposable and a verified backup exists.

`selfhost:load-test` sends concurrent read-only requests to the Admin login page and the public
catalog REST endpoint for 15 seconds each. Defaults are 20 concurrent workers, zero tolerated HTTP
failures, and a local p95 ceiling of 1,000 ms. Override the duration, concurrency, or p95 gate with
`SELFHOST_LOAD_DURATION_SECONDS`, `SELFHOST_LOAD_CONCURRENCY`, and
`SELFHOST_LOAD_MAXIMUM_P95_MS`.

## Measured local baseline

With the official base stack (Logs/Analytics disabled) plus Admin idle after the full test suite,
the containers used about 1.3 GiB RAM. This is only an idle development measurement; production
needs memory for traffic bursts, backups, upgrades, the OS, reverse proxy, and monitoring. Follow
the 8 GB minimum operational target and use 16 GB for the pilot until load testing proves a smaller
configuration is safe.

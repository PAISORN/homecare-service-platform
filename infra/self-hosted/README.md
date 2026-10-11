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
pnpm selfhost:write-flow
pnpm selfhost:cross-role
pnpm selfhost:ui:e2e
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

`selfhost:write-flow` creates two temporary local identities and verifies Auth, the profile trigger,
customer RLS, configurable catalog reads, request drafts, private Storage ownership, cross-account
denial, and idempotent technician application bootstrap. It removes its objects, business rows,
and identities in `finally`, then requires the relevant database fingerprint to exactly match the
value from before the test.

`selfhost:cross-role` runs the complete customer, technician, and administrator lifecycle through
Auth, Data, and Storage APIs: matching, sealed quotation, technician selection, agreement,
appointment, job travel, start/completion PINs, work evidence, acceptance, review, complaint,
administrator escalation/resolution, moderation, and notifications. It then removes every fixture
and requires the database fingerprint to return exactly to its starting value.

`selfhost:ui:e2e` starts the local self-hosted stack plus Mobile Web on port 8082, prepares one
temporary completed cross-role job, and uses Playwright Chromium to verify the customer, technician,
and administrator rendered flows. Screenshots and failure traces stay under ignored `test-results/`;
the temporary Auth, Database, and Storage fixtures are removed after the suite.

## Measured local baseline

With the official base stack (Logs/Analytics disabled) plus Admin idle after the full test suite,
the containers used about 1.3 GiB RAM. This is only an idle development measurement; production
needs memory for traffic bursts, backups, upgrades, the OS, reverse proxy, and monitoring. Follow
the 8 GB minimum operational target and use 16 GB for the pilot until load testing proves a smaller
configuration is safe.

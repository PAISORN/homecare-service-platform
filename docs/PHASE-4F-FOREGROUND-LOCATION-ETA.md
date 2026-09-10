# Phase 4F — Foreground Location and ETA

## Outcome

Phase 4F lets a customer pin a service location and see an estimated arrival time while the assigned technician is traveling. The technician must explicitly start sharing from the job-detail screen.

## Privacy boundary

- HomeCare requests foreground location permission only.
- Sharing runs only while the technician keeps the job-detail screen open and the app is active.
- The database stores one current snapshot per job, not a route or location history.
- The snapshot is deleted when the technician stops sharing, leaves the sharing screen, marks the job as arrived, or the job otherwise leaves `technician_en_route`.
- A snapshot older than the configured threshold is reported as inactive.
- Exact coordinates do not enter audit metadata.

## Durable contract

- `service_locations.latitude` and `service_locations.longitude` hold an optional customer pin.
- `appointments` keeps the pin snapshot used when the job is created, preserving the confirmed appointment contract.
- `job_travel_locations` holds the technician's latest foreground location only.
- Participant-only RPCs publish, stop, and read travel progress. Authenticated clients have no direct table access.
- ETA uses straight-line distance and the configurable value in `private.job_travel_configuration`. It is an estimate, not turn-by-turn routing.

## Known limitations

- Jobs created before their service location had a pin cannot show ETA because the appointment snapshot is intentionally immutable.
- No map or routing provider is integrated yet. Phase 4F displays distance, freshness, and approximate ETA as text.
- No background location tracking is enabled.
- Native iOS Development Build and physical-device push verification remain deferred until an Apple Developer Program membership is available. Web, database, and static native configuration can still be validated without that paid membership.

## Verification

- Reset the local database and run all pgTAP/RLS tests.
- Generate database types from the reset schema.
- Run repository lint, typecheck, tests, formatting checks, build, database lint, and native Expo configuration validation.
- On a supported local client, test permission denial, location services disabled, foreground sharing, app backgrounding, explicit stop, and arrival cleanup.

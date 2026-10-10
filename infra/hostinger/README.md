# HomeCare environment: Local to Hostinger VPS

## Architecture

```text
Mobile app ───────────────┐
                          ├─ HTTPS api.<domain> ─ Caddy ─ Supabase API gateway
Admin browser ─ HTTPS ────┘
                admin.<domain> ─ Caddy ─ Admin Web (127.0.0.1:3000)

Private only: PostgreSQL, Studio, Storage internals, Realtime internals
```

Local testing has two levels: the Supabase CLI stack for fast development, and the official
self-hosted Docker stack for the final VPS rehearsal. Both use the same standalone Admin Web image
and bind only to localhost.

## Local production-like test

Requirements: Docker Desktop, Node 24.19, pnpm 11, and Local Supabase running.

```powershell
pnpm db:start
pnpm env:local-vps:up
pnpm env:local-vps:check
```

Open `http://127.0.0.1:3100`. The generated `infra/local-vps/.env.local` contains only a local URL
and a public client key and is Git ignored. Stop only the Admin container with:

```powershell
pnpm env:local-vps:down
```

Before provisioning a VPS, run the full stack gate documented in
[`../self-hosted/README.md`](../self-hosted/README.md). It exercises the pinned official release,
all migrations, 605 pgTAP assertions, database lint, persistence, and separate Database/Storage
restore drills.

## Hostinger target

1. Choose Ubuntu 24.04 with Docker. The local base stack plus Admin measured about 1.3 GiB while
   idle, but this excludes OS, reverse proxy, monitoring, backup spikes, traffic, and upgrade
   headroom. Use at least 8 GB RAM for infrastructure testing; use 16 GB for the pilot until load
   testing proves a smaller configuration safe.
2. Add SSH keys. Disable password login after verifying key access. In the Hostinger managed
   firewall expose `80/tcp` and `443/tcp`; restrict `22/tcp` to approved source IPs. Do not expose
   `5432`, `3000`, `8000`, Studio, or Docker daemon ports publicly.
3. Install the official Supabase self-hosted **base** Docker stack. Generate fresh secrets and API
   keys; never deploy `.env.example` placeholder values. Keep Logs/Analytics disabled initially to
   reduce memory use. Do not enable the Supabase Caddy override because this topology uses one
   host-level Caddy instance for both public domains.
4. Bind the Supabase API gateway to `127.0.0.1:8000`. Configure its public URL as
   `https://api.<domain>` and site URL as `https://admin.<domain>`.
5. Copy `.env.production.example` to `.env.production` on the VPS, set the real domains and the
   self-hosted **publishable** key, then run:

   ```bash
   docker compose --env-file infra/hostinger/.env.production \
     -f infra/hostinger/compose.admin.yaml up --build -d
   ```

6. Install Caddy on the host, copy `Caddyfile.example`, and provide `TLS_EMAIL`, `ADMIN_DOMAIN`,
   and `SUPABASE_DOMAIN`. Caddy proxies the two public HTTPS domains to localhost-only services and
   supports Realtime WebSockets.
7. Apply reviewed `supabase/migrations/` using a database URL available only on the VPS. Run pgTAP,
   RLS, Auth, Storage, Admin login, Realtime, and notification smoke tests before switching mobile
   builds to the new API domain.

## Backup and operations gates

- Schedule encrypted daily PostgreSQL logical backups and independent Storage object backups.
- Copy backups to a different provider or location; a VPS snapshot alone is not sufficient.
- Keep Hostinger weekly backups/snapshots enabled and perform an isolated restore drill.
- Monitor disk, RAM, swap, database connections, container health, TLS expiry, HTTP 5xx, Auth
  failures, notification queues, and backup age.
- Patch the OS and review upstream Supabase image changes on a staging VPS before production.
- Keep the managed Supabase staging project until migration rollback has been proven.

Self-hosting is an operational change, not only a hosting change. Do not open the pilot merely
because the containers start successfully.

## Authoritative setup references

- [Supabase self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker)
- [Supabase reverse proxy and HTTPS](https://supabase.com/docs/guides/self-hosting/self-hosted-proxy-https)
- [Hostinger Docker Manager deployment](https://www.hostinger.com/support/12040815-how-to-deploy-your-first-container-with-hostinger-docker-manager/)
- [Hostinger VPS firewall](https://www.hostinger.com/support/4805502-how-to-set-up-a-firewall-at-vps/)

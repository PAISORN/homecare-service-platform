---
status: accepted
---

# Validate locally before moving HomeCare to a Hostinger VPS

HomeCare will validate locally before any VPS purchase or deployment. The Supabase CLI stack
remains the fast development environment. A separate full rehearsal runs a pinned official
Supabase self-hosted Docker release plus the same standalone Admin image intended for the VPS.
The Admin container receives only the public URL, a server-only internal URL, and the publishable
key; service-role credentials are not part of the image or its environment.

The VPS target is Ubuntu with Docker on Hostinger. Supabase will use the official self-hosted base
Docker stack with Logs/Analytics disabled initially, Admin Web will use the same standalone image
validated locally, and one Caddy instance will terminate HTTPS for separate Admin and Supabase API
subdomains. PostgreSQL, Studio, Storage internals, and the Admin container port remain bound to
localhost or a private Docker network. Only SSH from approved source addresses and HTTPS ports 80
and 443 are exposed by the VPS firewall.

The Expo mobile app is not hosted as a web container on the VPS. Native builds point their public
Supabase configuration to the HTTPS API subdomain. Database schema changes remain migration-only,
and production deployment applies reviewed migrations before application rollout.

## Consequences

- Local Supabase CLI is development infrastructure only and must never be exposed to an untrusted
  network.
- The full self-hosted rehearsal also binds to localhost only; passing it proves portability and
  recovery mechanics, not Internet hardening or production readiness.
- Self-hosting transfers database, Auth, Storage, TLS, monitoring, upgrades, backups, and incident
  recovery responsibility to HomeCare operations.
- Database backup and Storage object backup are separate jobs and both must be copied off the VPS.
- Database and Storage restores must use coordinated recovery points because PostgreSQL contains
  Storage metadata while the object bytes live in a separate backend.
- The VPS must have enough headroom for Supabase plus Admin Web. An 8 GB machine is the minimum
  practical test target; a 16 GB machine is the pilot recommendation.
- The managed Supabase staging project remains independent until a documented migration and
  rollback drill proves the self-hosted target.

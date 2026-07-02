# Docker Compose

The recommended single-host install. `compose.yaml` runs seven services: the four app
components (`api`, `worker`, `runner`, `web`), a one-shot `migrate`, and bundled
`postgres` (pgvector) + `redis`. Only the `web` edge (Caddy) publishes ports.

## Install

```bash
git clone https://github.com/tessio-ai/tessio.git tessio && cd tessio
cp .env.production.example .env
# set SESSION_SECRET, TESSIO_SECRET_KEY, and optionally TESSIO_ADMIN_EMAIL/PASSWORD
docker compose up -d
```

Images are pulled from `ghcr.io/tessio-ai/tessio-*`. Pin a version with
`TESSIO_VERSION=X.Y.Z` in `.env` (default `latest`).

## What happens on start

1. `postgres` and `redis` come up and pass health checks.
2. `migrate` runs the database migrations, then seeds the first admin + default schemas
   **if** `TESSIO_ADMIN_EMAIL` and `TESSIO_ADMIN_PASSWORD` are set. It runs to completion
   before the app starts.
3. `api` and `worker` start once `migrate` finishes. `web` comes up after `api` passes
   its health check, then serves the UI and proxies `/api` to `api`.

Open **http://localhost** (or your `TESSIO_SITE_ADDRESS`).

## Using a managed Postgres / Redis

Point `DATABASE_URL` / `REDIS_URL` at your managed services in `.env` and remove the
`postgres` / `redis` services from `compose.yaml`. The Postgres must have the `pgvector`
extension available.

## Operations

- [Configuration reference](../configuration.md)
- [TLS / HTTPS](../operations/tls.md)
- [Upgrading](../operations/upgrading.md)
- [Backup & restore](../operations/backup-restore.md)
- [Troubleshooting](../operations/troubleshooting.md)

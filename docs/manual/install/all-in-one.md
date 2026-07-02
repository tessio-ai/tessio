# Single container (all-in-one)

The all-in-one image (`ghcr.io/tessio-ai/tessio-aio`) runs the whole app tier —
`api`, `worker`, `runner`, the `web` (Caddy) edge, and start-up migrations — in **one
container**, supervised by s6-overlay. The image itself holds no database: it connects
to a PostgreSQL (with `pgvector`) and Redis that you provide. The easiest way is
`compose.aio.yaml`, which bundles a Postgres + Redis alongside the app container; to run
the image standalone (e.g. on a PaaS), point it at managed datastores instead.

## Install (with the bundled datastores)

```bash
git clone https://github.com/tessio-ai/tessio.git tessio && cd tessio
cp .env.aio.example .env
# set SESSION_SECRET, TESSIO_SECRET_KEY, and optionally TESSIO_ADMIN_EMAIL/PASSWORD
docker compose -f compose.aio.yaml up -d
```

Open **http://localhost**. The container runs migrations on start (and seeds the admin if
configured), then starts the app processes.

## Run as a single container on a PaaS

The image is ideal for platforms that run one container (Fly.io, Railway, Render) with a
managed Postgres + Redis. Provide these environment variables:

```
DATABASE_URL=postgres://user:pass@host:5432/db   # Postgres must have pgvector
REDIS_URL=redis://host:6379
SESSION_SECRET=...            # openssl rand -base64 48
TESSIO_SECRET_KEY=...         # node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
TESSIO_ADMIN_EMAIL=...        # optional first-admin seed
TESSIO_ADMIN_PASSWORD=...
```

Mount a volume at `/data` to persist uploaded attachments. Expose container port `80`.

!!! note "Single instance"
    The all-in-one image bundles the background worker and local attachment storage, so
    run **one** instance. To scale horizontally, use the [Docker Compose](compose.md) or
    [Helm](kubernetes.md) paths instead.

## Operations

- [Configuration reference](../configuration.md)
- [TLS / HTTPS](../operations/tls.md)
- [Upgrading](../operations/upgrading.md)
- [Backup & restore](../operations/backup-restore.md)

# Single container (all-in-one)

The all-in-one image (`ghcr.io/tessio-ai/tessio-aio`) runs the whole app tier —
`api`, `worker`, `runner`, the `web` (Caddy) edge, and start-up migrations — in **one
container**, supervised by s6-overlay. The image itself holds no database: it connects
to a PostgreSQL (with `pgvector`) and Redis that you provide. The easiest way is
`compose.aio.yaml`, which can bundle a Postgres + Redis alongside the app container; to run
the image standalone (e.g. on a PaaS), point it at managed datastores instead.

## Install (one line)

With Docker installed, no clone or `.env` editing needed:

```bash
curl -fsSL https://raw.githubusercontent.com/tessio-ai/tessio/main/install.sh | sh
```

The installer downloads `compose.aio.yaml`, generates every secret, writes `.env`, and starts the
stack. It asks whether to run **bundled** Postgres + Redis containers (default) or use your **own
managed** datastores; skip the prompt with `--bundled` / `--external` (external reads
`DATABASE_URL` and `REDIS_URL` from the environment). It prints the admin login on success.

## Install (with the bundled datastores, manually)

The bundled Postgres + Redis containers live behind the `bundled` Compose profile, enabled with
`COMPOSE_PROFILES=bundled` (already set in `.env.aio.example`):

```bash
git clone https://github.com/tessio-ai/tessio.git tessio && cd tessio
cp .env.aio.example .env
# set SESSION_SECRET, TESSIO_SECRET_KEY, RUNNER_TOKEN, and optionally TESSIO_ADMIN_EMAIL/PASSWORD
docker compose -f compose.aio.yaml up -d
```

Open **http://localhost**. The container runs migrations on start (and seeds the admin if
configured), then starts the app processes.

To use **managed** Postgres/Redis instead, comment out `COMPOSE_PROFILES` in `.env` (so the
bundled containers stay off) and point `DATABASE_URL`/`REDIS_URL` at your instances — the same
`docker compose -f compose.aio.yaml up -d` then runs just the app container.

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

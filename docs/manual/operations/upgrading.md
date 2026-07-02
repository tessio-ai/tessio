# Upgrading

Database migrations run automatically on every start/upgrade and are idempotent, so the
upgrade flow is "get the new images, restart." **Back up your database first** — see
[Backup & restore](backup-restore.md).

## Docker Compose

```bash
cd tessio
# pin a version (recommended): set TESSIO_VERSION=X.Y.Z in .env
docker compose pull
docker compose up -d
```

The one-shot `migrate` service runs the new migrations before `api`/`worker` restart.
Watch it with `docker compose logs migrate`.

## All-in-one

```bash
docker compose -f compose.aio.yaml pull
docker compose -f compose.aio.yaml up -d
```

The all-in-one container re-runs migrations on start (the s6 `migrate` step) before the
app processes come up.

## Kubernetes (Helm)

```bash
helm upgrade tessio oci://ghcr.io/tessio-ai/charts/tessio --reuse-values \
  --set image.tag=X.Y.Z
```

Each upgrade creates a fresh migration Job; the `api`/`worker` pods wait for it to
complete before the rollout proceeds. Roll back with `helm rollback tessio`.

## Version pinning

Pin `TESSIO_VERSION` (compose) or `image.tag` (Helm) to a specific release rather than
`latest` so upgrades are deliberate. Read the release notes before jumping multiple
minor versions.

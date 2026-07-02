# Backup & restore

Two things hold durable state: **PostgreSQL** (all records) and the **attachment
volume** (uploaded files). Redis is a transient job queue and needs no backup.

## PostgreSQL

### Compose

```bash
# Backup
docker compose exec -T postgres pg_dump -U tessio tessio > tessio-$(date +%F).sql

# Restore (into an empty database)
docker compose exec -T postgres psql -U tessio -d tessio < tessio-2026-01-01.sql
```

### Kubernetes

```bash
kubectl exec -n tessio statefulset/tessio-postgresql -- \
  pg_dump -U tessio tessio > tessio-$(date +%F).sql
```

For a managed Postgres, use your provider's backup tooling.

!!! warning "pgvector"
    Restores must target a database where the `vector` and `pgcrypto` extensions are
    available. The migrations create them, but a brand-new managed database may need
    `pgvector` installed first.

## Attachments

Uploaded files live under `/data/storage` inside the api / all-in-one container:

- **Compose:** the `tessio_storage` volume (`tessio_aio_data` for all-in-one). Back it up
  with `docker run --rm -v tessio_storage:/data -v "$PWD":/backup alpine tar czf /backup/attachments.tgz -C /data .`
- **Kubernetes:** the `tessio-storage` PVC — snapshot it with your CSI driver, or
  `kubectl cp` the directory out of an api pod.

## Restore checklist

1. Stop the app (or scale it to zero) so nothing writes during restore.
2. Restore PostgreSQL from your dump.
3. Restore the attachment volume.
4. Start the app — migrations run and are no-ops if the schema already matches.

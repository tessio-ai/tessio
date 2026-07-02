# Kubernetes (Helm)

The Helm chart deploys Tessio to a cluster: Deployments for `api`/`worker`/`runner`/`web`,
a migration Job (api/worker wait for it), and — by default — a bundled pgvector Postgres
and Redis. The chart is published as an OCI artifact.

## Install

```bash
helm install tessio oci://ghcr.io/tessio-ai/charts/tessio \
  --namespace tessio --create-namespace \
  --set ingress.host=tessio.example.com \
  --set admin.email=admin@example.com \
  --set admin.password=change-me
```

`SESSION_SECRET` and `TESSIO_SECRET_KEY` are generated automatically and preserved across
upgrades. The release exposes the `web` service through an Ingress (enabled by default).

## Common values

| Value | Default | Purpose |
| --- | --- | --- |
| `ingress.enabled` | `true` | Create an Ingress to the web edge |
| `ingress.host` | `tessio.example.com` | Hostname to route |
| `ingress.className` | `""` | Ingress controller class |
| `ingress.tls` | `[]` | TLS config (see below) |
| `postgresql.enabled` | `true` | Bundle a pgvector Postgres |
| `externalDatabase.url` | `""` | Use a managed Postgres instead |
| `redis.enabled` | `true` | Bundle Redis |
| `externalRedis.url` | `""` | Use a managed Redis instead |
| `persistence.size` | `10Gi` | Attachment storage PVC size |
| `admin.email` / `admin.password` | `""` | Seed the first admin |
| `image.tag` | chart `appVersion` | Image tag to deploy |

See `deploy/helm/tessio/values.yaml` for the full list.

## Managed datastores

```bash
helm install tessio oci://ghcr.io/tessio-ai/charts/tessio \
  --set postgresql.enabled=false --set externalDatabase.url=postgres://user:pass@host:5432/db \
  --set redis.enabled=false --set externalRedis.url=redis://host:6379 \
  --set ingress.host=tessio.example.com
```

The managed Postgres must have the `pgvector` extension available.

## TLS

Terminate TLS at the Ingress (Caddy serves HTTP in-cluster). With cert-manager:

```bash
helm upgrade tessio oci://ghcr.io/tessio-ai/charts/tessio --reuse-values \
  --set 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-prod' \
  --set 'ingress.tls[0].secretName=tessio-tls' \
  --set 'ingress.tls[0].hosts[0]=tessio.example.com'
```

## Operations

- [Configuration reference](../configuration.md)
- [Upgrading](../operations/upgrading.md)
- [Backup & restore](../operations/backup-restore.md)
- [Troubleshooting](../operations/troubleshooting.md)

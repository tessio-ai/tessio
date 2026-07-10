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

## App-only (managed datastores)

To run **just the app** — `api`, `worker`, `runner`, `web`, and the migration Job — against a
Postgres and Redis you already operate, disable the two bundled datastores and provide their
URLs. Nothing else changes: the app secrets are still generated and preserved across upgrades.

Everything you need is four values (`postgresql.enabled=false` + `externalDatabase.url`, and the
Redis pair). As one-shot flags, no local files:

```bash
helm install tessio oci://ghcr.io/tessio-ai/charts/tessio \
  --set postgresql.enabled=false --set externalDatabase.url=postgres://user:pass@host:5432/db \
  --set redis.enabled=false --set externalRedis.url=redis://host:6379 \
  --set ingress.host=tessio.example.com
```

For GitOps or to keep the config in a file, copy the ready-made
[`values-external.yaml`](https://github.com/tessio-ai/tessio/blob/main/deploy/helm/tessio/values-external.yaml)
(fill in the two URLs and your host) and pass it with `-f`:

```bash
curl -fsSLO https://raw.githubusercontent.com/tessio-ai/tessio/main/deploy/helm/tessio/values-external.yaml
# edit values-external.yaml, then:
helm install tessio oci://ghcr.io/tessio-ai/charts/tessio -f values-external.yaml
```

The managed Postgres must have the `pgvector` extension available. When a datastore is disabled
without its `external*.url`, the chart fails to render with a clear message rather than deploying
a broken release.

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

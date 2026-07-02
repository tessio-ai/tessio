# TLS / HTTPS

How you terminate TLS depends on the install path.

## Docker Compose — Caddy auto-HTTPS

The `web` edge is Caddy, which can obtain and renew Let's Encrypt certificates
automatically. Point a domain's DNS at your host, open ports **80 and 443**, and set:

```bash
# in .env
TESSIO_SITE_ADDRESS=tessio.example.com
```

Restart (`docker compose up -d`). Caddy provisions a certificate on first request and
stores it in the `caddy_data` volume (so it persists across restarts). For a plain-HTTP
local trial, keep `TESSIO_SITE_ADDRESS=:80`.

## All-in-one

The all-in-one image serves HTTP on port 80. For HTTPS, put a TLS-terminating reverse
proxy or load balancer in front (most PaaS platforms provide this automatically), or run
a separate Caddy/Traefik/nginx in front of the container.

## Kubernetes — TLS at the Ingress

Caddy serves HTTP inside the cluster; terminate TLS at the Ingress. With cert-manager:

```bash
helm upgrade tessio oci://ghcr.io/tessio-ai/charts/tessio --reuse-values \
  --set 'ingress.annotations.cert-manager\.io/cluster-issuer=letsencrypt-prod' \
  --set 'ingress.tls[0].secretName=tessio-tls' \
  --set 'ingress.tls[0].hosts[0]=tessio.example.com'
```

Or reference an existing TLS secret via `ingress.tls`. Leave `config.siteAddress` at
`:80` (the default).

# Troubleshooting

## `migrate` fails / api keeps restarting

Check the migrate logs (`docker compose logs migrate`, or
`kubectl logs job/<release>-migrate-<rev>`). Most failures are database connectivity or a
missing extension:

- `DATABASE_URL` wrong or the database unreachable.
- The Postgres lacks `pgvector` — the migrations run `CREATE EXTENSION vector`, which
  needs the extension installed. Use a Postgres image/service that provides pgvector.

## `pull access denied` / `manifest unknown` for `ghcr.io/tessio-ai/tessio-*`

The GHCR packages may be private or the tag doesn't exist yet. Ensure the packages are
public on GitHub and that the `TESSIO_VERSION` value in `.env` matches a published
release tag (or remove it to use `latest`).

## `502 Bad Gateway` from the web edge

The api isn't ready yet (still starting or migrations still running). Wait, then check
`docker compose logs api`. The edge recovers automatically once api passes its health
check.

## The app starts but won't accept logins / `SESSION_SECRET` error

In production the api refuses to start without a strong `SESSION_SECRET`. Set it (see
[Configuration](../configuration.md)) and restart.

## Uploaded attachments disappear after a restart

Attachment storage must be on a persistent volume. Compose and Helm configure this by
default (`/data/storage`); if you customized the deployment, ensure a volume/PVC is
mounted there.

## No admin to log in with

Set `TESSIO_ADMIN_EMAIL` + `TESSIO_ADMIN_PASSWORD` and restart — the idempotent seed
creates the first admin and default schemas. (Helm: `--set admin.email=… --set
admin.password=…` then `helm upgrade`.)

## Getting more logs

- Compose: `docker compose logs -f <service>` (`api`, `worker`, `runner`, `web`, `migrate`).
- All-in-one: `docker compose -f compose.aio.yaml logs -f app` (s6 prefixes each service).
- Kubernetes: `kubectl logs -n tessio deploy/tessio-api` (and `-worker`, `-runner`, `-web`).

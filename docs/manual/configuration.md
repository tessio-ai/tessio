# Configuration

Tessio is configured entirely through environment variables (Compose / all-in-one) or
Helm values (Kubernetes). Two secrets are required; everything else has a sensible
default.

## Required secrets

| Variable | How to generate |
| --- | --- |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `TESSIO_SECRET_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` (32-byte base64) |

`SESSION_SECRET` signs session cookies. `TESSIO_SECRET_KEY` encrypts stored AI-provider
keys. Keep both stable across restarts — changing `SESSION_SECRET` logs everyone out;
changing `TESSIO_SECRET_KEY` invalidates stored provider keys. The Helm chart generates
and preserves both automatically.

## Environment variables

| Variable | Default | Used by | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | — | api, worker, migrate | PostgreSQL connection (needs `pgvector`) |
| `REDIS_URL` | — | api, worker | Redis connection (job queue) |
| `SESSION_SECRET` | — | api | Cookie signing (required in production) |
| `TESSIO_SECRET_KEY` | — | api | Provider-key encryption (base64 32-byte) |
| `TESSIO_STORAGE_DIR` | `/data/storage` | api | On-disk attachment storage path |
| `TESSIO_ADMIN_EMAIL` | — | migrate | Seed the first admin (optional) |
| `TESSIO_ADMIN_PASSWORD` | — | migrate | First-admin password (optional) |
| `TESSIO_ADMIN_NAME` | — | migrate | First-admin display name (optional) |
| `TESSIO_SITE_ADDRESS` | `:80` | web (Caddy) | Site address; a domain enables auto-HTTPS |
| `TESSIO_VERSION` | `latest` | compose | Image tag to run |
| `POSTGRES_PASSWORD` | `tessio` | bundled postgres | Bundled DB password — set a strong value and keep it in sync with `DATABASE_URL` |
| `REDIS_PASSWORD` | _(empty)_ | bundled redis | Bundled Redis password — set a strong value and include it in `REDIS_URL` |
| `RUNNER_TOKEN` | _(empty)_ | worker, runner | Shared token that authenticates the script runner's `/run` endpoint |
| `TESSIO_HTTP_PORT` / `TESSIO_HTTPS_PORT` | `80` / `443` | compose | Host ports for the edge |
| `EMAIL_POLL_INTERVAL_MS` | `60000` | worker | Inbound IMAP poll interval (ms) |
| `SCHEDULE_TICK_INTERVAL_MS` | `60000` | worker | Scheduled-workflow tick cadence (ms) |
| `SLA_TICK_INTERVAL_MS` | `60000` | worker | SLA breach-check tick cadence (ms) |
| `EMAIL_ATTACHMENT_MAX_BYTES` | `10485760` | worker | Max size per inbound email attachment |
| `TESSIO_SITE_URL` | `http://localhost` | worker | Base URL for ticket links in notification emails |

The admin seed is idempotent — it only creates the admin and default schemas on first
run; later starts skip it.

## Hardening the datastores (recommended for production)

`SESSION_SECRET` and `TESSIO_SECRET_KEY` are the only values strictly required to boot,
but the bundled Postgres and Redis ship behind passwords and the script runner can be
locked down. The `.env.production.example` / `.env.aio.example` files include placeholders
for these — **replace the `CHANGE_ME_*` values** before going to production:

| Variable | Generate | Notes |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` | Must match the password in `DATABASE_URL`. |
| `REDIS_PASSWORD` | `openssl rand -hex 24` | When set, must also appear in `REDIS_URL` (`redis://:PASSWORD@redis:6379`). Leave empty to disable Redis auth. |
| `RUNNER_TOKEN` | `openssl rand -hex 32` | When set, the worker presents it and the runner rejects unauthenticated `/run` calls. Leave empty to keep `/run` open on the internal network. |

The bundled Postgres and Redis are only reachable on the internal Compose network (they
publish no host ports), so these passwords are defense-in-depth rather than internet-facing
credentials — but you should still set them.

## Helm values

The same settings map to Helm values (see `deploy/helm/tessio/values.yaml`):

| Concern | Helm value |
| --- | --- |
| Image | `image.registry` / `image.repository` / `image.tag` |
| Postgres | `postgresql.enabled` or `externalDatabase.url` |
| Redis | `redis.enabled` or `externalRedis.url` |
| Secrets | `secrets.sessionSecret` / `secrets.secretKey` (auto-generated if empty) |
| Admin seed | `admin.email` / `admin.password` / `admin.name` |
| Attachments | `persistence.enabled` / `persistence.size` |
| Ingress / TLS | `ingress.host` / `ingress.tls` / `ingress.className` |
| Site address | `config.siteAddress` (`:80`; TLS terminates at the Ingress) |

## Single sign-on (OIDC)

Tessio supports any OpenID Connect provider (Google, Okta, Entra/Azure AD, Keycloak, Auth0).
An admin configures it in **Settings → Single sign-on** by entering the issuer URL, client ID,
and client secret. Copy the **redirect URI** shown on that page into the provider's list of
allowed redirect URIs. SSO requires `TESSIO_SITE_URL` to be set to your public URL — the
redirect URI is derived from it. By default only existing Tessio users can sign in via SSO;
enable **"auto-create users"** on the SSO settings page to automatically provision unknown
verified emails as requester accounts.

Identity is taken from the provider's signature-validated ID token. A login is rejected if the
provider explicitly marks the email unverified (`email_verified: false`); providers that omit
that claim entirely (common for managed directories like Google Workspace and Entra) are treated
as verified. Use the optional **allowed domain** restriction if you only want one email domain to
sign in.

## Audit log

Admins can review an append-only audit log at **Settings → Audit log**. It records sign-ins
(including SSO), failed sign-ins, sign-outs, configuration changes (email / AI / SLA / SSO
settings), and user-management actions (user created / role or status changed), with the actor,
timestamp, and source IP. Secret values are never recorded. Filter by action and page through
history.

<div align="center">

# Tessio

### The open-source, self-hostable AI ITSM platform.

**Your tickets and data never leave your infrastructure. Bring your own LLM.**
An open alternative to ServiceNow, Zendesk, and Freshservice.

[Quickstart](#-quickstart-5-minutes) · [Features](#features) · [Editions](#editions) · [Self-hosting](#self-hosting) · [Docs](https://tessio-ai.github.io/tessio/) · [Licensing](#licensing) · [Contributing](CONTRIBUTING.md)

<!-- TODO: add a product screenshot/GIF here before launch, e.g. docs/assets/screenshot.png -->
<!-- ![Tessio console](docs/assets/screenshot.png) -->

</div>

---

Tessio is a modern IT service desk with an **AI teammate ("Tess") built in**. Tess triages
every ticket, routes it to the right team, drafts replies, and resolves the routine — so your
agents only handle what actually needs a human. It ships the full ITSM toolkit: a fast
keyboard-first ticket queue, knowledge base, schema-driven intake forms, dashboards and custom
reports, a visual workflow engine, SLAs, email-to-ticket, asset/device inventory, and a
brandable end-user portal.

**Why Tessio**

- 🔒 **Your data stays yours.** Self-host on your own servers. No telemetry, no analytics, no
  phone-home — verified in CI. Sensitive IT data never leaves your infrastructure.
- 🤖 **Bring your own LLM.** Point Tess at OpenAI or any OpenAI-compatible endpoint (Azure
  OpenAI, Ollama, LM Studio, vLLM, a local gateway) — run a fully local model with **zero
  outbound egress**. PII is redacted at the model boundary, always.
- 🆓 **Free for teams, no seat cap.** The Community edition is the full core product with
  **unlimited agents**. We never gate on seat count — only on enterprise features.
- ⚡ **Fast and calm.** A dense, keyboard-first console in the spirit of Linear — not a 2009-era
  enterprise portal.

## Features

| | |
| --- | --- |
| **Tickets** | Dense, keyboard-first queue with saved views, bulk triage, optimistic edits |
| **Tess AI** | Autonomous triage, reply drafting, summarization, semantic "similar tickets", and natural-language queue search ("Ask Tess") |
| **Knowledge base** | Articles with revisions; Tess answers from your own content and cites its sources |
| **Intake forms** | Schema-driven forms that suggest a category and deflect to a fix before a ticket is filed |
| **Workflows** | Visual automation engine with triggers, conditions, scheduled runs, secrets, and a sandboxed script step |
| **SLAs** | Per-priority response/resolution targets with breach detection and escalation |
| **Email** | Outbound notifications + inbound IMAP email-to-ticket |
| **Assets & devices** | CMDB-lite inventory plus an endpoint agent for auto-discovery |
| **Dashboards & reports** | Live SLA health, team load, trends, and a catalog-driven custom report builder |
| **Portal & branding** | A brandable end-user portal; recolor and logo the whole workspace |

## Editions

Tessio is **open core**. The Community edition is free, self-hosted, AGPL-licensed, and complete.
Paid editions add features for larger organizations — gated by **feature**, never by seat count.

| | **Community** (free, self-host) | **Enterprise** (self-host) | **Cloud** (hosted) |
| --- | :---: | :---: | :---: |
| Full core ITSM (everything in [Features](#features)) | ✅ | ✅ | ✅ |
| **Unlimited agents — no seat cap** | ✅ | ✅ | ✅ |
| Bring-your-own LLM key (no AI egress) | ✅ | ✅ | — *(metered)* |
| SSO / OIDC | — | ✅ | ✅ |
| Audit log viewer | — | ✅ | ✅ |
| SCIM provisioning · custom roles/advanced RBAC · advanced SLA | — | 🔜 | 🔜 |
| Managed hosting, upgrades & metered AI credits | — | — | ✅ |

> The edition is selected with the `TESSIO_EDITION` environment variable (`community` by
> default). Enterprise features live in the commercial [`ee/`](ee/) directory and are excluded
> from Community builds. 🔜 = reserved for an upcoming release.
>
> <!-- PRODUCT: the exact free-vs-paid feature split is a pricing decision — confirm before launch. -->

## 🚀 Quickstart (5 minutes)

**One line — no clone, no `.env` editing.** With Docker installed, run:

```bash
curl -fsSL https://raw.githubusercontent.com/tessio-ai/tessio/main/install.sh | sh
```

The installer fetches a single Compose file, generates every secret for you, and starts the
all-in-one stack (web + API + worker + runner + migrations in one container). It asks whether to
run **bundled Postgres + Redis containers** (default) or use your **own managed datastores** —
pass `--external` (with `DATABASE_URL`/`REDIS_URL`) to skip the prompt. It prints the admin login
when it finishes. Open <http://localhost> and sign in.

<details>
<summary>Prefer to clone and run Compose yourself?</summary>

Run the whole multi-service stack — web, API, worker, runner, Postgres (pgvector), and Redis.
Migrations and the first admin are seeded automatically on first start.

```bash
git clone https://github.com/tessio-ai/tessio.git && cd tessio
cp .env.production.example .env

# Generate the three required secrets and an admin login, then review .env:
{
  echo "SESSION_SECRET=$(openssl rand -base64 48)"
  echo "TESSIO_SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
  echo "RUNNER_TOKEN=$(openssl rand -hex 32)"
  echo "TESSIO_ADMIN_EMAIL=admin@example.com"
  echo "TESSIO_ADMIN_PASSWORD=$(openssl rand -base64 18)"
} >> .env

docker compose up -d --build
```

</details>

Only the web edge is published; the API, worker, runner, Postgres, and Redis stay on the internal
Docker network. For automatic HTTPS, set `TESSIO_SITE_ADDRESS` to a domain that resolves to the host.

**Turn on Tess AI:** either set the `TESSIO_AI_*` variables in `.env` (bring-your-own key — see
`.env.production.example`) for a default provider, or configure a per-org key in
**Settings → Tess AI** after signing in. AI stays off until a key is provided, and self-host never
sends data anywhere except the LLM endpoint you choose.

See [Self-hosting](#self-hosting) for the single-container and Kubernetes paths, and the
[documentation site](https://tessio-ai.github.io/tessio/) for full install,
configuration, upgrade, and backup guides.

## Self-hosting

- **One-line installer (easiest):** `curl -fsSL https://raw.githubusercontent.com/tessio-ai/tessio/main/install.sh | sh` —
  no clone; brings up the all-in-one container with bundled or managed (`--external`) datastores.
- **Multi-service (recommended for scale):** the `compose.yaml` stack above. Scales each service
  independently.
- **Single container (all-in-one):** one supervised container plus Postgres + Redis —
  `cp .env.aio.example .env && docker compose -f compose.aio.yaml up -d --build`.
- **Kubernetes (Helm):** a chart in [`deploy/helm/tessio`](deploy/helm/tessio).

Published multi-arch images live at `ghcr.io/tessio-ai/tessio-<service>` once a release is cut;
until then the commands above build locally with `--build`. Full guides:
[Getting started](https://tessio-ai.github.io/tessio/getting-started/) ·
[Docker](https://tessio-ai.github.io/tessio/install/compose/) ·
[Kubernetes](https://tessio-ai.github.io/tessio/install/kubernetes/) ·
[AI & privacy](https://tessio-ai.github.io/tessio/ai-privacy/).

## Development

A TypeScript monorepo (pnpm + Turborepo). Apps: `api` (Fastify), `web` (React/Vite),
`worker` (BullMQ), `runner` (sandboxed scripts). Shared `packages/*`; commercial `ee/*`.

**Prerequisites:** Node 22+ (`nvm use`), pnpm 10+ (`corepack enable`), Docker.

```bash
pnpm install
docker compose -f docker-compose.yml up -d        # dev Postgres + Redis (+ test mail)
cp .env.example .env
pnpm --filter @tessio/db db:migrate
TESSIO_ADMIN_EMAIL=admin@acme.io TESSIO_ADMIN_PASSWORD=changeme \
  pnpm --filter @tessio/db db:seed                 # first admin (idempotent)
pnpm dev                                            # all apps in watch mode
```

`admin`/`agent` land in the console; `requester` lands in the portal. Useful commands:
`pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` (run across the whole workspace).

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, the core ↔ `ee/` import boundary, and
the CLA.

## Licensing

Tessio is **open core**:

- Everything **outside** [`ee/`](ee/) is licensed under the **GNU AGPL-3.0-only** — see
  [`LICENSE`](LICENSE). Free to self-host, including for commercial/internal use.
- The [`ee/`](ee/) directory is **commercial** — see [`ee/LICENSE`](ee/LICENSE).
- Contributions require a **CLA** (we dual-license). See [`LICENSING.md`](LICENSING.md) and
  [CONTRIBUTING.md](CONTRIBUTING.md).

Security issues: please follow [SECURITY.md](SECURITY.md) — do **not** open a public issue.
